"""
ML Prediction Service - Uses the trained model and Open-Meteo data to predict solar production.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List

import httpx
import numpy as np
import pandas as pd

from .ml_model_service import ml_model_service


OPENMETEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_LAT = 23.1136  # La Habana, Cuba
DEFAULT_LON = -82.3666


async def fetch_open_meteo_hourly(
    lat: float,
    lon: float,
    start_date: datetime,
    end_date: datetime
) -> Dict[str, Any]:
    """
    Fetch hourly weather data from Open-Meteo API.

    Args:
        lat: Latitude
        lon: Longitude
        start_date: Start datetime
        end_date: End datetime

    Returns:
        Dictionary with hourly weather data
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "cloud_cover",
            "shortwave_radiation",
        ]),
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(OPENMETEO_BASE_URL, params=params)

    response.raise_for_status()
    return response.json()


def prepare_features_dataframe(
    weather_data: Dict[str, Any],
    target_datetimes: List[datetime]
) -> pd.DataFrame:
    """
    Prepare features DataFrame from Open-Meteo data for model prediction.

    Args:
        weather_data: Hourly weather data from Open-Meteo
        target_datetimes: List of target datetimes to predict

    Returns:
        DataFrame with features ready for model prediction
    """
    hourly = weather_data.get("hourly", {})

    # Parse datetimes from API
    api_times = [datetime.fromisoformat(t) for t in hourly.get("time", [])]

    # Create mapping from datetime to index
    time_to_idx = {t: i for i, t in enumerate(api_times)}

    features_list = []

    for target_dt in target_datetimes:
        # Find closest matching hour in API data
        # Open-Meteo returns hourly data, so we need to match to the hour
        target_hour = target_dt.replace(minute=0, second=0, microsecond=0)

        if target_hour not in time_to_idx:
            # Try to find closest match
            closest_time = min(api_times, key=lambda t: abs((t - target_hour).total_seconds()))
            idx = time_to_idx[closest_time]
        else:
            idx = time_to_idx[target_hour]

        # Extract features from API data
        temperature_2m = hourly["temperature_2m"][idx]
        relative_humidity_2m = hourly["relative_humidity_2m"][idx]
        wind_speed_10m = hourly["wind_speed_10m"][idx]
        cloud_cover = hourly["cloud_cover"][idx]
        shortwave_radiation_raw = hourly["shortwave_radiation"][idx]

        # Clip radiation to non-negative (as in training)
        shortwave_radiation = max(0, shortwave_radiation_raw)

        # Calculate temporal features (sin/cos encoding for hour and month)
        hour = target_dt.hour
        month = target_dt.month

        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        month_sin = np.sin(2 * np.pi * month / 12)
        month_cos = np.cos(2 * np.pi * month / 12)

        features_list.append({
            "temperature_2m": temperature_2m,
            "relative_humidity_2m": relative_humidity_2m,
            "wind_speed_10m": wind_speed_10m,
            "cloud_cover": cloud_cover,
            "shortwave_radiation": shortwave_radiation,
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "month_sin": month_sin,
            "month_cos": month_cos,
        })

    return pd.DataFrame(features_list)


async def predict_solar_production(
    datetimes: List[str],
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for given datetimes using the ML model and Open-Meteo data.

    Args:
        datetimes: List of ISO datetime strings to predict for
        lat: Latitude (default: La Habana, Cuba)
        lon: Longitude (default: La Habana, Cuba)

    Returns:
        List of predictions with datetime, production_kw, and weather features

    Raises:
        RuntimeError: If model is not loaded or prediction fails
        ValueError: If invalid datetime format
    """
    # Check if model is loaded
    if not ml_model_service.model_loaded:
        raise RuntimeError(
            "ML model not loaded. Please ensure the model is trained and loaded at startup."
        )

    # Parse target datetimes
    try:
        target_datetimes = [datetime.fromisoformat(dt.replace('Z', '+00:00')) for dt in datetimes]
    except Exception as e:
        raise ValueError(f"Invalid datetime format. Expected ISO format (e.g., '2025-01-15T13:00:00'): {e}")

    if not target_datetimes:
        return []

    # Determine date range for Open-Meteo API
    min_date = min(target_datetimes).date()
    max_date = max(target_datetimes).date()

    # Fetch weather data from Open-Meteo
    try:
        weather_data = await fetch_open_meteo_hourly(lat, lon, min_date, max_date)
    except Exception as e:
        raise RuntimeError(f"Failed to fetch weather data from Open-Meteo: {e}")

    # Prepare features
    features_df = prepare_features_dataframe(weather_data, target_datetimes)

    # Make predictions
    try:
        predictions_kw = ml_model_service.predict(features_df)
    except Exception as e:
        raise RuntimeError(f"Model prediction failed: {e}")

    # Format results
    results = []
    for i, (dt, pred_kw) in enumerate(zip(target_datetimes, predictions_kw)):
        results.append({
            "datetime": dt.isoformat(),
            "production_kw": round(float(pred_kw), 2),
            "weather": {
                "temperature_2m": round(float(features_df.iloc[i]["temperature_2m"]), 1),
                "relative_humidity_2m": round(float(features_df.iloc[i]["relative_humidity_2m"]), 1),
                "wind_speed_10m": round(float(features_df.iloc[i]["wind_speed_10m"]), 1),
                "cloud_cover": round(float(features_df.iloc[i]["cloud_cover"]), 1),
                "shortwave_radiation": round(float(features_df.iloc[i]["shortwave_radiation"]), 1),
            }
        })

    return results


async def predict_next_hours(
    hours: int = 24,
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for the next N hours.

    Args:
        hours: Number of hours to predict (default: 24)
        lat: Latitude (default: La Habana, Cuba)
        lon: Longitude (default: La Habana, Cuba)

    Returns:
        List of hourly predictions
    """
    now = datetime.utcnow()
    target_datetimes = [
        (now + timedelta(hours=h)).isoformat()
        for h in range(hours)
    ]

    return await predict_solar_production(target_datetimes, lat, lon)


async def predict_for_date_range(
    start_date: str,
    end_date: str,
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for all hours in a date range.

    Args:
        start_date: Start date (ISO format: 'YYYY-MM-DD')
        end_date: End date (ISO format: 'YYYY-MM-DD')
        lat: Latitude
        lon: Longitude

    Returns:
        List of hourly predictions for the entire date range
    """
    try:
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
    except Exception as e:
        raise ValueError(f"Invalid date format. Expected 'YYYY-MM-DD': {e}")

    # Generate hourly timestamps
    current = start
    target_datetimes = []

    while current <= end:
        target_datetimes.append(current.isoformat())
        current += timedelta(hours=1)

    return await predict_solar_production(target_datetimes, lat, lon)


async def predict_for_specific_hours(
    date: str,
    hours: List[int],
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON
) -> List[Dict[str, Any]]:
    """
    Predict solar production for specific hours of a given day.

    Args:
        date: Date in ISO format ('YYYY-MM-DD')
        hours: List of hours (0-23) to predict for
        lat: Latitude
        lon: Longitude

    Returns:
        List of predictions for the specified hours
    """
    try:
        base_date = datetime.fromisoformat(date)
    except Exception as e:
        raise ValueError(f"Invalid date format. Expected 'YYYY-MM-DD': {e}")

    # Generate timestamps for specific hours
    target_datetimes = []
    for hour in sorted(set(hours)):  # Remove duplicates and sort
        if 0 <= hour <= 23:
            dt = base_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            target_datetimes.append(dt.isoformat())

    if not target_datetimes:
        return []

    return await predict_solar_production(target_datetimes, lat, lon)
