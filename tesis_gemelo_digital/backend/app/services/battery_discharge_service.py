"""
Battery Discharge Estimation Service - Calculates time until battery depletion.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .ml_prediction_service import predict_for_specific_hours
from .consumption_prediction_service import predict_consumption_for_specific_hours
from .system_config import get_system_config


async def calculate_battery_discharge_time(
    start_hour: int,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculate time until battery reaches empty (0%) level.

    Simulates battery discharge/charge based on predicted production and consumption,
    starting from a given hour with batteries at 100% charge.

    Args:
        start_hour: Starting hour (0-23) to begin simulation
        date: Date in ISO format ('YYYY-MM-DD'). If None, uses today.

    Returns:
        Dictionary with:
        - minutesToEmpty: Minutes until battery reaches 0% (or None if never)
        - startHour: The starting hour provided
        - batteryCapacityKwh: Total battery capacity used for calculation

    Raises:
        ValueError: If start_hour is invalid or models not loaded
    """
    # Validate start_hour
    if not (0 <= start_hour <= 23):
        raise ValueError("start_hour must be between 0 and 23")

    # Get system configuration
    try:
        config = get_system_config()
    except Exception as e:
        raise RuntimeError(f"Failed to get system configuration: {e}")

    battery_capacity_kwh = config["battery"]["capacityKwh"]
    if battery_capacity_kwh <= 0:
        raise ValueError("Battery capacity must be greater than 0")

    # Determine date
    if date is None:
        target_date = datetime.now().date()
    else:
        try:
            target_date = datetime.fromisoformat(date).date()
        except Exception as e:
            raise ValueError(f"Invalid date format. Expected 'YYYY-MM-DD': {e}")

    # Generate hours to simulate (from start_hour to end of day + next day)
    hours_to_simulate = list(range(start_hour, 24))

    # Also simulate next day to ensure we have enough data
    next_day = target_date + timedelta(days=1)
    hours_next_day = list(range(0, 24))

    # Get predictions for both days
    date_str = target_date.isoformat()
    next_date_str = next_day.isoformat()

    lat = config["location"]["lat"]
    lon = config["location"]["lon"]

    try:
        # Get production predictions
        production_today = await predict_for_specific_hours(
            date_str,
            hours_to_simulate,
            lat,
            lon
        )
        production_tomorrow = await predict_for_specific_hours(
            next_date_str,
            hours_next_day,
            lat,
            lon
        )

        # Get consumption predictions
        consumption_today = await predict_consumption_for_specific_hours(
            date_str,
            hours_to_simulate
        )
        consumption_tomorrow = await predict_consumption_for_specific_hours(
            next_date_str,
            hours_next_day
        )
    except Exception as e:
        raise RuntimeError(f"Failed to get predictions: {e}")

    # Combine predictions from both days
    all_production = production_today + production_tomorrow
    all_consumption = consumption_today + consumption_tomorrow

    # Ensure we have matching data
    if len(all_production) != len(all_consumption):
        min_len = min(len(all_production), len(all_consumption))
        all_production = all_production[:min_len]
        all_consumption = all_consumption[:min_len]

    # Simulate battery discharge/charge
    battery_level_kwh = battery_capacity_kwh  # Start at 100%
    minutes_to_empty = None

    for i, (prod, cons) in enumerate(zip(all_production, all_consumption)):
        production_kw = prod["production_kw"]
        consumption_kw = cons["consumption_kw"]

        # Calculate energy balance for this hour (in kWh)
        balance_kwh = production_kw - consumption_kw

        # Update battery level
        battery_level_kwh += balance_kwh

        # Clamp battery level between 0 and capacity
        if battery_level_kwh > battery_capacity_kwh:
            battery_level_kwh = battery_capacity_kwh
        elif battery_level_kwh < 0:
            battery_level_kwh = 0

        # Check if battery is empty
        elapsed_minutes = (i + 1) * 60  # Each iteration is 1 hour

        if minutes_to_empty is None and battery_level_kwh <= 0:
            minutes_to_empty = elapsed_minutes
            break  # No need to continue once empty

    return {
        "minutesToEmpty": minutes_to_empty,
        "startHour": start_hour,
        "batteryCapacityKwh": round(battery_capacity_kwh, 2),
    }
