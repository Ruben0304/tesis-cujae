'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  ChartBarIcon,
  CalendarIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  TableCellsIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { executeQuery, executeMutation } from '@/lib/graphql-client';
import {
  exportReadingsCsv,
  exportSummariesCsv,
  exportReadingsPdf,
  exportSummariesPdf,
} from '@/lib/reportGenerator';
import type { HistoricalReading, DailySummary } from '@/types';

// ─── GraphQL queries ────────────────────────────────────────────────────────

const HISTORICAL_READINGS_QUERY = `
  query HistoricalReadings($startDate: String, $endDate: String, $limit: Int) {
    historicalReadings(startDate: $startDate, endDate: $endDate, limit: $limit) {
      _id
      timestamp
      production
      consumption
      batteryLevel
      gridExport
      gridImport
      efficiency
    }
  }
`;

const DAILY_SUMMARIES_QUERY = `
  query DailySummaries($days: Int) {
    dailySummaries(days: $days) {
      date
      totalProduction
      totalConsumption
      avgBatteryLevel
      maxProduction
      maxConsumption
      avgEfficiency
      readingCount
    }
  }
`;

const SEED_MUTATION = `
  mutation SeedHistoricalData($days: Int) {
    seedHistoricalData(days: $days)
  }
`;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatHour(isoStr: string): string {
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

type ViewMode = 'hourly' | 'daily';

// ─── Component ──────────────────────────────────────────────────────────────

export default function HistorialPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [readings, setReadings] = useState<HistoricalReading[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // El sembrado de datos de demostración solo se ofrece a administradores
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('gd_auth_user');
      if (stored) setIsAdmin(JSON.parse(stored)?.role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'daily') {
        const data = await executeQuery<{ dailySummaries: DailySummary[] }>(
          DAILY_SUMMARIES_QUERY,
          { days },
          'network-only'
        );
        setSummaries(data?.dailySummaries ?? []);
      } else {
        const now = new Date();
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const data = await executeQuery<{ historicalReadings: HistoricalReading[] }>(
          HISTORICAL_READINGS_QUERY,
          {
            startDate: start.toISOString(),
            endDate: now.toISOString(),
            limit: days * 24,
          },
          'network-only'
        );
        setReadings(data?.historicalReadings ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos históricos.');
    } finally {
      setLoading(false);
    }
  }, [viewMode, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const data = await executeMutation<{ seedHistoricalData: number }>(SEED_MUTATION, {
        days: 30,
      });
      const count = data?.seedHistoricalData ?? 0;
      setSeedMessage(
        count > 0
          ? { type: 'success', text: `Se generaron ${count} lecturas simuladas para los últimos 30 días.` }
          : { type: 'warning', text: 'Los datos ya existían. No se insertaron registros adicionales.' }
      );
      await fetchData();
    } catch (err) {
      setSeedMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error al generar datos.' });
    } finally {
      setSeeding(false);
    }
  };

  // ─── Export handlers ────────────────────────────────────────────────────

  const handleExportCsv = () => {
    if (viewMode === 'daily' && summaries.length > 0) exportSummariesCsv(summaries, 'GemeloDigital');
    else if (viewMode === 'hourly' && readings.length > 0) exportReadingsCsv(readings, 'GemeloDigital');
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const now = new Date();
      const meta = {
        title: viewMode === 'daily' ? 'Reporte de resumen diario' : 'Reporte de lecturas horarias',
        systemName: 'Gemelo Digital Fotovoltaico',
        location: 'La Habana, Cuba',
        period: `Últimos ${days} días`,
        generatedAt: now.toLocaleString('es-CU'),
      };
      if (viewMode === 'daily' && summaries.length > 0) await exportSummariesPdf(summaries, meta);
      else if (viewMode === 'hourly' && readings.length > 0) await exportReadingsPdf(readings, meta);
    } finally {
      setExporting(false);
    }
  };

  const hasData = viewMode === 'daily' ? summaries.length > 0 : readings.length > 0;

  // ─── Derived stats ──────────────────────────────────────────────────────

  const totalProduction = summaries.reduce((s, d) => s + d.totalProduction, 0);
  const totalConsumption = summaries.reduce((s, d) => s + d.totalConsumption, 0);
  const avgBattery =
    summaries.length > 0
      ? summaries.reduce((s, d) => s + d.avgBatteryLevel, 0) / summaries.length
      : 0;
  const totalCo2 = totalProduction * 0.5;

  // ─── Chart data ─────────────────────────────────────────────────────────

  const hourlyChartData = readings.map((r) => ({
    time: formatHour(r.timestamp),
    Producción: r.production,
    Consumo: r.consumption,
    Batería: r.batteryLevel,
  }));

  const dailyChartData = summaries.map((s) => ({
    fecha: formatDate(s.date),
    Producción: s.totalProduction,
    Consumo: s.totalConsumption,
    'Bat. promedio': s.avgBatteryLevel,
  }));

  const noData = viewMode === 'daily' ? summaries.length === 0 : readings.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6 text-emerald-500" />
            Datos históricos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Serie temporal de producción, consumo y nivel de batería
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period selector */}
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 border border-slate-200">
            <CalendarIcon className="h-4 w-4 text-slate-400" />
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={14}>Últimos 14 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(['daily', 'hourly'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  viewMode === m
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {m === 'daily' ? 'Diario' : 'Por hora'}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 px-3 py-2 text-sm text-slate-700 transition disabled:opacity-50 border border-slate-200"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          {/* Seed button — solo administradores */}
          {isAdmin && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 px-3 py-2 text-sm text-white transition disabled:opacity-50 border border-indigo-500"
              title="Generar datos simulados de demostración"
            >
              <CloudArrowDownIcon className={`h-4 w-4 ${seeding ? 'animate-bounce' : ''}`} />
              {seeding ? 'Generando…' : 'Generar datos de prueba'}
            </button>
          )}

          {/* Export buttons */}
          {hasData && (
            <>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 px-3 py-2 text-sm text-white transition border border-emerald-600"
                title="Exportar datos visibles como CSV"
              >
                <TableCellsIcon className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={handleExportPdf}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-600 disabled:opacity-50 px-3 py-2 text-sm text-white transition border border-sky-600"
                title="Exportar reporte PDF profesional"
              >
                {exporting
                  ? <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  : <DocumentTextIcon className="h-4 w-4" />
                }
                PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Seed message */}
      {seedMessage && (
        <div
          role={seedMessage.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            seedMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : seedMessage.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-red-600'
          }`}
        >
          {seedMessage.type === 'success' && <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />}
          {seedMessage.type === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />}
          {seedMessage.type === 'error' && <XCircleIcon className="h-5 w-5 flex-shrink-0" />}
          <span>{seedMessage.text}</span>
        </div>
      )}

      {/* Summary KPI cards (daily view only) */}
      {viewMode === 'daily' && summaries.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Producción total', value: `${totalProduction.toFixed(1)} kWh`, color: 'text-yellow-600' },
            { label: 'Consumo total', value: `${totalConsumption.toFixed(1)} kWh`, color: 'text-blue-600' },
            { label: 'CO₂ evitado', value: `${totalCo2.toFixed(1)} kg`, color: 'text-green-600' },
            { label: 'Batería promedio', value: `${avgBattery.toFixed(1)} %`, color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm"
            >
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && noData && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 py-16 text-center">
          <ChartBarIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Sin datos históricos</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            {isAdmin
              ? 'El sistema aún no ha acumulado lecturas. Use «Generar datos de prueba» para poblar la serie histórica.'
              : 'El sistema aún no ha acumulado lecturas para el período seleccionado.'}
          </p>
        </div>
      )}

      {/* Charts */}
      {!noData && (
        <div className="space-y-6">
          {/* Production & Consumption chart */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              {viewMode === 'daily'
                ? 'Producción y consumo diarios (kWh)'
                : 'Producción y consumo por hora (kW)'}
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              {viewMode === 'daily' ? (
                <BarChart data={dailyChartData} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" kWh" />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
                  <Bar dataKey="Producción" fill="#facc15" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Consumo" fill="#60a5fa" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={hourlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    interval={Math.floor(hourlyChartData.length / 10)}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} unit=" kW" />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ color: '#475569', fontSize: 12 }} />
                  <Line type="monotone" dataKey="Producción" stroke="#facc15" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Consumo" stroke="#60a5fa" dot={false} strokeWidth={2} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Battery level chart */}
          <div className="rounded-2xl bg-white border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              {viewMode === 'daily' ? 'Nivel de batería promedio (%)' : 'Nivel de batería por hora (%)'}
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={viewMode === 'daily' ? dailyChartData : hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey={viewMode === 'daily' ? 'fecha' : 'time'}
                  tick={{ fill: '#64748b', fontSize: viewMode === 'daily' ? 11 : 10 }}
                  interval={viewMode === 'hourly' ? Math.floor(hourlyChartData.length / 10) : 0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  labelStyle={{ color: '#334155' }}
                />
                <Line
                  type="monotone"
                  dataKey={viewMode === 'daily' ? 'Bat. promedio' : 'Batería'}
                  stroke="#a78bfa"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Los datos se almacenan automáticamente cada 5 minutos en MongoDB (colección{' '}
        <code className="bg-slate-100 text-slate-700 px-1 rounded">lecturas_historicas</code>)
      </p>
    </div>
  );
}
