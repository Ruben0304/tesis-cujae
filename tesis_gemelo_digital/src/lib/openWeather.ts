import { DayForecast, WeatherCondition, WeatherData } from '@/types';
import { DEFAULT_SYSTEM_CONFIG } from './systemDefaults';

interface OpenWeatherOneCall {
  lat: number;
  lon: number;
  timezone: string;
  current: {
    dt: number;
    sunrise?: number;
    sunset?: number;
    temp: number;
    humidity: number;
    wind_speed: number;
    clouds: number;
    uvi?: number;
    weather?: { main: string; description?: string }[];
  };
  daily: Array<{
    dt: number;
    sunrise: number;
    sunset: number;
    temp: { min: number; max: number };
    humidity: number;
    wind_speed: number;
    clouds: number;
    uvi?: number;
    pop?: number;
    weather?: { main: string; description?: string }[];
  }>;
}

interface WeatherSnapshot {
  raw: OpenWeatherOneCall;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute cache to avoid rate limits
let cachedSnapshot: WeatherSnapshot | null = null;

const { lat, lon, name } = DEFAULT_SYSTEM_CONFIG.location;

const CONDITION_MAP: Record<string, WeatherCondition> = {
  Clear: 'sunny',
  Clouds: 'cloudy',
  Rain: 'rainy',
  Drizzle: 'rainy',
  Thunderstorm: 'rainy',
  Snow: 'rainy',
  Mist: 'partly-cloudy',
  Smoke: 'partly-cloudy',
  Haze: 'partly-cloudy',
  Dust: 'partly-cloudy',
  Fog: 'partly-cloudy',
  Sand: 'partly-cloudy',
  Ash: 'partly-cloudy',
  Squall: 'rainy',
  Tornado: 'rainy',
};

const dayFormatter = new Intl.DateTimeFormat('es-ES', { weekday: 'long' });

function mapWeatherCondition(main?: string, clouds?: number, pop?: number): WeatherCondition {
  if (pop && pop >= 0.5) return 'rainy';
  if (!main) {
    if ((clouds ?? 0) < 20) return 'sunny';
    if ((clouds ?? 0) < 55) return 'partly-cloudy';
    if ((clouds ?? 0) < 80) return 'cloudy';
    return 'rainy';
  }

  const mapped = CONDITION_MAP[main];
  if (mapped) {
    if (mapped === 'cloudy' && (clouds ?? 0) < 50) return 'partly-cloudy';
    return mapped;
  }

  if ((clouds ?? 0) < 25) return 'sunny';
  if ((clouds ?? 0) < 60) return 'partly-cloudy';
  return 'cloudy';
}

function estimateSolarRadiation(uvi: number, clouds: number): number {
  const base = Math.min(1, Math.max(0, uvi / 11));
  const cloudPenalty = 1 - (clouds / 100) * 0.6;
  return Math.round(Math.max(0, 950 * base * cloudPenalty));
}

function estimateDailyProduction(
  radiation: number,
  daylightSeconds: number,
  solarCapacityKw: number
): number {
  const daylightHours = Math.max(0, daylightSeconds / 3600);
  const efficiencyFactor = 0.72; // overall capture + system loss
  const production = (radiation / 1000) * solarCapacityKw * daylightHours * efficiencyFactor;
  return Number(Math.max(0, production).toFixed(1));
}

function buildForecast(
  daily: OpenWeatherOneCall['daily'],
  solarCapacityKw: number
): DayForecast[] {
  return daily.slice(0, 7).map((day) => {
    const condition = mapWeatherCondition(day.weather?.[0]?.main, day.clouds, day.pop);
    const solarRadiation = estimateSolarRadiation(day.uvi ?? 0, day.clouds ?? 0);
    const predictedProduction = estimateDailyProduction(
      solarRadiation,
      day.sunset - day.sunrise,
      solarCapacityKw
    );

    return {
      date: new Date(day.dt * 1000).toISOString(),
      dayOfWeek: capitalizeFirst(dayFormatter.format(new Date(day.dt * 1000))),
      maxTemp: day.temp.max,
      minTemp: day.temp.min,
      solarRadiation,
      cloudCover: day.clouds,
      predictedProduction,
      condition,
    };
  });
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function transformToWeatherData(
  payload: OpenWeatherOneCall,
  solarCapacityKw: number
): WeatherData {
  const { current, daily } = payload;

  const solarRadiation = estimateSolarRadiation(current.uvi ?? 0, current.clouds ?? 0);
  const forecast = buildForecast(daily, solarCapacityKw);

  return {
    temperature: Math.round(current.temp * 10) / 10,
    solarRadiation,
    cloudCover: current.clouds ?? 0,
    humidity: current.humidity,
    windSpeed: Math.round((current.wind_speed ?? 0) * 3.6 * 10) / 10, // m/s to km/h
    forecast,
    provider: 'OpenWeather • One Call 2.5',
    locationName: name,
    lastUpdated: new Date((current.dt ?? Date.now() / 1000) * 1000).toISOString(),
    description: current.weather?.[0]?.description,
  };
}

export async function fetchOpenWeatherSnapshot(force = false): Promise<WeatherSnapshot> {
  if (!force && cachedSnapshot && Date.now() - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY environment variable is not set');
  }

  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    appid: apiKey,
    units: 'metric',
    lang: 'es',
    exclude: 'minutely,alerts',
  });

  const response = await fetch(`https://api.openweathermap.org/data/2.5/onecall?${params.toString()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenWeather request failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as OpenWeatherOneCall;

  cachedSnapshot = {
    raw: payload,
    fetchedAt: Date.now(),
  };

  return cachedSnapshot;
}

export async function getLiveWeatherData(solarCapacityKw: number) {
  const snapshot = await fetchOpenWeatherSnapshot();
  return transformToWeatherData(snapshot.raw, solarCapacityKw);
}

export function clearWeatherCache() {
  cachedSnapshot = null;
}
