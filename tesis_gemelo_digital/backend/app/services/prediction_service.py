"""
Prediction and projection helpers migrated from the Next.js implementation.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional

from .blackout_service import get_blackouts_for_range
from .system_config import get_system_config
from .weather_service import get_weather_with_fallback

DEFAULT_PANEL_EFFICIENCY = 0.2
BLACKOUT_LOAD_FACTOR = 0.6
BLACKOUT_PRODUCTION_FACTOR = 0.85
BLACKOUT_CONFIDENCE_PENALTY = 12


def _parse_iso(date_str: str) -> datetime:
    if date_str.endswith("Z"):
        date_str = date_str[:-1] + "+00:00"
    return datetime.fromisoformat(date_str)


def _flatten_blackout_windows(blackouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    windows: List[Dict[str, Any]] = []
    for schedule in blackouts or []:
        for idx, interval in enumerate(schedule.get("intervals", [])):
            start = _parse_iso(interval["start"])
            end = _parse_iso(interval["end"])
            if start < end:
                windows.append(
                    {
                        "start": start,
                        "end": end,
                        "schedule": schedule,
                        "intervalIndex": idx,
                        "interval": interval,
                    }
                )
    return sorted(windows, key=lambda item: item["start"])


def _resolve_blackout_intensity(window: Dict[str, Any]) -> str:
    duration = window["interval"].get("durationMinutes")
    if duration is not None:
        return "severo" if duration >= 180 else "moderado"
    diff_hours = (window["end"] - window["start"]).total_seconds() / 3600
    return "severo" if diff_hours >= 3 else "moderado"


def _describe_blackout_window(window: Dict[str, Any]) -> Optional[str]:
    notes = window["schedule"].get("notes")
    if notes and notes.strip():
        return notes.strip()
    start_label = window["start"].strftime("%A %H:%M")
    end_label = window["end"].strftime("%H:%M")
    return f"Apagón programado {start_label} - {end_label}"


def _resolve_solar_context(config: Dict[str, Any]) -> Dict[str, float]:
    solar = config["solar"]
    capacity_kw = solar.get("capacityKw") or 0
    panel_efficiency = (
        (solar.get("panelEfficiencyPercent") or 0) / 100 if solar.get("panelEfficiencyPercent") else DEFAULT_PANEL_EFFICIENCY
    )
    panel_area = solar.get("panelAreaM2") or (solar.get("panelRatedKw") or 0) / max(panel_efficiency, 0.0001)
    array_area = panel_area * (solar.get("panelCount") or 1)
    return {
        "capacityKw": capacity_kw,
        "panelEfficiency": panel_efficiency,
        "arrayAreaM2": array_area,
    }


def _get_hour_efficiency_factor(hour: int) -> float:
    if 12 <= hour <= 14:
        return 1.0
    if 11 <= hour <= 15:
        return 0.95
    if 10 <= hour <= 16:
        return 0.85
    if 8 <= hour <= 17:
        return 0.70
    if 7 <= hour <= 18:
        return 0.50
    if 6 <= hour <= 19:
        return 0.30
    return 0.0


def predict_production(
    solar_radiation: float,
    temperature: float,
    cloud_cover: float,
    hour: int,
    context: Dict[str, float],
) -> float:
    production = (solar_radiation * context["arrayAreaM2"] * context["panelEfficiency"]) / 1000
    temp_factor = 1 - (temperature - 25) * 0.004
    production *= temp_factor
    cloud_factor = 1 - (cloud_cover / 100) * 0.5
    production *= cloud_factor
    production *= _get_hour_efficiency_factor(hour)
    production = min(production, context["capacityKw"])
    if hour < 6 or hour > 20:
        production = 0
    return round(max(0.0, production), 2)


def _estimate_hourly_solar_radiation(hour: int, daily_avg: float, cloud_cover: float) -> float:
    peak_hour = 13
    sigma = 4
    gaussian = math.exp(-((hour - peak_hour) ** 2) / (2 * sigma**2))
    radiation = daily_avg * gaussian * 1.8
    cloud_variability = 1 - (random.random() * cloud_cover / 200)
    radiation *= cloud_variability
    return max(0.0, round(radiation))


def _estimate_hourly_temperature(hour: int, max_temp: float, min_temp: float) -> float:
    amplitude = (max_temp - min_temp) / 2
    average = (max_temp + min_temp) / 2
    phase = ((hour - 6) / 24) * 2 * math.pi
    temp = average + amplitude * math.sin(phase)
    return round(temp, 1)


def _predict_consumption(hour: int) -> float:
    base_day = 35
    base_night = 18
    if 7 <= hour <= 9 or 18 <= hour <= 22:
        return base_day * 1.3
    if 6 <= hour < 18:
        return base_day
    return base_night


def _calculate_prediction_confidence(hours_ahead: int, cloud_cover: float) -> float:
    confidence = 95 - (hours_ahead * 2)
    cloud_uncertainty = cloud_cover / 5
    confidence -= cloud_uncertainty
    return max(50, min(95, confidence))


def generate_hourly_predictions(weather_forecast: List[Dict[str, Any]], config: Dict[str, Any]) -> List[Dict[str, Any]]:
    predictions: List[Dict[str, Any]] = []
    # Hora local de La Habana (no UTC): la curva diaria y el corte día/noche se
    # calculan sobre la hora solar local, si no la producción "actual" sale
    # desfasada ~5 h (y de noche siempre 0).
    now = datetime.now(ZoneInfo("America/Havana")).replace(tzinfo=None)
    context = _resolve_solar_context(config)
    fallback_forecast = weather_forecast[0] if weather_forecast else None

    for hour_offset in range(24):
        timestamp = now + timedelta(hours=hour_offset)
        hour = timestamp.hour
        forecast_candidate = weather_forecast[0] if hour_offset < 12 else (weather_forecast[1] if len(weather_forecast) > 1 else None)
        forecast = forecast_candidate or fallback_forecast
        if not forecast:
            continue

        solar_radiation = _estimate_hourly_solar_radiation(hour, forecast["solarRadiation"], forecast["cloudCover"])
        temperature = _estimate_hourly_temperature(hour, forecast["maxTemp"], forecast["minTemp"])
        production = predict_production(solar_radiation, temperature, forecast["cloudCover"], hour, context)
        consumption = _predict_consumption(hour)
        confidence = _calculate_prediction_confidence(hour_offset, forecast["cloudCover"])

        predictions.append(
            {
                "timestamp": timestamp.isoformat(),
                "hour": hour,
                "expectedProduction": round(production, 2),
                "expectedConsumption": round(consumption, 2),
                "confidence": round(confidence),
            }
        )

    return predictions


def apply_blackout_adjustments(predictions: List[Dict[str, Any]], blackouts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not blackouts:
        return predictions
    windows = _flatten_blackout_windows(blackouts)
    if not windows:
        return predictions

    adjusted: List[Dict[str, Any]] = []
    for prediction in predictions:
        timestamp = _parse_iso(prediction["timestamp"])
        blackout_window = next((window for window in windows if window["start"] <= timestamp < window["end"]), None)
        if not blackout_window:
            adjusted.append(prediction)
            continue

        adjusted_production = max(
            0.0,
            round(prediction["expectedProduction"] * BLACKOUT_PRODUCTION_FACTOR, 2),
        )
        adjusted_consumption = max(
            0.0,
            round(prediction["expectedConsumption"] * BLACKOUT_LOAD_FACTOR, 2),
        )
        blackout_impact = {
            "intervalStart": blackout_window["interval"]["start"],
            "intervalEnd": blackout_window["interval"]["end"],
            "loadFactor": BLACKOUT_LOAD_FACTOR,
            "productionFactor": BLACKOUT_PRODUCTION_FACTOR,
            "intensity": _resolve_blackout_intensity(blackout_window),
            "note": _describe_blackout_window(blackout_window),
        }
        adjusted.append(
            {
                **prediction,
                "expectedProduction": adjusted_production,
                "expectedConsumption": adjusted_consumption,
                "confidence": max(40, prediction["confidence"] - BLACKOUT_CONFIDENCE_PENALTY),
                "blackoutImpact": blackout_impact,
            }
        )
    return adjusted


def build_projected_solar_timeline(
    predictions: List[Dict[str, Any]],
    battery_capacity_kwh: float,
    initial_battery_level: float = 55,
    blackouts: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    timeline: List[Dict[str, Any]] = []
    stored_energy = (initial_battery_level / 100) * battery_capacity_kwh
    windows = _flatten_blackout_windows(blackouts or [])

    for prediction in predictions[:24]:
        production = max(0.0, prediction["expectedProduction"])
        consumption = max(0.0, prediction["expectedConsumption"])
        net = production - consumption
        grid_export = 0.0
        grid_import = 0.0
        battery_delta = 0.0
        timestamp = _parse_iso(prediction["timestamp"])
        blackout_active = any(window["start"] <= timestamp < window["end"] for window in windows)

        if net >= 0:
            available_capacity = battery_capacity_kwh - stored_energy
            energy_to_battery = min(net, available_capacity)
            stored_energy += energy_to_battery
            battery_delta = energy_to_battery
            grid_export = net - energy_to_battery
        else:
            demand = abs(net)
            energy_from_battery = min(stored_energy, demand)
            stored_energy -= energy_from_battery
            battery_delta = -energy_from_battery
            grid_import = 0.0 if blackout_active else demand - energy_from_battery

        battery_level = max(0.0, min(100.0, (stored_energy / battery_capacity_kwh) * 100))
        efficiency = max(75.0, min(96.0, 82 + (prediction["confidence"] - 70) * 0.25))

        timeline.append(
            {
                "timestamp": prediction["timestamp"],
                "production": round(production, 2),
                "consumption": round(consumption, 2),
                "batteryLevel": round(battery_level, 2),
                "gridExport": round(grid_export, 2),
                "gridImport": round(grid_import, 2),
                "efficiency": round(efficiency, 2),
                "batteryDelta": round(battery_delta, 2),
            }
        )

    return timeline


def generate_battery_projection(
    timeline: List[Dict[str, Any]],
    predictions: List[Dict[str, Any]],
    battery_capacity_kwh: float,
) -> Dict[str, Any]:
    first_entry = timeline[0] if timeline else None
    stored_energy = (
        (first_entry["batteryLevel"] / 100) * battery_capacity_kwh if first_entry else (55 / 100) * battery_capacity_kwh
    )
    projected_min_level = min((entry["batteryLevel"] for entry in timeline), default=55.0)
    projected_max_level = max((entry["batteryLevel"] for entry in timeline), default=55.0)
    upcoming_consumption = predictions[0]["expectedConsumption"] if predictions else 0
    autonomy_hours = stored_energy / upcoming_consumption if upcoming_consumption else 999
    battery_delta = first_entry["batteryDelta"] if first_entry else 0

    return {
        "chargeLevel": round(first_entry["batteryLevel"] if first_entry else 55.0, 2),
        "capacity": battery_capacity_kwh,
        "current": round(stored_energy, 2),
        "autonomyHours": round(autonomy_hours, 1),
        "charging": battery_delta >= 0,
        "powerFlow": round(battery_delta, 2),
        "projectedMinLevel": round(projected_min_level, 2),
        "projectedMaxLevel": round(projected_max_level, 2),
        "note": "Estimación basada en clima y ficha técnica. No hay telemetría en vivo.",
    }


def generate_alerts(
    predictions: List[Dict[str, Any]],
    battery_status: Dict[str, Any],
    weather_forecast: List[Dict[str, Any]],
    blackouts: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    starting_level = battery_status["chargeLevel"]
    projected_min = battery_status.get("projectedMinLevel", starting_level)
    blackout_windows = _flatten_blackout_windows(blackouts or [])

    if projected_min < 20:
        alerts.append(
            {
                "id": "battery-low",
                "type": "warning",
                "title": "Reserva de Batería Limitada",
                "message": f"Proyección mínima de {projected_min:.1f}% sin telemetría. Considere reducir consumos continuos.",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
    if projected_min < 10:
        alerts.append(
            {
                "id": "battery-critical",
                "type": "critical",
                "title": "Reserva Crítica Estimada",
                "message": f"La proyección indica un mínimo de {projected_min:.1f}%. Asegure respaldo externo.",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    tomorrow = weather_forecast[1] if len(weather_forecast) > 1 else None
    if tomorrow and tomorrow["predictedProduction"] < 150:
        alerts.append(
            {
                "id": "low-production-forecast",
                "type": "warning",
                "title": "Baja Producción Esperada",
                "message": f"Se espera baja producción mañana ({tomorrow['predictedProduction']:.0f} kWh) debido a condiciones climáticas.",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    today_forecast = weather_forecast[0] if weather_forecast else None
    if today_forecast and today_forecast["predictedProduction"] > 350:
        alerts.append(
            {
                "id": "high-production-forecast",
                "type": "info",
                "title": "Excelente Producción Esperada",
                "message": f"Se espera alta producción hoy ({today_forecast['predictedProduction']:.0f} kWh). Buen momento para cargas intensivas.",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    next_6_hours = predictions[:6]
    if next_6_hours:
        avg_deficit = sum(max(0.0, p["expectedConsumption"] - p["expectedProduction"]) for p in next_6_hours) / len(
            next_6_hours
        )
        if avg_deficit > 10 and projected_min < 50:
            alerts.append(
                {
                    "id": "deficit-warning",
                    "type": "warning",
                    "title": "Déficit Energético Próximo",
                    "message": f"Se espera déficit promedio de {avg_deficit:.1f} kW en las próximas 6 horas. Considere reducir consumo no esencial.",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

    now = datetime.utcnow()
    upcoming_blackout = next((window for window in blackout_windows if window["start"] > now), None)
    if upcoming_blackout:
        start_label = upcoming_blackout["start"].strftime("%H:%Mh")
        end_label = upcoming_blackout["end"].strftime("%H:%Mh")
        severity = "critical" if (upcoming_blackout["interval"].get("durationMinutes") or 0) > 180 else "warning"
        alerts.append(
            {
                "id": f"planned-blackout-{int(upcoming_blackout['start'].timestamp())}",
                "type": severity,
                "title": "Apagón Programado",
                "message": f"Se ha planificado una interrupción entre {start_label} y {end_label}. Prepárese con antelación.",
                "timestamp": datetime.utcnow().isoformat(),
            }
        )

    return alerts


def generate_recommendations(
    predictions: List[Dict[str, Any]],
    battery_status: Dict[str, Any],
    config: Dict[str, Any],
    blackouts: Optional[List[Dict[str, Any]]] = None,
) -> List[str]:
    recommendations: List[str] = []
    solar_capacity = max(config["solar"].get("capacityKw") or 0.0001, 0.0001)
    current_prediction = predictions[0] if predictions else None
    current_production = current_prediction["expectedProduction"] if current_prediction else 0
    current_consumption = current_prediction["expectedConsumption"] if current_prediction else 0
    battery_level = battery_status["chargeLevel"]
    projected_min = battery_status.get("projectedMinLevel", battery_level)
    projected_max = battery_status.get("projectedMaxLevel", battery_level)

    if current_production > current_consumption * 1.2:
        recommendations.append("Se proyecta excedente solar inmediato. Buen momento para programar cargas intensivas supervisadas.")

    next_three = predictions[:3]
    if next_three:
        avg_production = sum(item["expectedProduction"] for item in next_three) / len(next_three)
        if projected_min < 40 and avg_production > 30:
            recommendations.append(
                "Aunque la reserva es limitada, se espera repunte solar en pocas horas. Posponga consumos pesados hasta después del pico solar."
            )

    current_hour = datetime.utcnow().hour
    if 9 <= current_hour <= 11 and projected_max < 85:
        recommendations.append(
            "Se aproximan las horas de mayor producción (12-14h). Coordine actividades de alto consumo dentro de esa ventana."
        )
    if 16 <= current_hour <= 18 and projected_min < 50:
        recommendations.append(
            "La producción solar caerá al atardecer. Asegure carga mínima o reduzca consumos no esenciales esta noche."
        )
    if current_production > solar_capacity * 0.8:
        recommendations.append(
            f"La proyección indica operación cercana al {(current_production / solar_capacity) * 100:.0f}% de la capacidad instalada. Aproveche para tareas que requieran potencia."
        )
    if current_prediction and current_prediction["expectedProduction"] < solar_capacity * 0.3:
        recommendations.append(
            "Día de baja producción estimada. Priorice consumos esenciales y considere apoyo de la red para cargas críticas."
        )

    blackout_windows = _flatten_blackout_windows(blackouts or [])
    blackout_now = current_prediction.get("blackoutImpact") if current_prediction else None
    if blackout_now:
        recommendations.append(
            "Durante el apagón programado actual, reserve energía para cargas imprescindibles y supervise el nivel de batería cada hora."
        )
    midnight = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    upcoming = next((window for window in blackout_windows if window["start"] >= midnight), None)
    if upcoming and not blackout_now:
        start_info = upcoming["start"].strftime("%A %H:%M")
        recommendations.append(
            f"Planifique el consumo crítico antes de {start_info}. Mantenga la batería por encima del 60% previo al apagón."
        )

    return recommendations


async def get_predictions_bundle() -> Dict[str, Any]:
    config = get_system_config()
    now = datetime.utcnow()
    range_end = now + timedelta(days=2)
    blackouts = get_blackouts_for_range(now, range_end)
    weather_data = await get_weather_with_fallback(
        config["location"]["lat"],
        config["location"]["lon"],
        config["solar"]["capacityKw"],
        config["location"]["name"],
    )
    predictions = generate_hourly_predictions(weather_data["forecast"], config)
    adjusted_predictions = apply_blackout_adjustments(predictions, blackouts)
    timeline = build_projected_solar_timeline(
        adjusted_predictions,
        config["battery"]["capacityKwh"],
        55,
        blackouts,
    )
    battery_projection = generate_battery_projection(
        timeline,
        adjusted_predictions,
        config["battery"]["capacityKwh"],
    )
    alerts = generate_alerts(
        adjusted_predictions,
        battery_projection,
        weather_data["forecast"],
        blackouts,
    )
    recommendations = generate_recommendations(
        adjusted_predictions,
        battery_projection,
        config,
        blackouts,
    )
    return {
        "predictions": adjusted_predictions,
        "alerts": alerts,
        "recommendations": recommendations,
        "battery": battery_projection,
        "timeline": timeline,
        "weather": weather_data,
        "timestamp": datetime.utcnow().isoformat(),
        "config": config,
        "blackouts": blackouts,
    }
