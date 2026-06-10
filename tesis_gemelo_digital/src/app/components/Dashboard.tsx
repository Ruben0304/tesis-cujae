'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import AdminPanel from './AdminPanel';
import SolarProductionChart from './SolarProductionChart';
import BatteryStatus from './BatteryStatus';
import WeatherToday, { LottieAnimationType } from './WeatherToday';
import WeatherForecast from './WeatherForecast';
import PredictionsPanel from './PredictionsPanel';
import FloatingBottomNav from './FloatingBottomNav';
import SolarStatsView from './SolarStatsView';
import HistorialPanel from './HistorialPanel';
import StarsBackground from './StarsBackground';
import SystemDiagram from './SystemDiagram';
import {
  SolarData,
  BatteryStatus as BatteryStatusType,
  SystemMetrics,
  WeatherData,
  Prediction,
  Alert,
  SystemConfig,
  User,
  BlackoutSchedule,
  SolarPanelConfig,
  BatteryConfig,
  InverterConfig,
  ApplianceConfig,
  EnergyFlow,
  ConsumptionPrediction,
} from '@/types';
import { ArrowPathIcon, ExclamationTriangleIcon, WifiIcon, BoltIcon, HomeIcon, Battery50Icon, SunIcon } from '@heroicons/react/24/outline';
import { executeQuery } from '@/lib/graphql-client';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/systemDefaults';
import { useRouter } from 'next/navigation';

const DASHBOARD_QUERY = `
  query DashboardData {
    solar {
      timestamp
      mode
      current {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      historical {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      battery {
        chargeLevel
        capacity
        current
        autonomyHours
        charging
        powerFlow
        projectedMinLevel
        projectedMaxLevel
        note
      }
      metrics {
        currentProduction
        currentConsumption
        energyBalance
        systemEfficiency
        dailyProduction
        dailyConsumption
        co2Avoided
      }
      energyFlow {
        solarToBattery
        solarToLoad
        solarToGrid
        batteryToLoad
        gridToLoad
      }
      weather {
        temperature
        solarRadiation
        cloudCover
        humidity
        windSpeed
        provider
        locationName
        lastUpdated
        description
        forecast {
          date
          dayOfWeek
          maxTemp
          minTemp
          solarRadiation
          cloudCover
          predictedProduction
          condition
        }
      }
      config {
        location { lat lon name }
        solar {
          capacityKw
          panelRatedKw
          panelCount
          strings
          panelEfficiencyPercent
          panelAreaM2
          spec {
            _id
            manufacturer
            model
            ratedPowerKw
            quantity
            tiltDegrees
            orientation
            createdAt
            updatedAt
          }
        }
        battery {
          capacityKwh
          moduleCapacityKwh
          moduleCount
          maxDepthOfDischargePercent
          chargeRateKw
          dischargeRateKw
          efficiencyPercent
          spec {
            _id
            manufacturer
            model
            capacityKwh
            quantity
            createdAt
            updatedAt
          }
        }
      }
    }
    weather {
      temperature
      solarRadiation
      cloudCover
      humidity
      windSpeed
      provider
      locationName
      lastUpdated
      description
      forecast {
        date
        dayOfWeek
        maxTemp
        minTemp
        solarRadiation
        cloudCover
        predictedProduction
        condition
      }
    }
    predictions {
      predictions {
        timestamp
        hour
        expectedProduction
        expectedConsumption
        confidence
        blackoutImpact {
          intervalStart
          intervalEnd
          loadFactor
          productionFactor
          intensity
          note
        }
      }
      alerts {
        id
        type
        title
        message
        timestamp
      }
      recommendations
      battery {
        chargeLevel
        capacity
        current
        autonomyHours
        charging
        powerFlow
        projectedMinLevel
        projectedMaxLevel
        note
      }
      timeline {
        timestamp
        production
        consumption
        batteryLevel
        gridExport
        gridImport
        efficiency
        batteryDelta
      }
      weather {
        temperature
        solarRadiation
        cloudCover
        humidity
        windSpeed
        provider
        locationName
        lastUpdated
        description
        forecast {
          date
          dayOfWeek
          maxTemp
          minTemp
          solarRadiation
          cloudCover
          predictedProduction
          condition
        }
      }
      timestamp
      config {
        location { lat lon name }
        solar {
          capacityKw
          panelRatedKw
          panelCount
          strings
          panelEfficiencyPercent
          panelAreaM2
        }
        battery {
          capacityKwh
          moduleCapacityKwh
          moduleCount
          maxDepthOfDischargePercent
          chargeRateKw
          dischargeRateKw
          efficiencyPercent
        }
      }
      blackouts {
        _id
        date
        intervals {
          start
          end
          durationMinutes
        }
        province
        municipality
        notes
        createdAt
        updatedAt
      }
    }
    panels {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      tiltDegrees
      orientation
      createdAt
      updatedAt
    }
    batteries {
      _id
      manufacturer
      model
      capacityKwh
      quantity
      createdAt
      updatedAt
    }
    inverters {
      _id
      manufacturer
      model
      ratedPowerKw
      quantity
      efficiencyPercent
      createdAt
      updatedAt
    }
    appliances {
      _id
      name
      category
      averagePowerW
      maxPowerW
      measuredPowerW
      quantity
      activeHours
      selectedModeIndex
      modes {
        name
        averagePowerW
        maxPowerW
      }
      createdAt
      updatedAt
    }
  }
`;

type MLPrediction = {
  datetime: string;
  productionKw: number;
  weather: {
    temperature2m: number;
    relativeHumidity2m: number;
    windSpeed10m: number;
    cloudCover: number;
    shortwaveRadiation: number;
  };
};

type MLConsumptionPrediction = {
  datetime: string;
  consumptionKw: number;
};

type DashboardQueryResult = {
  solar: {
    current: SolarData;
    historical: SolarData[];
    battery: BatteryStatusType;
    metrics: SystemMetrics;
    energyFlow: EnergyFlow;
    weather: WeatherData;
    config: SystemConfig;
    timestamp: string;
    mode: string;
  };
  weather: WeatherData;
  predictions: {
    predictions: Prediction[];
    alerts: Alert[];
    recommendations: string[];
    battery: BatteryStatusType;
    timeline: SolarData[];
    weather: WeatherData;
    timestamp: string;
    config: SystemConfig;
    blackouts: BlackoutSchedule[];
  };
  panels: SolarPanelConfig[];
  batteries: BatteryConfig[];
  inverters: InverterConfig[];
  appliances: ApplianceConfig[];
};

type MLPredictionsQueryResult = {
  mlPredictForHours: MLPrediction[];
};

type MLConsumptionPredictionsQueryResult = {
  mlPredictConsumptionDateRange: MLConsumptionPrediction[];
};

// Query for ML predictions for a specific day
const ML_PREDICTIONS_QUERY = `
  query MLPredictions($date: String!, $hours: [Int!]!) {
    mlPredictForHours(date: $date, hours: $hours) {
      datetime
      productionKw
      weather {
        temperature2m
        relativeHumidity2m
        windSpeed10m
        cloudCover
        shortwaveRadiation
      }
    }
  }
`;

const ML_CONSUMPTION_PREDICTIONS_QUERY = `
  query MLPredictConsumption($startDate: String!, $endDate: String!) {
    mlPredictConsumptionDateRange(startDate: $startDate, endDate: $endDate) {
      datetime
      consumptionKw
    }
  }
`;

const PROFILE_CONSUMPTION_QUERY = `
  query ProfileConsumption($date: String!) {
    predictConsumptionProfile(date: $date) {
      datetime
      consumptionKw
      confidence
      confidencePct
      sourceLabel
      explanation
      hour
      isWeekend
    }
  }
`;

const APPLIANCES_FORECAST_QUERY = `
  query AppliancesForecast($hours: Int!, $start: String) {
    appliancesConsumptionForecast(hours: $hours, start: $start) {
      totalConsumptionKw
      appliancesWithProfile
      appliancesAlwaysOn
      points {
        datetime
        consumptionKw
      }
    }
  }
`;

const SOLAR_MODEL_INFO_QUERY = `
  query SolarModelInfo {
    mlModelInfo {
      loaded
      testR2
    }
  }
`;

const DEMO_DATA: DashboardQueryResult = {
  solar: {
    current: {
      timestamp: new Date().toISOString(),
      production: 3.5,
      consumption: 1.2,
      batteryLevel: 75,
      gridExport: 2.3,
      gridImport: 0,
      efficiency: 90,
      batteryDelta: 0,
    },
    historical: [],
    battery: {
      chargeLevel: 75,
      capacity: 10,
      current: 0,
      autonomyHours: 5,
      charging: false,
      powerFlow: 0,
      projectedMinLevel: 20,
      projectedMaxLevel: 90,
      note: 'Simulación',
    },
    metrics: {
      currentProduction: 3.5,
      currentConsumption: 1.2,
      energyBalance: 2.3,
      systemEfficiency: 90,
      dailyProduction: 20,
      dailyConsumption: 10,
      co2Avoided: 10,
    },
    energyFlow: {
      solarToBattery: 0,
      solarToLoad: 1.2,
      solarToGrid: 2.3,
      batteryToLoad: 0,
      gridToLoad: 0,
    },
    weather: {
      temperature: 26,
      solarRadiation: 800,
      cloudCover: 10,
      humidity: 60,
      windSpeed: 15,
      provider: 'Datos Demo',
      locationName: 'Ubicación Demo',
      lastUpdated: new Date().toISOString(),
      description: 'Soleado (Demo)',
      forecast: [],
    },
    config: DEFAULT_SYSTEM_CONFIG,
    timestamp: new Date().toISOString(),
    mode: 'demo',
  },
  weather: {
    temperature: 26,
    solarRadiation: 800,
    cloudCover: 10,
    humidity: 60,
    windSpeed: 15,
    provider: 'Datos Demo',
    locationName: 'Ubicación Demo',
    lastUpdated: new Date().toISOString(),
    description: 'Soleado (Demo)',
    forecast: [],
  },
  predictions: {
    predictions: [],
    alerts: [],
    recommendations: [],
    battery: {
      chargeLevel: 75,
      capacity: 10,
      current: 0,
      autonomyHours: 5,
      charging: false,
      powerFlow: 0,
      projectedMinLevel: 20,
      projectedMaxLevel: 90,
      note: 'Simulación',
    },
    timeline: [],
    weather: {
      temperature: 26,
      solarRadiation: 800,
      cloudCover: 10,
      humidity: 60,
      windSpeed: 15,
      provider: 'Datos Demo',
      locationName: 'Ubicación Demo',
      lastUpdated: new Date().toISOString(),
      description: 'Soleado (Demo)',
      forecast: [],
    },
    timestamp: new Date().toISOString(),
    config: DEFAULT_SYSTEM_CONFIG,
    blackouts: [],
  },
  panels: [],
  batteries: [],
  inverters: [],
  appliances: [],
};

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

// Helper function to predict consumption based on hour (matching backend logic)
function predictConsumption(hour: number): number {
  const baseDay = 35;
  const baseNight = 18;
  if ((hour >= 7 && hour <= 9) || (hour >= 18 && hour <= 22)) {
    return baseDay * 1.3;
  }
  if (hour >= 6 && hour < 18) {
    return baseDay;
  }
  return baseNight;
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

type AppliancesForecastResult = {
  appliancesConsumptionForecast: {
    totalConsumptionKw: number;
    appliancesWithProfile: number;
    appliancesAlwaysOn: number;
    points: { datetime: string; consumptionKw: number }[];
  };
};

function buildHourKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
}

// Transform ML predictions to SolarData format
function transformMLPredictionsToSolarData(
  mlPredictions: MLPrediction[],
  consumptionPredictions: MLConsumptionPrediction[],
  applianceForecast: { datetime: string; consumptionKw: number }[] = []
): SolarData[] {
  const consumptionMap = consumptionPredictions.reduce<Map<string, number>>((map, entry) => {
    if (!entry?.datetime) {
      return map;
    }
    map.set(entry.datetime, entry.consumptionKw);
    const normalized = normalizeTimestamp(entry.datetime);
    map.set(normalized, entry.consumptionKw);
    return map;
  }, new Map());

  const applianceMap = applianceForecast.reduce<Map<string, number>>((map, entry) => {
    if (!entry?.datetime) return map;
    map.set(buildHourKey(entry.datetime), entry.consumptionKw);
    return map;
  }, new Map());

  return mlPredictions.map((mlPred) => {
    const timestamp = new Date(mlPred.datetime);
    const hour = Number.isNaN(timestamp.getTime()) ? 0 : timestamp.getHours();
    const normalizedTimestamp = normalizeTimestamp(mlPred.datetime);
    const applianceConsumption = applianceMap.get(buildHourKey(mlPred.datetime));
    const consumption =
      applianceConsumption ??
      consumptionMap.get(mlPred.datetime) ??
      consumptionMap.get(normalizedTimestamp) ??
      predictConsumption(hour);

    return {
      timestamp: mlPred.datetime,
      production: mlPred.productionKw,
      consumption,
      batteryLevel: 0, // Will be calculated by system
      gridExport: 0,
      gridImport: 0,
      efficiency: 85, // Default efficiency estimate
      batteryDelta: 0,
    };
  });
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const router = useRouter();
  const [solarData, setSolarData] = useState<{
    current: SolarData;
    historical: SolarData[];
    battery: BatteryStatusType;
    metrics: SystemMetrics;
    config: SystemConfig;
    energyFlow?: EnergyFlow;
  } | null>(null);

  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  const [predictionsData, setPredictionsData] = useState<{
    predictions: Prediction[];
    alerts: Alert[];
    recommendations: string[];
    battery: BatteryStatusType;
    timeline: SolarData[];
    weather?: WeatherData;
    config: SystemConfig;
    blackouts?: BlackoutSchedule[];
  } | null>(null);

  const [mlPredictions, setMlPredictions] = useState<SolarData[]>([]);
  const [mlLoading, setMlLoading] = useState(false);
  const [consumptionPredictions, setConsumptionPredictions] = useState<ConsumptionPrediction[]>([]);
  const [solarModelR2, setSolarModelR2] = useState<number | null>(null);
  const [batteryConfigs, setBatteryConfigs] = useState<BatteryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeSection, setActiveSection] = useState<'overview' | 'stats' | 'admin' | 'historial'>('overview');
  const [isOffline, setIsOffline] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [bgGradient, setBgGradient] = useState('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
  const [weatherOverride, setWeatherOverride] = useState<LottieAnimationType | null>(null);

  const energyFlowData = useMemo<EnergyFlow | null>(() => {
    if (!solarData) {
      return null;
    }

    if (solarData.energyFlow) {
      return solarData.energyFlow;
    }

    const { production, consumption, gridExport, gridImport } = solarData.current;
    const batteryPower = solarData.battery.powerFlow;
    const solarToLoad = Math.min(production, consumption);
    const solarExcess = Math.max(0, production - solarToLoad);
    const batteryCharging = batteryPower > 0 ? batteryPower : 0;
    const batteryDischarging = batteryPower < 0 ? Math.abs(batteryPower) : 0;
    const solarToBattery = Math.min(solarExcess, batteryCharging);
    const solarToGrid = Math.max(gridExport, solarExcess - solarToBattery);
    const batteryToLoad = batteryDischarging;
    const gridToLoad = Math.max(
      gridImport,
      Math.max(0, consumption - solarToLoad - batteryToLoad)
    );

    return {
      solarToBattery,
      solarToLoad,
      solarToGrid,
      batteryToLoad,
      gridToLoad,
    };
  }, [solarData]);

  // Fetch ML predictions for a specific day (7am-10pm)
  const fetchMLPredictionsForDay = useCallback(async (dayOffset: number) => {
    setMlLoading(true);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const dateStr = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Hours from 7am to 10pm (7, 8, 9, ..., 22)
      const hours = Array.from({ length: 16 }, (_, i) => i + 7);

      const productionData = await executeQuery<MLPredictionsQueryResult>(
        ML_PREDICTIONS_QUERY,
        { date: dateStr, hours }
      );

      let consumptionPredictions: MLConsumptionPrediction[] = [];
      try {
        const consumptionData = await executeQuery<MLConsumptionPredictionsQueryResult>(
          ML_CONSUMPTION_PREDICTIONS_QUERY,
          { startDate: dateStr, endDate: nextDateStr }
        );
        consumptionPredictions = consumptionData.mlPredictConsumptionDateRange ?? [];
      } catch (consumptionError) {
        console.warn('Error fetching ML consumption predictions:', consumptionError);
      }

      let appliancePoints: { datetime: string; consumptionKw: number }[] = [];
      try {
        const startISO = new Date(targetDate);
        startISO.setHours(0, 0, 0, 0);
        const forecastPromise = executeQuery<AppliancesForecastResult>(
          APPLIANCES_FORECAST_QUERY,
          { hours: 24, start: startISO.toISOString() }
        );
        const forecastTimeout = new Promise<AppliancesForecastResult>((_, reject) => {
          setTimeout(() => reject(new Error('forecast-timeout')), 4000);
        });
        const forecastData = await Promise.race([forecastPromise, forecastTimeout]);
        appliancePoints = forecastData.appliancesConsumptionForecast?.points ?? [];
      } catch (forecastError) {
        console.warn('Error fetching appliances consumption forecast:', forecastError);
      }

      if (productionData.mlPredictForHours && productionData.mlPredictForHours.length > 0) {
        const transformedPredictions = transformMLPredictionsToSolarData(
          productionData.mlPredictForHours,
          consumptionPredictions,
          appliancePoints
        );
        setMlPredictions(transformedPredictions);
      } else {
        setMlPredictions([]);
      }

      // Fetch profile-based consumption predictions for the target day
      try {
        type ProfileQueryResult = { predictConsumptionProfile: ConsumptionPrediction[] };
        const profileData = await executeQuery<ProfileQueryResult>(
          PROFILE_CONSUMPTION_QUERY,
          { date: dateStr }
        );
        setConsumptionPredictions(profileData.predictConsumptionProfile ?? []);
      } catch (profileError) {
        console.warn('Error fetching profile consumption predictions:', profileError);
      }
    } catch (error) {
      console.error('Error fetching ML predictions:', error);
      setMlPredictions([]);
    } finally {
      setMlLoading(false);
    }
  }, []);

  // Fetch all data
  const fetchData = async () => {
    // Check for offline status immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      // Load demo data if offline
      setSolarData(DEMO_DATA.solar);
      setWeatherData(DEMO_DATA.weather);
      setPredictionsData(DEMO_DATA.predictions);
      setBatteryConfigs(DEMO_DATA.batteries);
      setLoading(false);
      return;
    } else {
      setIsOffline(false);
    }

    try {
      // Create a promise that rejects after 12 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, 12000);
      });

      // Race between the fetch and the timeout
      const data = await Promise.race([
        executeQuery<DashboardQueryResult>(DASHBOARD_QUERY),
        timeoutPromise
      ]);

      setIsSlowNetwork(false); // Reset slow network if successful
      setFetchError(null);
      setSolarData(data.solar);
      setWeatherData(data.weather);
      setPredictionsData(data.predictions);
      setBatteryConfigs(data.batteries ?? []);

      setLastUpdate(new Date());
      setLoading(false);

      // Load solar model info (R²) once
      try {
        type ModelInfoResult = { mlModelInfo: { loaded: boolean; testR2?: number | null } };
        const modelInfo = await executeQuery<ModelInfoResult>(SOLAR_MODEL_INFO_QUERY);
        if (modelInfo.mlModelInfo?.loaded && modelInfo.mlModelInfo.testR2 != null) {
          setSolarModelR2(modelInfo.mlModelInfo.testR2);
        }
      } catch {
        // non-critical, skip silently
      }

      // Load ML predictions for today after main data is loaded
      await fetchMLPredictionsForDay(0);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);

      if (error.message === 'TIMEOUT') {
        setIsSlowNetwork(true);
        // Load demo data on timeout
        setSolarData(DEMO_DATA.solar);
        setWeatherData(DEMO_DATA.weather);
        setPredictionsData(DEMO_DATA.predictions);
        setBatteryConfigs(DEMO_DATA.batteries);
        setLoading(false);
      } else {
        // Error real (backend caído, GraphQL, etc.): registrar para mostrar un
        // estado de error con reintento en vez de dejar el spinner girando.
        setFetchError(
          error instanceof Error && error.message
            ? error.message
            : 'No se pudo conectar con el servidor.'
        );
        setLoading(false);
      }
    }
  };

  // Initial fetch and auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update background gradient based on weather and time
  useEffect(() => {
    // Priority to manual override
    if (weatherOverride) {
      if (weatherOverride === 'night') {
        // Night: Deep dark gradient simulating night sky
        setBgGradient('linear-gradient(to bottom right, #0f172a, #1e1b4b, #000000)');
      } else if (weatherOverride === 'rainy') {
        // Rainy: Use default gradient
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
      } else if (weatherOverride === 'cloudy') {
        setBgGradient('linear-gradient(to bottom right, #d1d5db, #e5e7eb, #9ca3af)');
      } else if (weatherOverride === 'partly-cloudy') {
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #f3f4f6, #bfdbfe)');
      } else {
        // sunny
        setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
      }
      return;
    }

    if (!weatherData || !solarData) return;

    // NO detectar noche automáticamente, solo basarse en nubosidad
    // La noche solo se activa mediante el override manual del Test
    const cloudCover = weatherData.cloudCover || 0;
    const isRainy = cloudCover > 80;
    const isCloudy = cloudCover > 50;

    if (isRainy) {
      // Rainy mode: Use default gradient
      setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
    } else if (isCloudy) {
      // Cloudy mode: Grayish gradient
      setBgGradient('linear-gradient(to bottom right, #d1d5db, #e5e7eb, #9ca3af)');
    } else {
      // Default/Sunny: Sky blue gradient
      setBgGradient('linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)');
    }
  }, [weatherData, solarData, weatherOverride]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundImage: 'linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)' }}>
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Cargando Gemelo Digital…</p>
        </div>
      </div>
    );
  }

  // Estado de error: no hay datos y el fetch falló (backend caído, error GraphQL…).
  if (!solarData || !weatherData || !predictionsData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundImage: 'linear-gradient(to bottom right, #e0f2fe, #ffffff, #dbeafe)' }}>
        <div className="max-w-md w-full rounded-3xl border border-red-100 bg-white/80 backdrop-blur p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
            <ExclamationTriangleIcon className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No se pudieron cargar los datos</h2>
          <p className="mt-2 text-sm text-gray-500">
            No hay conexión con el servidor del gemelo digital. Verifique que el backend esté en ejecución e inténtelo de nuevo.
          </p>
          {fetchError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 break-words">{fetchError}</p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Reintentar
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddDevice = () => {
    router.push('/ajustes');
  };

  return (
    <div className="min-h-screen transition-all duration-[2000ms] ease-in-out relative" style={{ backgroundImage: bgGradient }}>
      {/* Stars effect for night mode */}
      {(bgGradient.includes('#0f172a') || bgGradient.includes('#1e1b4b')) && <StarsBackground />}

      {/* Header Simplificado */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Gemelo Digital · Microrred Solar
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                50 kW · 100 kWh · La Habana, Cuba
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {user.role === 'admin' && (
                <button
                  onClick={() => setActiveSection('admin')}
                  className={`hidden sm:inline-flex items-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${activeSection === 'admin'
                    ? 'border-purple-200 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => router.push('/ajustes')}
                className="hidden sm:inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Ajustes
              </button>
              <button
                onClick={fetchData}
                className="p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors group"
                title="Actualizar"
              >
                <ArrowPathIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 group-hover:rotate-180 transition-transform duration-500" />
              </button>
              <button
                onClick={onLogout}
                className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Network Status Banners */}
      {isOffline && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-red-700 text-sm font-medium">
            <WifiIcon className="w-4 h-4" />
            <span>Sin conexión a internet. Mostrando datos de demostración.</span>
          </div>
        </div>
      )}

      {isSlowNetwork && !isOffline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-yellow-700 text-sm font-medium">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>Red muy lenta detectada. Cargando datos demo del clima...</span>
          </div>
        </div>
      )}

      {/* Main Content - Simplificado */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-0 pb-32">
        {activeSection === 'overview' && (
          <>
            {/* Fila de KPIs principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 mb-2 sm:mb-3">
              {[
                {
                  icon: BoltIcon,
                  label: 'Producción ahora',
                  value: `${(solarData.current.production ?? 0).toFixed(1)} kW`,
                  accent: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
                {
                  icon: HomeIcon,
                  label: 'Consumo ahora',
                  value: `${(solarData.current.consumption ?? 0).toFixed(1)} kW`,
                  accent: 'text-blue-600',
                  bg: 'bg-blue-50',
                },
                {
                  icon: Battery50Icon,
                  label: 'Batería',
                  value: `${Math.round(solarData.battery.chargeLevel ?? 0)} %`,
                  accent: 'text-purple-600',
                  bg: 'bg-purple-50',
                },
                {
                  icon: SunIcon,
                  label: 'Energía hoy',
                  value: `${(solarData.metrics.dailyProduction ?? 0).toFixed(1)} kWh`,
                  accent: 'text-amber-600',
                  bg: 'bg-amber-50',
                },
              ].map(({ icon: Icon, label, value, accent, bg }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/80 backdrop-blur px-4 py-3 shadow-sm"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-5 w-5 ${accent}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] sm:text-xs text-gray-500 truncate">{label}</p>
                    <p className={`text-lg sm:text-xl font-bold ${accent}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Diagrama del sistema y Resumen del Clima */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-2 sm:mb-3">
              <div className="lg:col-span-1 lg:pr-4 flex items-center justify-center">
                <SystemDiagram
                  solarKw={solarData.current.production}
                  batteryKwh={solarData.config.battery.capacityKwh}
                  consumptionKw={solarData.current.consumption}
                />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="flex-1">
                  <WeatherToday
                    weather={weatherData}
                    onWeatherOverride={setWeatherOverride}
                  />
                </div>
                <div className="flex-1">
                  <WeatherForecast weather={weatherData} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="lg:col-span-2">
                <SolarProductionChart
                  data={mlPredictions.length > 0 ? mlPredictions : solarData.historical}
                  useMLPredictions={mlPredictions.length > 0}
                  loading={mlLoading}
                  onDayChange={fetchMLPredictionsForDay}
                />
              </div>
              <div>
                <BatteryStatus batteries={batteryConfigs} />
              </div>
            </div>

            <div>
              <PredictionsPanel
                predictions={predictionsData.predictions}
                alerts={predictionsData.alerts}
                recommendations={predictionsData.recommendations}
                weather={weatherData}
                batteryProjection={predictionsData.battery}
                config={solarData.config}
                blackouts={predictionsData.blackouts}
                consumptionPredictions={consumptionPredictions}
                solarModelR2={solarModelR2}
              />
            </div>
          </>
        )}

        {activeSection === 'stats' && (
          <SolarStatsView
            timeline={solarData.historical}
            weather={weatherData}
            config={solarData.config}
          />
        )}

        {activeSection === 'historial' && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-gray-100 p-6 shadow-sm">
            <HistorialPanel />
          </div>
        )}

        {activeSection === 'admin' && user.role === 'admin' && (
          <AdminPanel currentUser={user} />
        )}
      </main>

      {/* Floating Bottom Navigation */}
      <FloatingBottomNav
        active={activeSection}
        onSelect={(section) => {
          if (section === 'devices') {
            router.push('/ajustes');
            return;
          }
          setActiveSection(section);
        }}
        onAddDevice={handleAddDevice}
      />
    </div>
  );
}
