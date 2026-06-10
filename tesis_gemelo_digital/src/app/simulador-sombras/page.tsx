'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Sun, TreePine, Building2, Trash2, Plus,
  Compass, Info, HelpCircle, Activity, Home, Grid3x3,
} from 'lucide-react';
import { sunPosition, sunDirection } from '@/lib/sunPosition';
import { computeShadow, type Obstacle, type ObstacleType, type PanelRect } from '@/lib/shadowCalc';
import type { InstallationType, InstallationState, TransformMode } from './Scene';
import { INSTALLATION_ID } from './Scene';
import { Move3d, RotateCcw } from 'lucide-react';

// ── 3D scene (lazy import, sin SSR) ────────────────────────────────────────────
const Scene = dynamic(() => import('./Scene'), { ssr: false });

// ── Coordenadas La Habana (de CLAUDE.md) ──────────────────────────────────────
const LAT = 23.1136;
const LON = -82.3666;

// ── Panel rect según el tipo de instalación (Y ajustado a los modelos GLB) ────
const PANEL_BY_INSTALL: Record<InstallationType, PanelRect> = {
  house: { center: { x: -0.6, y: 2.1, z: 0 }, width: 1.6, depth: 2,   tiltDeg: 30, azimuthDeg: 180 },
  park:  { center: { x:  0,   y: 0.7, z: 0 }, width: 4,   depth: 3,   tiltDeg: 15, azimuthDeg: 180 },
};

// Defaults de los obstáculos según su tipo
const OBSTACLE_DEFAULTS: Record<ObstacleType, { height: number; radius: number; label: string }> = {
  'tree':     { height: 6, radius: 2, label: 'Árbol' },
  'building': { height: 6, radius: 2, label: 'Edificio' },
};

let nextObstacleId = 0;
const newId = () => `obs-${++nextObstacleId}`;

const DEFAULT_OBSTACLES: Obstacle[] = [
  { id: newId(), type: 'tree',     position: { x: -7, y: 0, z: -2 }, height: 6, radius: 2 },
  { id: newId(), type: 'building', position: { x: 9,  y: 0, z: 5 },  height: 6, radius: 2 },
];

// ──────────────────────────────────────────────────────────────────────────────
function Panel({ title, icon, children, className = '' }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Item({ dt, dd, ddColor = 'text-gray-900' }: { dt: string; dd: string; ddColor?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-500">{dt}</span>
      <span className={`font-semibold tabular-nums ${ddColor}`}>{dd}</span>
    </div>
  );
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ──────────────────────────────────────────────────────────────────────────────
export default function SimuladorSombrasPage() {
  const router = useRouter();
  const [hour, setHour] = useState(13);
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [obstacles, setObstacles] = useState<Obstacle[]>(DEFAULT_OBSTACLES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installation, setInstallation] = useState<InstallationType>('house');
  // Instalación: solo se mueve y rota, no se escala. Tamaño fijo más chico que antes.
  const [installationState, setInstallationState] = useState<InstallationState>({
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotationY: 0,
  });

  // Modo activo del gizmo (estilo Blender: mover o rotar)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');

  // Panel real (con posición + escala aplicadas)
  const panel = useMemo(() => {
    const base = PANEL_BY_INSTALL[installation];
    return {
      ...base,
      center: {
        x: base.center.x * installationState.scale + installationState.position.x,
        y: base.center.y * installationState.scale + installationState.position.y,
        z: base.center.z * installationState.scale + installationState.position.z,
      },
      width: base.width * installationState.scale,
      depth: base.depth * installationState.scale,
    };
  }, [installation, installationState]);

  // ── Cálculos derivados ────────────────────────────────────────────────────
  const sunPos = useMemo(() => {
    // Fecha sintética para el mes seleccionado y la hora del slider
    const d = new Date();
    d.setMonth(month - 1, 15); // día 15 representativo del mes
    d.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    return sunPosition(d, LAT, LON);
  }, [hour, month]);

  const sunDir = useMemo(() => sunDirection(sunPos), [sunPos]);

  const shadow = useMemo(
    () => computeShadow(panel, sunDir, obstacles, sunPos.elevationDeg),
    [panel, sunDir, obstacles, sunPos.elevationDeg],
  );

  const productionMultiplier = useMemo(() => {
    if (sunPos.elevationDeg <= 0) return 0;
    return 1 - shadow.shadowPct / 100;
  }, [shadow.shadowPct, sunPos.elevationDeg]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const addObstacle = (type: ObstacleType) => {
    const angle = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 4;
    const def = OBSTACLE_DEFAULTS[type];
    setObstacles((prev) => [...prev, {
      id: newId(),
      type,
      position: { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r },
      height: def.height,
      radius: def.radius,
    }]);
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setObstacles((prev) => prev.filter((o) => o.id !== selectedId));
    setSelectedId(null);
  };

  const moveObstacle = (id: string, x: number, z: number) => {
    if (id === INSTALLATION_ID) {
      setInstallationState((s) => ({ ...s, position: { ...s.position, x, z } }));
      return;
    }
    setObstacles((prev) => prev.map((o) => o.id === id ? { ...o, position: { ...o.position, x, z } } : o));
  };

  const rotateObstacle = (id: string, yRad: number) => {
    if (id === INSTALLATION_ID) {
      setInstallationState((s) => ({ ...s, rotationY: yRad }));
      return;
    }
    setObstacles((prev) => prev.map((o) => o.id === id ? { ...o, rotationY: yRad } : o));
  };

  const updateSelected = (patch: Partial<Obstacle>) => {
    if (!selectedId) return;
    setObstacles((prev) => prev.map((o) => o.id === selectedId ? { ...o, ...patch } : o));
  };

  const selected = obstacles.find((o) => o.id === selectedId);
  const isInstallationSelected = selectedId === INSTALLATION_ID;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-[1500px] mx-auto px-4 h-12 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            <h1 className="text-sm font-semibold text-gray-900 truncate">Simulador 3D de sombras</h1>
            <span className="text-xs text-gray-400 truncate">· coloca obstáculos y ve su impacto sobre el panel</span>
          </div>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            ¿Cómo funciona?
          </button>
        </div>

        {showHelp && (
          <div className="bg-blue-50 border-t border-blue-100">
            <div className="max-w-[1500px] mx-auto px-4 py-3 text-xs text-blue-900 leading-relaxed">
              <p className="font-semibold mb-1">¿Cómo se calcula la sombra?</p>
              <p>
                El sistema usa la posición real del sol para La Habana (lat {LAT}°, lon {LON}°) según el mes y la hora.
                Sobre el panel se muestrean 81 puntos (grilla 9×9); para cada uno se traza un rayo virtual hacia el sol y
                se comprueba si algún obstáculo lo intercepta. El porcentaje de puntos bloqueados es el % de sombra,
                que se traduce directamente en pérdida de producción.
                Las fórmulas de posición solar se basan en el algoritmo NOAA (versión simplificada).
              </p>
            </div>
          </div>
        )}
      </header>

      {/* ── Body: 3 columnas (inline styles) ─────────────────────────────────── */}
      <main className="mx-auto px-4 py-4" style={{ maxWidth: 1600 }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>

          {/* ── LEFT: Controls ──────────────────────────────────────────── */}
          <aside style={{ width: 260, flexShrink: 0 }} className="space-y-4">
            <Panel title="Tiempo" icon={<Sun className="w-3.5 h-3.5 text-gray-400" />}>
              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-700">Hora del día</span>
                    <span className="text-base font-bold tabular-nums text-amber-600">
                      {String(Math.floor(hour)).padStart(2, '0')}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={24} step={0.25} value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-amber-500 bg-gray-200"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-700">Mes</span>
                    <span className="text-xs font-semibold text-gray-700">{MONTHS[month - 1]}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        onClick={() => setMonth(i + 1)}
                        className={`text-[10px] font-medium py-1 rounded transition-colors ${
                          month === i + 1
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Instalación" icon={<Home className="w-3.5 h-3.5 text-gray-400" />}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setInstallation('house')}
                  className={`inline-flex flex-col items-center justify-center gap-1 text-xs font-medium py-2.5 rounded transition-colors ${
                    installation === 'house'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  Casa con paneles
                </button>
                <button
                  onClick={() => setInstallation('park')}
                  className={`inline-flex flex-col items-center justify-center gap-1 text-xs font-medium py-2.5 rounded transition-colors ${
                    installation === 'park'
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Grid3x3 className="w-4 h-4" />
                  Parque de paneles
                </button>
              </div>
            </Panel>

            <Panel title="Obstáculos" icon={<TreePine className="w-3.5 h-3.5 text-gray-400" />}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => addObstacle('tree')}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Árbol
                  </button>
                  <button
                    onClick={() => addObstacle('building')}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Edificio
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 leading-snug">
                  Clic en un obstáculo para seleccionarlo · arrastra los gizmos para moverlo.
                </p>

                <div className="border-t border-gray-100 pt-2">
                  <div className="text-[11px] text-gray-500 mb-1.5">En escena ({obstacles.length})</div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {obstacles.map((o) => (
                      <li
                        key={o.id}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded cursor-pointer ${
                          o.id === selectedId ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                        onClick={() => setSelectedId(o.id)}
                      >
                        {o.type === 'building' ? <Building2 className="w-3 h-3" /> : <TreePine className="w-3 h-3" />}
                        <span className="flex-1 truncate">{OBSTACLE_DEFAULTS[o.type].label}</span>
                        <span className="text-gray-400 tabular-nums text-[10px]">{o.height.toFixed(0)}m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Panel>

            {/* Edit selected */}
            {/* Toggle Mover / Rotar (estilo Blender) — aparece si hay algo seleccionado */}
            {(selected || isInstallationSelected) && (
              <Panel title="Herramienta" icon={<Move3d className="w-3.5 h-3.5 text-gray-400" />}>
                <div className="flex bg-gray-100 rounded-md p-0.5">
                  <button
                    onClick={() => setTransformMode('translate')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded transition-colors ${
                      transformMode === 'translate'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Move3d className="w-3.5 h-3.5" /> Mover
                  </button>
                  <button
                    onClick={() => setTransformMode('rotate')}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded transition-colors ${
                      transformMode === 'rotate'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rotar
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 leading-snug mt-2">
                  {transformMode === 'translate'
                    ? 'Arrastra las flechas rojas y azules en el plano del suelo.'
                    : 'Arrastra el anillo verde para rotar en el eje vertical.'}
                </p>
              </Panel>
            )}

            {isInstallationSelected && (
              <Panel
                title={`Editar: ${installation === 'house' ? 'Casa con paneles' : 'Parque de paneles'}`}
                icon={installation === 'house'
                  ? <Home className="w-3.5 h-3.5 text-gray-400" />
                  : <Grid3x3 className="w-3.5 h-3.5 text-gray-400" />}
              >
                <div className="space-y-3">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Posición X</span>
                      <span className="font-semibold tabular-nums">{installationState.position.x.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Posición Z</span>
                      <span className="font-semibold tabular-nums">{installationState.position.z.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rotación Y</span>
                      <span className="font-semibold tabular-nums">{((installationState.rotationY * 180) / Math.PI).toFixed(0)}°</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setInstallationState((s) => ({ ...s, position: { x: 0, y: 0, z: 0 }, rotationY: 0 }))}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Centrar y reiniciar rotación
                  </button>
                </div>
              </Panel>
            )}

            {selected && (
              <Panel
                title={`Editar: ${OBSTACLE_DEFAULTS[selected.type].label}`}
                icon={selected.type === 'building'
                  ? <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  : <TreePine className="w-3.5 h-3.5 text-gray-400" />}
              >
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">Tamaño</span>
                      <span className="text-xs font-bold tabular-nums">{selected.height.toFixed(1)} m</span>
                    </div>
                    <input
                      type="range" min={1} max={20} step={0.5} value={selected.height}
                      onChange={(e) => {
                        const newHeight = Number(e.target.value);
                        // El radio escala proporcionalmente: mantiene la relación altura/radio
                        const ratio = selected.radius / selected.height;
                        updateSelected({ height: newHeight, radius: newHeight * ratio });
                      }}
                      className="w-full h-1.5 accent-emerald-500"
                    />
                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">
                      Escala uniforme del objeto. El área de sombra se ajusta automáticamente.
                    </p>
                  </div>
                  <button
                    onClick={removeSelected}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              </Panel>
            )}
          </aside>

          {/* ── CENTER: 3D Scene ────────────────────────────────────────── */}
          <div
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            style={{ flex: 1, minWidth: 0 }}
          >
            <div className="relative" style={{ height: 'calc(100vh - 6rem)', minHeight: 520, width: '100%' }}>
              <Scene
                obstacles={obstacles}
                selectedId={selectedId}
                sunDirection={sunDir}
                sunElevDeg={sunPos.elevationDeg}
                panel={panel}
                shadowResult={shadow}
                installation={installation}
                installationState={installationState}
                transformMode={transformMode}
                onSelectObstacle={setSelectedId}
                onMoveObstacle={moveObstacle}
                onRotateObstacle={rotateObstacle}
              />
              {/* HUD overlay */}
              <div className="absolute top-3 left-3 bg-white/85 backdrop-blur border border-gray-200 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-3">
                  <Sun className={`w-3.5 h-3.5 ${sunPos.elevationDeg > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span className="text-gray-500">Elevación</span>
                  <span className="font-semibold tabular-nums text-gray-900">{sunPos.elevationDeg.toFixed(0)}°</span>
                  <span className="text-gray-300">·</span>
                  <Compass className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-gray-500">Azimut</span>
                  <span className="font-semibold tabular-nums text-gray-900">{sunPos.azimuthDeg.toFixed(0)}°</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-3 bg-white/85 backdrop-blur border border-gray-200 rounded-lg px-3 py-1.5 text-[11px] text-gray-500 leading-snug">
                <div><kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">W</kbd><kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">A</kbd><kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">S</kbd><kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">D</kbd> mover · <kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">Q</kbd><kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">E</kbd> subir/bajar · <kbd className="bg-gray-100 border border-gray-300 rounded px-1 mx-0.5 font-mono">⇧</kbd> rápido</div>
                <div>Arrastra ratón para rotar · rueda para zoom · clic para seleccionar</div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results ──────────────────────────────────────────── */}
          <aside style={{ width: 280, flexShrink: 0 }} className="space-y-4">
            <Panel title="Impacto sobre el panel" icon={<Activity className="w-3.5 h-3.5 text-gray-400" />}>
              <div className="space-y-3">
                <div className="text-center py-2">
                  <div className={`text-4xl font-black tabular-nums leading-none ${
                    shadow.shadowPct === 0 ? 'text-emerald-600'
                      : shadow.shadowPct < 30 ? 'text-amber-500'
                      : 'text-red-600'
                  }`}>
                    {shadow.shadowPct.toFixed(0)}<span className="text-2xl text-gray-400">%</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-gray-500 mt-1">Sombra sobre el panel</div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <Item dt="Producción esperada" dd={`${(productionMultiplier * 100).toFixed(0)}%`}
                    ddColor={productionMultiplier > 0.7 ? 'text-emerald-600' : productionMultiplier > 0.4 ? 'text-amber-600' : 'text-red-600'} />
                  <Item dt="Pérdida estimada" dd={`−${((1 - productionMultiplier) * 100).toFixed(0)}%`}
                    ddColor={productionMultiplier < 1 ? 'text-red-600' : 'text-gray-400'} />
                </div>
              </div>
            </Panel>

            <Panel title="Posición del sol" icon={<Sun className="w-3.5 h-3.5 text-gray-400" />}>
              <dl className="space-y-1.5">
                <Item dt="Elevación" dd={`${sunPos.elevationDeg.toFixed(1)}°`} />
                <Item dt="Azimut" dd={`${sunPos.azimuthDeg.toFixed(1)}°`} />
                <Item dt="Estado" dd={sunPos.elevationDeg > 0 ? 'Día' : 'Noche'}
                  ddColor={sunPos.elevationDeg > 0 ? 'text-amber-600' : 'text-slate-500'} />
              </dl>
            </Panel>

            <Panel title="Ubicación" icon={<Info className="w-3.5 h-3.5 text-gray-400" />}>
              <dl className="space-y-1.5">
                <Item dt="Lugar" dd="La Habana" />
                <Item dt="Latitud" dd={`${LAT.toFixed(4)}°`} />
                <Item dt="Longitud" dd={`${LON.toFixed(4)}°`} />
                <Item dt="Panel" dd={`${panel.tiltDeg}° / sur`} />
                <Item dt="Instalación" dd={installation === 'house' ? 'Casa' : 'Parque'} />
              </dl>
            </Panel>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 leading-snug">
              <strong>Nota:</strong> El % de sombra se traduce directamente en pérdida de producción.
              Puedes usar este valor en el slider <em>"Condición de paneles"</em> del simulador de batería.
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
