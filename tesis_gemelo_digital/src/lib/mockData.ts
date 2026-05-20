import {
  SolarData,
  WeatherData,
  DayForecast,
  BatteryStatus,
  WeatherCondition,
  Prediction,
  BlackoutSchedule,
} from '@/types';
import { format, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getLiveWeatherData } from './openWeather';

const BASE_CONSUMPTION_DAY = 35;
const BASE_CONSUMPTION_NIGHT = 18;

const FALLBACK_SCENARIOS: Array<'sunny' | 'partly-cloudy' | 'cloudy'> = [
  'sunny',
  'sunny',
  'partly-cloudy',
  'cloudy',
  'partly-cloudy',
  'sunny',
  'cloudy',
];

function getFallbackCondition(cloudCover: number): WeatherCondition {
  if (cloudCover < 20) return 'sunny';
  if (cloudCover < 50) return 'partly-cloudy';
  if (cloudCover < 80) return 'cloudy';
  return 'rainy';
}

function generateFallbackSolarRadiation(hour: number, cloudCover: number): number {
  const maxRadiation = 1000;
  const peakHour = 13;
  const sigma = 4;
  const gaussian = Math.exp(-Math.pow(hour - peakHour, 2) / (2 * Math.pow(sigma, 2)));
  let radiation = maxRadiation * gaussian;
  const cloudFactor = 1 - (cloudCover / 100) * 0.7;
  radiation *= cloudFactor;

  if (hour < 6 || hour > 20) {
    radiation = 0;
  }

  return Math.round(radiation);
}

function generateFallbackForecast(solarCapacityKw: number): DayForecast[] {
  const forecast: DayForecast[] = [];
  const today = startOfDay(new Date());

  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    const scenario = FALLBACK_SCENARIOS[i % FALLBACK_SCENARIOS.length];

    let cloudCover: number;
    let avgRadiation: number;

    if (scenario === 'sunny') {
      cloudCover = 5 + Math.random() * 15;
      avgRadiation = 850 + Math.random() * 120;
    } else if (scenario === 'partly-cloudy') {
      cloudCover = 30 + Math.random() * 20;
      avgRadiation = 600 + Math.random() * 150;
    } else {
      cloudCover = 70 + Math.random() * 20;
      avgRadiation = 300 + Math.random() * 170;
    }

    const predictedProduction = (avgRadiation / 1000) * solarCapacityKw * 8 * (1 - cloudCover / 200);
    const baseTemp = 18 + Math.random() * 8;

    forecast.push({
      date: date.toISOString(),
      dayOfWeek: format(date, 'EEEE', { locale: es }),
      maxTemp: Math.round((baseTemp + 5 + Math.random() * 3) * 10) / 10,
      minTemp: Math.round((baseTemp - 3 + Math.random() * 2) * 10) / 10,
      solarRadiation: Math.round(avgRadiation),
      cloudCover: Math.round(cloudCover),
      predictedProduction: Math.round(Math.max(0, predictedProduction) * 10) / 10,
      condition: getFallbackCondition(cloudCover),
    });
  }

  return forecast;
}

function generateFallbackWeatherData(solarCapacityKw: number): WeatherData {
  const hour = new Date().getHours();
  const cloudCover = 15 + Math.random() * 25;
  const solarRadiation = generateFallbackSolarRadiation(hour, cloudCover);
  const baseTemp = 20;
  const tempVariation = 8 * Math.sin(((hour - 6) * Math.PI) / 12);
  const temperature = baseTemp + tempVariation + (Math.random() * 2 - 1);
  const forecast = generateFallbackForecast(solarCapacityKw);

  return {
    temperature: Math.round(temperature * 10) / 10,
    solarRadiation,
    cloudCover: Math.round(cloudCover),
    humidity: Math.round(50 + Math.random() * 30),
    windSpeed: Math.round(5 + Math.random() * 15),
    forecast,
    provider: 'Simulación interna (fallback)',
    locationName: 'Ubicación simulada',
    lastUpdated: new Date().toISOString(),
    description: 'Datos simulados por indisponibilidad de OpenWeather',
  };
}

export async function generateWeatherData(solarCapacityKw: number): Promise<WeatherData> {
  try {
    return await getLiveWeatherData(solarCapacityKw);
  } catch (error) {
    console.warn('Fallo al obtener datos de OpenWeather. Usando datos simulados.', error);
    return generateFallbackWeatherData(solarCapacityKw);
  }
}

export function buildProjectedSolarTimeline(
  predictions: Prediction[],
  batteryCapacityKwh: number,
  initialBatteryLevel: number = 55,
  blackouts: BlackoutSchedule[] = []
): SolarData[] {
  const timeline: SolarData[] = [];
  let storedEnergy = (initialBatteryLevel / 100) * batteryCapacityKwh;
  const blackoutWindows = blackouts.flatMap((schedule) =>
    schedule.intervals.map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end),
    }))
  );

  predictions.slice(0, 24).forEach((prediction) => {
    const production = Math.max(0, prediction.expectedProduction);
    const consumption = Math.max(0, prediction.expectedConsumption);
    const net = production - consumption;

    let gridExport = 0;
    let gridImport = 0;
    let batteryDelta = 0;

    const timestamp = new Date(prediction.timestamp);
    const blackoutActive = blackoutWindows.some(
      (window) => timestamp >= window.start && timestamp < window.end
    );

    if (net >= 0) {
      const availableCapacity = batteryCapacityKwh - storedEnergy;
      const energyToBattery = Math.min(net, availableCapacity);
      storedEnergy += energyToBattery;
      batteryDelta = energyToBattery;
      gridExport = net - energyToBattery;
    } else {
      const demand = Math.abs(net);
      const energyFromBattery = Math.min(storedEnergy, demand);
      storedEnergy -= energyFromBattery;
      batteryDelta = -energyFromBattery;
      gridImport = blackoutActive ? 0 : demand - energyFromBattery;
    }

    const batteryLevel = Math.max(0, Math.min(100, (storedEnergy / batteryCapacityKwh) * 100));
    const efficiency = Math.max(
      75,
      Math.min(96, 82 + (prediction.confidence - 70) * 0.25)
    );

    timeline.push({
      timestamp: prediction.timestamp,
      production: Math.round(production * 100) / 100,
      consumption: Math.round(consumption * 100) / 100,
      batteryLevel: Math.round(batteryLevel * 100) / 100,
      gridExport: Math.round(gridExport * 100) / 100,
      gridImport: Math.round(gridImport * 100) / 100,
      efficiency: Math.round(efficiency * 100) / 100,
      batteryDelta: Math.round(batteryDelta * 100) / 100,
    });
  });

  return timeline;
}

export function generateBatteryProjection(
  timeline: SolarData[],
  predictions: Prediction[],
  batteryCapacityKwh: number
): BatteryStatus {
  const firstEntry = timeline[0];
  const storedEnergy = firstEntry
    ? (firstEntry.batteryLevel / 100) * batteryCapacityKwh
    : (55 / 100) * batteryCapacityKwh;

  const projectedMinLevel = Math.min(...timeline.map((entry) => entry.batteryLevel));
  const projectedMaxLevel = Math.max(...timeline.map((entry) => entry.batteryLevel));
  const upcomingConsumption = predictions[0]?.expectedConsumption ?? 0;
  const autonomyHours = upcomingConsumption > 0 ? storedEnergy / upcomingConsumption : 999;
  const batteryDelta = firstEntry?.batteryDelta ?? 0;

  return {
    chargeLevel: Math.round((firstEntry?.batteryLevel ?? 55) * 100) / 100,
    capacity: batteryCapacityKwh,
    current: Math.round(storedEnergy * 100) / 100,
    autonomyHours: Math.round(autonomyHours * 10) / 10,
    charging: batteryDelta >= 0,
    powerFlow: Math.round(batteryDelta * 100) / 100,
    projectedMinLevel: Math.round(projectedMinLevel * 100) / 100,
    projectedMaxLevel: Math.round(projectedMaxLevel * 100) / 100,
    note: 'Estimación basada en clima y ficha técnica. No hay telemetría en vivo.',
  };
}
