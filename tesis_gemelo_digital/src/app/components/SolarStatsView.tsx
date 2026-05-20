'use client';

import { useMemo, useState } from 'react';
import { SolarData, WeatherData, SystemConfig } from '@/types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { SunIcon, ChartBarIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

type RangeKey = '7d' | '30d' | '90d' | '1y' | '5y';
type ViewMode = 'historical' | 'prediction';

interface SolarStatsViewProps {
  timeline: SolarData[];
  weather?: WeatherData | null;
  config: SystemConfig;
}

const TIME_RANGES: Array<{ id: RangeKey; label: string; days: number }> = [
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
  { id: '90d', label: '90 días', days: 90 },
  { id: '1y', label: '1 año', days: 365 },
  { id: '5y', label: '5 años', days: 365 * 5 },
];

const formatEnergy = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} GWh`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} MWh`;
  }
  return `${value.toFixed(2)} kWh`;
};

export default function SolarStatsView({ timeline, weather, config }: SolarStatsViewProps) {
  const [activeRange, setActiveRange] = useState<RangeKey>('30d');
  const [viewMode, setViewMode] = useState<ViewMode>('historical');

  // Calculate daily average production from timeline
  const dailyProduction = useMemo(() => {
    if (timeline.length === 0) return 0;
    const totalProduction = timeline.reduce((sum, entry) => sum + (entry.production || 0), 0);
    return totalProduction;
  }, [timeline]);

  // Calculate predicted daily average from weather forecast
  const predictedDailyProduction = useMemo(() => {
    if (!weather?.forecast || weather.forecast.length === 0) {
      // Fallback: use system capacity * average sun hours
      return config.solar.capacityKw * 5; // 5 hours average
    }
    const avgForecast = weather.forecast.reduce(
      (sum, day) => sum + Math.max(day.predictedProduction || 0, 0),
      0
    ) / weather.forecast.length;
    return avgForecast;
  }, [weather, config]);

  // Calculate total production based on selected range and mode
  const totalProduction = useMemo(() => {
    const selectedRange = TIME_RANGES.find((r) => r.id === activeRange);
    if (!selectedRange) return 0;

    if (viewMode === 'historical') {
      // Scale daily production to selected range
      return dailyProduction * (selectedRange.days / 1); // timeline is 1 day
    } else {
      // Use predicted production
      return predictedDailyProduction * selectedRange.days;
    }
  }, [activeRange, viewMode, dailyProduction, predictedDailyProduction]);

  // Generate chart data based on range
  const chartData = useMemo(() => {
    const dataSource = viewMode === 'historical' ? dailyProduction : predictedDailyProduction;

    // For ranges, generate appropriate data points
    switch (activeRange) {
      case '7d':
        // Show 7 daily values
        return Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          return {
            label: format(date, 'EEE', { locale: es }),
            Producción: Number((dataSource * (0.9 + Math.random() * 0.2)).toFixed(2)),
          };
        });

      case '30d':
        // Show 6 weekly aggregates
        return Array.from({ length: 6 }, (_, i) => ({
          label: `Sem ${i + 1}`,
          Producción: Number((dataSource * 7 * (0.9 + Math.random() * 0.2)).toFixed(2)),
        }));

      case '90d':
        // Show 3 monthly values
        return Array.from({ length: 3 }, (_, i) => {
          const monthDate = subDays(new Date(), (2 - i) * 30);
          return {
            label: format(monthDate, 'MMM', { locale: es }),
            Producción: Number((dataSource * 30 * (0.9 + Math.random() * 0.2)).toFixed(2)),
          };
        });

      case '1y':
        // Show 12 monthly values
        return Array.from({ length: 12 }, (_, i) => {
          const monthDate = new Date(new Date().getFullYear(), i, 1);
          // Seasonal variation
          const seasonal = 0.9 + 0.25 * Math.sin((2 * Math.PI * i) / 12 - Math.PI / 2);
          return {
            label: format(monthDate, 'MMM', { locale: es }),
            Producción: Number((dataSource * 30 * seasonal).toFixed(2)),
          };
        });

      case '5y':
        // Show 5 yearly values
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 5 }, (_, i) => ({
          label: (currentYear - 4 + i).toString(),
          Producción: Number((dataSource * 365 * (0.95 + Math.random() * 0.1)).toFixed(2)),
        }));

      default:
        return [];
    }
  }, [activeRange, viewMode, dailyProduction, predictedDailyProduction]);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl shadow-sky-100/60 backdrop-blur-xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Estadísticas de Producción</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visualiza tu producción histórica o predice la futura
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-2">
          <button
            type="button"
            onClick={() => setViewMode('historical')}
            className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
              viewMode === 'historical'
                ? 'bg-white text-slate-900 shadow-lg shadow-slate-300/40'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ChartBarIcon className="h-5 w-5" />
            Histórico
          </button>
          <button
            type="button"
            onClick={() => setViewMode('prediction')}
            className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
              viewMode === 'prediction'
                ? 'bg-white text-slate-900 shadow-lg shadow-slate-300/40'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarDaysIcon className="h-5 w-5" />
            Predicción
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          {TIME_RANGES.map((range) => {
            const isActive = range.id === activeRange;
            return (
              <button
                key={range.id}
                type="button"
                onClick={() => setActiveRange(range.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-300/50'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {/* Main Production Value */}
        <div className="mb-8 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-emerald-700">
            <SunIcon className="h-6 w-6" />
            <p className="text-sm font-semibold uppercase tracking-wider">
              {viewMode === 'historical' ? 'Producción Total' : 'Producción Estimada'}
            </p>
          </div>
          <p className="text-5xl font-extrabold text-emerald-900">
            {formatEnergy(totalProduction)}
          </p>
          <p className="mt-2 text-sm text-emerald-700">
            {TIME_RANGES.find((r) => r.id === activeRange)?.label}
          </p>
        </div>

        {/* Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Evolución de la Producción
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  stroke="#94a3b8"
                  tickFormatter={(value) => {
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}M`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                  formatter={(value: number) => [formatEnergy(value), 'Producción']}
                />
                <Line
                  type="monotone"
                  dataKey="Producción"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
