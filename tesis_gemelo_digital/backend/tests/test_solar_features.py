"""
Pruebas unitarias para app/services/solar_features.py

Verifica que build_features, función compartida entre el entrenamiento del
modelo y el backend en producción, produzca la matriz de características
correcta y sea físicamente consistente. Al estar en ambos lados de la
cadena (train y serve), cualquier error aquí rompería la coherencia del modelo.

Cubre:
- Estructura de salida (14 columnas, orden exacto, sin NaN)
- Validación de entrada (falla si el índice no tiene zona horaria)
- Consistencia física: elevación solar, índice de claridad, factor de temperatura
"""
import numpy as np
import pandas as pd
import pytest

from app.services.solar_features import (
    build_features,
    FEATURE_COLUMNS,
    DEFAULT_LAT,
    DEFAULT_LON,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _weather_df(timestamps, cloud=20.0, rad=500.0, temp=28.0, hum=70.0, wind=3.5):
    """Construye un DataFrame mínimo con las cinco columnas de Open-Meteo."""
    return pd.DataFrame(
        {
            "temperature_2m": float(temp),
            "relative_humidity_2m": float(hum),
            "wind_speed_10m": float(wind),
            "cloud_cover": float(cloud),
            "shortwave_radiation": float(rad),
        },
        index=timestamps,
    )


def _ts(*iso_strings):
    """Crea un DatetimeIndex UTC a partir de strings ISO."""
    return pd.DatetimeIndex(iso_strings, dtype="datetime64[ns, UTC]")


# ── Estructura de salida ──────────────────────────────────────────────────────

class TestEstructuraSalida:
    def test_produce_exactamente_14_columnas(self):
        ts = _ts("2015-06-15T17:30:00+00:00")
        result = build_features(_weather_df(ts))
        assert list(result.columns) == FEATURE_COLUMNS
        assert len(result.columns) == 14

    def test_numero_de_filas_igual_a_la_entrada(self):
        ts = pd.date_range("2015-06-15T12:00", periods=6, freq="h", tz="UTC")
        result = build_features(_weather_df(ts))
        assert len(result) == 6

    def test_sin_nan_en_24_horas_consecutivas(self):
        ts = pd.date_range("2015-06-15", periods=24, freq="h", tz="UTC")
        result = build_features(_weather_df(ts))
        assert not result.isnull().any().any()

    def test_sin_nan_en_rango_estacional(self):
        # Una muestra por mes durante un año
        ts = pd.date_range("2015-01-15T17:00", periods=12, freq="ME", tz="UTC")
        result = build_features(_weather_df(ts))
        assert not result.isnull().any().any()

    def test_falla_con_indice_sin_zona_horaria(self):
        ts = pd.DatetimeIndex(["2015-06-15T17:00:00"])  # naive
        with pytest.raises(ValueError, match="timezone-aware"):
            build_features(_weather_df(ts))


# ── Consistencia física ───────────────────────────────────────────────────────

class TestConsistenciaFisica:
    """Verifica que las características derivadas reflejen física solar real."""

    def test_elevacion_solar_cero_a_medianoche_local(self):
        # Madrugada (~01:00) en La Habana en junio (UTC-4) = 05:00 UTC
        # La elevación solar se recorta a 0 durante toda la noche.
        ts = _ts("2015-06-15T05:00:00+00:00")
        result = build_features(_weather_df(ts, rad=0.0))
        # La elevación se recorta a 0 para ángulos negativos
        assert result["solar_elevation"].iloc[0] == pytest.approx(0.0, abs=1.0)

    def test_elevacion_solar_alta_al_mediodia(self):
        # Mediodía solar en La Habana ≈ 17:30 UTC en junio
        ts = _ts("2015-06-15T17:30:00+00:00")
        result = build_features(_weather_df(ts, rad=850.0))
        assert result["solar_elevation"].iloc[0] > 70.0

    def test_clearsky_index_entre_0_y_1p2_siempre(self):
        ts = pd.date_range("2015-06-15", periods=24, freq="h", tz="UTC")
        result = build_features(_weather_df(ts, rad=600.0))
        assert result["clearsky_index"].between(0.0, 1.2).all()

    def test_irradiancia_efectiva_cero_con_nubosidad_total(self):
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, cloud=100.0, rad=800.0))
        assert result["effective_irradiance"].iloc[0] == pytest.approx(0.0, abs=1e-9)

    def test_irradiancia_efectiva_igual_a_rad_sin_nubes(self):
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, cloud=0.0, rad=800.0))
        assert result["effective_irradiance"].iloc[0] == pytest.approx(800.0)


# ── Factor de pérdida por temperatura ────────────────────────────────────────

class TestTempLossFactor:
    def test_igual_a_1_exactamente_a_25_grados(self):
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, temp=25.0))
        assert result["temp_loss_factor"].iloc[0] == pytest.approx(1.0)

    def test_menor_a_1_por_encima_de_25_grados(self):
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, temp=35.0))
        # 1 − 0.004 × (35 − 25) = 0.96
        assert result["temp_loss_factor"].iloc[0] == pytest.approx(0.96)

    def test_igual_a_1_por_debajo_de_25_grados(self):
        # No aplica penalización por frío: clip(lower=0)
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, temp=15.0))
        assert result["temp_loss_factor"].iloc[0] == pytest.approx(1.0)

    def test_nunca_negativo(self):
        ts = _ts("2015-06-15T17:00:00+00:00")
        result = build_features(_weather_df(ts, temp=300.0))  # temperatura absurda
        assert result["temp_loss_factor"].iloc[0] >= 0.0
