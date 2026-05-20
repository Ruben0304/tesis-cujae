/**
 * Open-Meteo API Integration
 * Servicio para obtener datos meteorológicos reales de Open-Meteo
 */

import { WeatherData, DayForecast, WeatherCondition } from '@/types';

interface OpenMeteoCurrentResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    cloud_cover: number;
    shortwave_radiation: number;
    weather_code: number;
  };
  current_units: {
    temperature_2m: string;
    wind_speed_10m: string;
  };
}

interface OpenMeteoDailyResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    cloud_cover_mean: number[];
    shortwave_radiation_sum: number[];
  };
}

/**
 * Convierte el código de clima de WMO a condición simplificada
 */
function weatherCodeToCondition(code: number): WeatherCondition {
  // WMO Weather interpretation codes
  // 0: Clear sky
  // 1-3: Mainly clear, partly cloudy, overcast
  // 45-48: Fog
  // 51-67: Drizzle and rain
  // 71-86: Snow
  // 95-99: Thunderstorm

  if (code === 0) return 'sunny';
  if (code <= 3) return code === 1 ? 'partly-cloudy' : 'cloudy';
  if (code <= 48) return 'cloudy';
  if (code <= 67) return 'rainy';
  return 'rainy';
}

/**
 * Obtiene descripción legible del clima según código WMO
 */
function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Cielo despejado',
    1: 'Principalmente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Niebla',
    48: 'Niebla con escarcha',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna intensa',
    61: 'Lluvia ligera',
    63: 'Lluvia moderada',
    65: 'Lluvia intensa',
    71: 'Nevada ligera',
    73: 'Nevada moderada',
    75: 'Nevada intensa',
    95: 'Tormenta eléctrica',
    96: 'Tormenta con granizo ligero',
    99: 'Tormenta con granizo intenso',
  };

  return descriptions[code] || 'Condiciones variables';
}

/**
 * Calcula la producción solar estimada basada en radiación
 * @param radiation W/m² - Radiación solar
 * @param capacityKw - Capacidad instalada del sistema en kW
 * @param efficiency - Eficiencia del sistema (0-1)
 */
function calculateSolarProduction(
  radiation: number,
  capacityKw: number,
  efficiency: number = 0.17
): number {
  // Fórmula simplificada: Producción = Radiación * Área * Eficiencia
  // Asumiendo ~1000 W/m² como radiación estándar para potencia nominal
  const standardRadiation = 1000;
  const productionFactor = radiation / standardRadiation;
  return capacityKw * productionFactor * efficiency * 24; // kWh/día
}

/**
 * Obtiene datos del clima desde Open-Meteo API
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  capacityKw: number,
  locationName: string = 'Ubicación'
): Promise<WeatherData> {
  try {
    // Construir URL para datos actuales
    const currentUrl = new URL('https://api.open-meteo.com/v1/forecast');
    currentUrl.searchParams.set('latitude', lat.toString());
    currentUrl.searchParams.set('longitude', lon.toString());
    currentUrl.searchParams.set('current', [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'cloud_cover',
      'shortwave_radiation',
      'weather_code',
    ].join(','));
    currentUrl.searchParams.set('timezone', 'auto');

    // Construir URL para pronóstico diario
    const dailyUrl = new URL('https://api.open-meteo.com/v1/forecast');
    dailyUrl.searchParams.set('latitude', lat.toString());
    dailyUrl.searchParams.set('longitude', lon.toString());
    dailyUrl.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'weather_code',
      'cloud_cover_mean',
      'shortwave_radiation_sum',
    ].join(','));
    dailyUrl.searchParams.set('forecast_days', '7');
    dailyUrl.searchParams.set('timezone', 'auto');

    // Realizar llamadas en paralelo
    const [currentRes, dailyRes] = await Promise.all([
      fetch(currentUrl.toString(), { cache: 'no-store' }),
      fetch(dailyUrl.toString(), { cache: 'no-store' }),
    ]);

    if (!currentRes.ok || !dailyRes.ok) {
      throw new Error('Failed to fetch weather data from Open-Meteo');
    }

    const currentData: OpenMeteoCurrentResponse = await currentRes.json();
    const dailyData: OpenMeteoDailyResponse = await dailyRes.json();

    // Mapear días del pronóstico
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const forecast: DayForecast[] = dailyData.daily.time.map((date, idx) => {
      const dateObj = new Date(date);
      const avgRadiation = dailyData.daily.shortwave_radiation_sum[idx] / 24; // Aproximación a promedio horario

      return {
        date,
        dayOfWeek: dayNames[dateObj.getDay()],
        maxTemp: dailyData.daily.temperature_2m_max[idx],
        minTemp: dailyData.daily.temperature_2m_min[idx],
        solarRadiation: Math.round(avgRadiation),
        cloudCover: Math.round(dailyData.daily.cloud_cover_mean[idx]),
        predictedProduction: calculateSolarProduction(avgRadiation, capacityKw),
        condition: weatherCodeToCondition(dailyData.daily.weather_code[idx]),
      };
    });

    const weatherData: WeatherData = {
      temperature: currentData.current.temperature_2m,
      solarRadiation: Math.round(currentData.current.shortwave_radiation),
      cloudCover: Math.round(currentData.current.cloud_cover),
      humidity: Math.round(currentData.current.relative_humidity_2m),
      windSpeed: currentData.current.wind_speed_10m,
      forecast,
      provider: 'Open-Meteo API',
      locationName,
      lastUpdated: new Date().toISOString(),
      description: getWeatherDescription(currentData.current.weather_code),
    };

    return weatherData;
  } catch (error) {
    console.error('Error fetching Open-Meteo data:', error);
    throw error;
  }
}

/**
 * Obtiene datos meteorológicos con fallback a mock
 */
export async function getWeatherWithFallback(
  lat: number,
  lon: number,
  capacityKw: number,
  locationName: string = 'Ubicación'
): Promise<WeatherData> {
  try {
    // Intentar obtener datos reales de Open-Meteo
    return await fetchOpenMeteoWeather(lat, lon, capacityKw, locationName);
  } catch (error) {
    console.warn('Failed to fetch Open-Meteo data, using mock data as fallback:', error);

    // Fallback a datos mock
    const { generateWeatherData } = await import('./mockData');
    const mockWeather = await generateWeatherData(capacityKw);

    return {
      ...mockWeather,
      provider: 'Datos simulados (Open-Meteo no disponible)',
      locationName,
      lastUpdated: new Date().toISOString(),
    };
  }
}
