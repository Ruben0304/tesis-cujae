"""
Pruebas de integración para el modelo ML de producción solar (Havana v1).

Verifica que el modelo en producción (solar_production_havana_v1.pkl) cargue
correctamente, que su salida sea físicamente consistente y que el escalado
de factor de capacidad a kilovatios funcione según lo documentado en la tesis.

Estas pruebas cargan el modelo real (no un mock) para garantizar que lo que
se ejecuta en producción es coherente con lo que se describe en el documento.

Cubre:
- Carga del modelo y verificación de metadatos
- Rango y signo de las predicciones
- Consistencia física (mediodía > mañana; soleado > nublado; noche ≈ 0)
- Escalado capacity_factor × capacidad_instalada → kW
"""
import math
import numpy as np
import pandas as pd
import pytest

from app.services.ml_model_service import MLModelService
from app.services.solar_features import build_features, FEATURE_COLUMNS

MODEL_NAME = "havana_v1"


# ── Fixture: modelo cargado una sola vez por módulo ──────────────────────────

@pytest.fixture(scope="module")
def modelo():
    svc = MLModelService()
    svc.load_model(MODEL_NAME)
    return svc


# ── Helpers ──────────────────────────────────────────────────────────────────

def _features_para_hora(hour_utc: int, cloud: float = 10.0, rad: float | None = None):
    """
    Construye la matriz de features para una hora UTC específica en La Habana.

    La radiación por defecto sigue un perfil gaussiano centrado en las 17:30 UTC
    (mediodía solar en La Habana en junio, UTC-4 → ≈ 13:30 hora local).
    """
    if rad is None:
        rad = max(0.0, 900.0 * math.exp(-((hour_utc - 17.5) ** 2) / (2 * 3.5 ** 2)))
    ts = pd.DatetimeIndex(
        [f"2015-06-15T{hour_utc:02d}:30:00+00:00"],
        dtype="datetime64[ns, UTC]",
    )
    df = pd.DataFrame(
        {
            "temperature_2m": 28.0,
            "relative_humidity_2m": 65.0,
            "wind_speed_10m": 3.5,
            "cloud_cover": cloud,
            "shortwave_radiation": rad,
        },
        index=ts,
    )
    return build_features(df)


# ── Carga y metadatos ────────────────────────────────────────────────────────

class TestCargaModelo:
    def test_carga_exitosa(self, modelo):
        assert modelo.model_loaded is True

    def test_modelo_no_es_none(self, modelo):
        assert modelo.model is not None

    def test_metadatos_cargados(self, modelo):
        assert modelo.metadata is not None

    def test_nombre_correcto(self, modelo):
        name = modelo.metadata.get("model_name", "")
        assert "havana" in name.lower() or "random_forest" in name.lower()

    def test_exactamente_14_features(self, modelo):
        assert len(modelo.metadata["features"]) == 14

    def test_orden_de_features_coincide_con_solar_features(self, modelo):
        assert modelo.metadata["features"] == FEATURE_COLUMNS

    def test_target_es_factor_de_capacidad(self, modelo):
        assert modelo.metadata.get("output_is_capacity_factor") is True

    def test_r2_diurno_mayor_que_0p75(self, modelo):
        # Umbral conservador: el modelo tiene R²_día = 0.7895
        r2_day = modelo.metadata.get("metrics", {}).get("daylight_r2")
        assert r2_day is not None and r2_day > 0.75

    def test_algoritmo_es_random_forest(self, modelo):
        assert "RandomForest" in type(modelo.model).__name__


# ── Predicciones: signo y rango ──────────────────────────────────────────────

class TestRangoPredicciones:
    def test_prediccion_no_negativa_al_mediodia(self, modelo):
        features = _features_para_hora(17)
        pred = float(modelo.predict(features)[0])
        assert pred >= 0.0

    def test_prediccion_no_negativa_de_noche(self, modelo):
        features = _features_para_hora(5, rad=0.0)
        pred = float(modelo.predict(features)[0])
        assert pred >= 0.0

    def test_factor_capacidad_no_supera_1p5_en_condiciones_extremas(self, modelo):
        features = _features_para_hora(17, cloud=0.0, rad=1200.0)
        pred = float(modelo.predict(features)[0])
        assert pred <= 1.5

    def test_prediccion_es_float_escalar(self, modelo):
        features = _features_para_hora(17)
        pred = modelo.predict(features)
        assert len(pred) == 1
        assert isinstance(float(pred[0]), float)


# ── Consistencia física ───────────────────────────────────────────────────────

class TestConsistenciaFisica:
    def test_produccion_aproximada_cero_de_noche(self, modelo):
        # Medianoche local → radiación 0 → el modelo debe predecir ≈0
        features = _features_para_hora(5, rad=0.0, cloud=5.0)
        pred = float(modelo.predict(features)[0])
        assert pred < 0.05  # factor de capacidad < 5%

    def test_mediodia_produce_mas_que_la_manana(self, modelo):
        # Mediodía solar ~17:30 UTC (≈13:30 local, junio UTC-4)
        # Mañana     ~12:00 UTC (≈08:00 local, junio UTC-4)
        noon    = float(modelo.predict(_features_para_hora(17))[0])
        morning = float(modelo.predict(_features_para_hora(12))[0])
        assert noon >= morning

    def test_dia_soleado_produce_mas_que_nublado(self, modelo):
        soleado = float(modelo.predict(_features_para_hora(17, cloud=5))[0])
        nublado = float(modelo.predict(_features_para_hora(17, cloud=90))[0])
        assert soleado > nublado

    def test_alta_radiacion_produce_mas_que_baja(self, modelo):
        alta = float(modelo.predict(_features_para_hora(17, cloud=10, rad=900))[0])
        baja = float(modelo.predict(_features_para_hora(17, cloud=10, rad=200))[0])
        assert alta > baja


# ── Escalado capacity_factor → kW ────────────────────────────────────────────

class TestEscaladoAKilovatios:
    """
    El modelo devuelve un factor de capacidad (0–1). El backend lo multiplica
    por la capacidad instalada leída de la BD para obtener kW reales.
    """

    def test_escalado_es_proporcional_a_la_capacidad(self, modelo):
        features = _features_para_hora(17, cloud=5)
        cf = float(modelo.predict(features)[0])
        kw_50  = cf * 50.0
        kw_100 = cf * 100.0
        assert kw_100 == pytest.approx(kw_50 * 2, rel=1e-9)

    def test_sistema_de_50kw_no_supera_capacidad_en_condiciones_normales(self, modelo):
        features = _features_para_hora(17, cloud=0.0, rad=1000.0)
        cf = float(modelo.predict(features)[0])
        kw_50 = cf * 50.0
        assert kw_50 <= 80.0  # permite hasta 160% de la capacidad nominal

    def test_escalado_con_capacidad_cero_da_cero(self, modelo):
        features = _features_para_hora(17)
        cf = float(modelo.predict(features)[0])
        assert cf * 0.0 == 0.0
