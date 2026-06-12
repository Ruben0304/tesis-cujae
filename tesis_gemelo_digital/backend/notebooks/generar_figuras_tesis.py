"""
generar_figuras_tesis.py
========================
Genera las figuras definitivas para la tesis, usando el modelo
en producción (havana_v1) y los artefactos del CNN ya guardados.

Salida: backend/notebooks/figuras_tesis/
Correr desde: backend/notebooks/
  ../venv/bin/python3.12 generar_figuras_tesis.py
"""

import json, sys, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import joblib
import pvlib
from pathlib import Path
from datetime import datetime

# solar_features vive en app/services/ — añadir al path
sys.path.insert(0, str(Path(__file__).parent.parent / "app" / "services"))
from solar_features import build_features

warnings.filterwarnings("ignore")

# ── Rutas ──────────────────────────────────────────────────────────────────
MODELS_DIR    = Path("../models")
ARTIFACTS_DIR = Path("artifacts")       # artefactos CNN
OUT_DIR       = Path("figuras_tesis")
OUT_DIR.mkdir(exist_ok=True)

# Estilo global
plt.rcParams.update({
    "font.size": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.dpi": 150,
})

print("=" * 60)
print("  GENERADOR DE FIGURAS DEFINITIVAS — TESIS")
print("=" * 60)


# ══════════════════════════════════════════════════════════════════
# 1. MODELO SOLAR — HAVANA V1
# ══════════════════════════════════════════════════════════════════

print("\n[1/7] Cargando modelo havana_v1 …")
rf = joblib.load(MODELS_DIR / "solar_production_havana_v1.pkl")
with open(MODELS_DIR / "metadata_havana_v1.json") as f:
    meta = json.load(f)

FEATURES = meta["features"]
# Métricas daylight (las relevantes para la tesis)
metrics  = meta["metrics"]
all_mods = meta["all_models"]

print(f"  Modelo: {type(rf).__name__}, {rf.n_features_in_} features")
print(f"  R² global: {metrics['r2']:.4f}  |  R² día: {metrics['daylight_r2']:.4f}")
print(f"  RMSE día : {metrics['daylight_rmse']:.4f}  |  MAE día: {metrics['daylight_mae']:.4f}")


# ── Figura 1: Comparación de modelos (horas de día) ───────────────────────
print("\n[2/7] Generando comparación de modelos …")

modelos_labels = ["Reg. Lineal\n(baseline)", "Random Forest\n★ elegido", "HistGradient\nBoosting"]
model_keys     = ["linear", "random_forest", "hist_gbm"]
colors         = ["#90CAF9", "#1565C0", "#64B5F6"]

r2_day   = [all_mods[k]["daylight_r2"]   for k in model_keys]
rmse_day = [all_mods[k]["daylight_rmse"] for k in model_keys]
mae_day  = [all_mods[k]["daylight_mae"]  for k in model_keys]

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
for ax, vals, title, ylabel, best_min in zip(
    axes,
    [r2_day, rmse_day, mae_day],
    ["R² (horas de día)", "RMSE diurno (factor cap.)", "MAE diurno (factor cap.)"],
    ["R²", "nRMSE", "nMAE"],
    [False, True, True],
):
    bars = ax.bar(modelos_labels, vals, color=colors, edgecolor="white", linewidth=0.8)
    best_idx = vals.index(min(vals) if best_min else max(vals))
    bars[best_idx].set_edgecolor("#F44336")
    bars[best_idx].set_linewidth(2.5)
    for bar, v in zip(bars, vals):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(vals) * 0.02,
            f"{v:.3f}",
            ha="center", fontsize=9, fontweight="bold",
        )
    ax.set_title(title, fontsize=10, fontweight="bold")
    ax.set_ylabel(ylabel)
    ax.tick_params(axis="x", labelsize=9)

fig.suptitle(
    "Comparación de Modelos — Predicción de Producción Solar (horas de día)",
    fontsize=12, fontweight="bold", y=1.02,
)
plt.tight_layout()
out = OUT_DIR / "comparacion_modelos_solar.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")


# ── Figura 2: Importancia de características ──────────────────────────────
print("[3/7] Generando importancia de características …")

importances = rf.feature_importances_
indices     = np.argsort(importances)[::-1]
feat_labels = [f.replace("_", " ").title() for f in FEATURES]
colors_imp  = ["#1565C0" if importances[i] > 0.05 else "#90CAF9" for i in indices]

fig, ax = plt.subplots(figsize=(11, 5))
bars = ax.barh(
    [feat_labels[i] for i in indices],
    importances[indices],
    color=colors_imp, edgecolor="white", linewidth=0.5,
)
for bar, val in zip(bars, importances[indices]):
    ax.text(
        val + 0.003, bar.get_y() + bar.get_height() / 2,
        f"{val*100:.1f}%", va="center", fontsize=9, color="#333",
    )
ax.set_xlabel("Importancia relativa (índice de impureza Gini)")
ax.set_title(
    "Importancia de Características — RF Producción Solar (Havana v1)",
    fontweight="bold",
)
ax.set_xlim(0, importances.max() * 1.22)
ax.invert_yaxis()
plt.tight_layout()
out = OUT_DIR / "feature_importance_solar.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")


# ── Figura 3: Perfil de producción diaria simulado ────────────────────────
print("[4/7] Generando perfil de producción diaria …")

LOCAL_TZ = "America/Havana"
LAT, LON = 23.1136, -82.3666

def _perfil_local(date_local_str: str, cloud_pct: float):
    """
    Genera el perfil horario de factor de capacidad para un día completo
    expresado en hora LOCAL de La Habana (0-23 h).

    Usa solar_features.build_features() para que las features cíclicas
    (hour_sin/cos) se calculen con la hora local, igual que en entrenamiento.
    La radiación incidente se obtiene del modelo de cielo despejado de pvlib
    atenuado por la cobertura nubosa.
    """
    # 24 timestamps en hora local → convertir a UTC para pvlib y build_features
    local_times = pd.date_range(date_local_str, periods=24, freq="h", tz=LOCAL_TZ)
    utc_times   = local_times.tz_convert("UTC")

    # Radiación de cielo despejado para cada hora UTC
    loc = pvlib.location.Location(LAT, LON, tz="UTC", altitude=50)
    cs  = loc.get_clearsky(utc_times, model="ineichen")

    # shortwave_radiation = GHI cielo despejado × atenuación nubosa
    cloud_atten = 1.0 - (cloud_pct / 100.0) * 0.7
    shortwave   = (cs["ghi"].values * cloud_atten).clip(0)

    temp = 28.0 if pd.Timestamp(date_local_str).month in range(4, 10) else 24.0
    df_weather = pd.DataFrame({
        "temperature_2m":       temp,
        "relative_humidity_2m": 65.0,
        "wind_speed_10m":       3.5,
        "cloud_cover":          float(cloud_pct),
        "shortwave_radiation":  shortwave,
    }, index=utc_times)

    # build_features usa hora LOCAL internamente para hour_sin/cos
    feats = build_features(df_weather, LAT, LON)
    preds = np.clip(rf.predict(feats), 0, 1)

    return local_times.hour.values, preds   # horas locales 0-23

# Escenarios: junio (soleado) y noviembre (nublado)
hours_sunny,  preds_sunny  = _perfil_local("2015-06-15", cloud_pct=5)
hours_cloudy, preds_cloudy = _perfil_local("2015-11-20", cloud_pct=75)

fig, ax = plt.subplots(figsize=(12, 4))
ax.fill_between(hours_sunny,  preds_sunny,  alpha=0.25, color="#FFA000")
ax.fill_between(hours_cloudy, preds_cloudy, alpha=0.25, color="#90A4AE")
ax.plot(hours_sunny,  preds_sunny,  "o-",  color="#E65100", lw=2, ms=4,
        label="Día soleado — junio (5 % nubes)")
ax.plot(hours_cloudy, preds_cloudy, "s--", color="#607D8B", lw=2, ms=4,
        label="Día nublado — noviembre (75 % nubes)")
ax.set_xlabel("Hora local (La Habana)")
ax.set_ylabel("Factor de capacidad predicho (0 – 1)")
ax.set_title("Perfil de Producción Solar Predicho — Modelo Random Forest (Havana v1)",
             fontweight="bold")
ax.set_xticks(range(0, 24, 2))
ax.set_xticklabels([f"{h:02d}h" for h in range(0, 24, 2)])
ax.set_xlim(0, 23)
ax.set_ylim(0, 1.05)
ax.legend()
plt.tight_layout()
out = OUT_DIR / "perfil_produccion_diaria.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")
print(f"  Pico soleado : hora {hours_sunny[preds_sunny.argmax()]:02d}h local"
      f" → {preds_sunny.max():.3f} (= {preds_sunny.max()*50:.1f} kW @ 50kW)")


# ══════════════════════════════════════════════════════════════════
# 2. CNN — COPIAR ARTEFACTOS YA GENERADOS
# ══════════════════════════════════════════════════════════════════
import shutil

print("\n[5/7] Copiando figuras CNN desde artifacts/ …")
cnn_files = {
    "cnn_metrics.png":          ARTIFACTS_DIR / "confusion_matrix.png",   # placeholder
}

# Los artefactos del CNN vienen de validacion_output/ (ya generados correctamente)
VAL_OUT = Path("validacion_output")
for fname in ["cnn_metrics.png", "training_history_cnn.png",
              "confusion_matrix.png", "roc_curve.png"]:
    src = VAL_OUT / fname
    if not src.exists():
        src = ARTIFACTS_DIR / fname  # fallback a artifacts/
    if src.exists():
        dst = OUT_DIR / fname
        shutil.copy2(src, dst)
        print(f"  → {dst}  (desde {src})")
    else:
        print(f"  ⚠ No encontrado: {fname}")


# ── Figura 4: Métricas CNN (barra) ────────────────────────────────────────
print("[6/7] Generando gráfico de métricas CNN …")

cnn_metrics = {
    "Exactitud\n(Accuracy)": 0.7867,
    "Precisión\n(Precision)": 0.8421,
    "Sensibilidad\n(Recall)": 0.6009,
    "F1-Score": 0.7014,
    "AUC-ROC": 0.8373,
}
names  = list(cnn_metrics.keys())
values = list(cnn_metrics.values())
colors_cnn = ["#42A5F5", "#1565C0", "#90CAF9", "#1976D2", "#0D47A1"]

fig, ax = plt.subplots(figsize=(10, 4))
bars = ax.bar(names, values, color=colors_cnn, edgecolor="white", linewidth=0.8)
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.01, f"{val:.4f}",
            ha="center", fontsize=10, fontweight="bold")
ax.set_ylim(0, 1.0)
ax.set_ylabel("Valor de la métrica")
ax.set_title("Métricas de Clasificación — CNN MobileNetV2 (Diagnóstico Visual de Paneles)",
             fontweight="bold")
ax.axhline(0.5, color="red", lw=1, ls="--", alpha=0.5, label="Referencia aleatoria")
ax.legend(fontsize=9)
plt.tight_layout()
out = OUT_DIR / "cnn_metrics.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")


# ── Figura 5: Resumen ejecutivo ───────────────────────────────────────────
print("[7/7] Generando resumen ejecutivo …")

fig, axes = plt.subplots(1, 3, figsize=(15, 4))

# Panel A: Solar R² comparación
ax = axes[0]
mods_short = ["Lin.", "RF ★", "HistGB"]
r2s = [all_mods[k]["daylight_r2"] for k in model_keys]
bars = ax.bar(mods_short, r2s, color=["#90CAF9", "#1565C0", "#64B5F6"])
bars[1].set_edgecolor("#F44336"); bars[1].set_linewidth(2.5)
for bar, v in zip(bars, r2s):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height()+0.005,
            f"{v:.3f}", ha="center", fontsize=9, fontweight="bold")
ax.set_title("Solar: R² horas de día", fontweight="bold")
ax.set_ylim(0, 1)
ax.set_ylabel("R²")

# Panel B: CNN métricas clave
ax = axes[1]
kpis = ["Precisión", "AUC-ROC"]
vals_kpi = [0.8421, 0.8373]
bars = ax.bar(kpis, vals_kpi, color=["#1565C0", "#1976D2"])
for bar, v in zip(bars, vals_kpi):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height()+0.005,
            f"{v:.4f}", ha="center", fontsize=10, fontweight="bold")
ax.set_title("CNN: métricas clave", fontweight="bold")
ax.set_ylim(0, 1)
ax.set_ylabel("Valor")

# Panel C: Distribución de pruebas unitarias
ax = axes[2]
capas = ["Backend\nPrediction", "Backend\nAnalytics", "Backend\nUser",
         "Backend\nAuth", "Backend\nBattery", "Backend\nCRUD",
         "Backend\nFeatures", "Backend\nML Model",
         "Frontend\nCalc.", "Frontend\nPred."]
counts = [37, 18, 31, 19, 17, 31, 14, 20, 40, 24]
colors_t = (["#1565C0"]*8 + ["#42A5F5"]*2)
bars = ax.bar(capas, counts, color=colors_t)
for bar, v in zip(bars, counts):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height()+0.3,
            str(v), ha="center", fontsize=8, fontweight="bold")
ax.set_title(f"Pruebas unitarias (total: {sum(counts)})", fontweight="bold")
ax.set_ylabel("Número de pruebas")
ax.tick_params(axis="x", labelsize=7.5)

backend_patch = mpatches.Patch(color="#1565C0", label="Backend (pytest)")
frontend_patch = mpatches.Patch(color="#42A5F5", label="Frontend (vitest)")
ax.legend(handles=[backend_patch, frontend_patch], fontsize=8)

fig.suptitle("Resumen Ejecutivo de Validación del Sistema",
             fontsize=13, fontweight="bold", y=1.02)
plt.tight_layout()
out = OUT_DIR / "resumen_ejecutivo_ml.png"
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  → {out}")


# ══════════════════════════════════════════════════════════════════
# RESUMEN
# ══════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  FIGURAS GENERADAS EN:", OUT_DIR.resolve())
print("=" * 60)
for f in sorted(OUT_DIR.iterdir()):
    size_kb = f.stat().st_size / 1024
    print(f"  {f.name:<40} {size_kb:6.1f} KB")
print()
print("  MÉTRICAS FINALES (havana_v1):")
print(f"    R² global    : {metrics['r2']:.4f}")
print(f"    R² día       : {metrics['daylight_r2']:.4f}")
print(f"    nRMSE día    : {metrics['daylight_rmse']*100:.2f} % de capacidad")
print(f"    nMAE  día    : {metrics['daylight_mae']*100:.2f} % de capacidad")
print(f"    Muestras     : {meta['training_samples']:,} train / {meta['test_samples']:,} test")
print(f"    Datos        : {meta['data_source']}")
print(f"    Años         : {meta['training_years']}")
print("=" * 60)
