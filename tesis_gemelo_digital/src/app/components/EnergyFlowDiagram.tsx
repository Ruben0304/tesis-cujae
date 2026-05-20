'use client';

import { EnergyFlow } from '@/types';

interface EnergyFlowDiagramProps {
  energyFlow: EnergyFlow;
  production: number;
  consumption: number;
  batteryLevel: number;
}

// Layout constants
const VW = 600;
const VH = 360;

// Node centers
const SOLAR   = { x: 80,        y: 80  };
const GRID    = { x: VW - 80,   y: 80  };
const BATTERY = { x: 80,        y: VH - 80 };
const LOAD    = { x: VW - 80,   y: VH - 80 };
const HUB     = { x: VW / 2,    y: VH / 2  };

const NODE_R = 30;
const HUB_R  = 28;

// Orthogonal path: node → hub via right-angle bend at hub's x or y
function orthoPath(from: {x:number,y:number}, bend: {x:number,y:number}) {
  return `M ${from.x} ${from.y} H ${bend.x} V ${bend.y}`;
}

interface AnimatedLineProps {
  d: string;
  active: boolean;
  color: string;
  reverse?: boolean;
}

function AnimatedLine({ d, active, color, reverse = false }: AnimatedLineProps) {
  if (!active) {
    return <path d={d} fill="none" stroke="#334155" strokeWidth={2} strokeLinecap="round" />;
  }
  return (
    <g>
      {/* Base line */}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeOpacity={0.35} strokeLinecap="round" />
      {/* Animated dot 1 */}
      <circle r={4} fill={color}>
        <animateMotion dur="1.6s" repeatCount="indefinite" begin="0s">
          <mpath href={`#${reverse ? 'rev-' : ''}${d.slice(0,6).replace(/\s/g,'')}`} />
        </animateMotion>
      </circle>
    </g>
  );
}

// Animated dot moving along a specific path by its id
interface DotProps {
  pathId: string;
  color: string;
  dur?: string;
  begin?: string;
  reverse?: boolean;
}

function FlowDot({ pathId, color, dur = '1.8s', begin = '0s', reverse = false }: DotProps) {
  return (
    <circle r={4.5} fill={color} fillOpacity={0.95}>
      <animateMotion
        dur={dur}
        repeatCount="indefinite"
        begin={begin}
        keyPoints={reverse ? '1;0' : '0;1'}
        keyTimes="0;1"
        calcMode="linear"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

// Solar panel icon
function SolarIcon({ cx, cy, size = 22 }: { cx: number; cy: number; size?: number }) {
  const s = size / 2;
  const cols = 3; const rows = 3;
  const cell = s / cols;
  const gap = 1;
  return (
    <g transform={`translate(${cx - s}, ${cy - s})`}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * (cell + gap / cols) + gap / 2}
            y={r * (cell + gap / rows) + gap / 2}
            width={cell - gap * 0.6}
            height={cell - gap * 0.6}
            rx={1}
            fill="#fde68a"
            fillOpacity={0.85}
          />
        ))
      )}
    </g>
  );
}

// Battery icon inline
function BatteryIcon({ cx, cy, level }: { cx: number; cy: number; level: number }) {
  const w = 26; const h = 14;
  const color = level >= 60 ? '#34d399' : level >= 30 ? '#fbbf24' : '#f87171';
  const fillW = Math.round(((w - 4) * level) / 100);
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={3} fill="none" stroke={color} strokeWidth={1.8} />
      <rect x={cx + w / 2} y={cy - 3} width={3} height={6} rx={1} fill={color} />
      <rect x={cx - w / 2 + 2} y={cy - h / 2 + 2} width={fillW} height={h - 4} rx={2} fill={color} />
    </g>
  );
}

// Power tower icon
function GridIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#7dd3fc" strokeWidth={1.6} strokeLinecap="round" fill="none">
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} />
      <line x1={cx - 10} y1={cy - 6} x2={cx + 10} y2={cy - 6} />
      <line x1={cx - 7}  y1={cy + 2} x2={cx + 7}  y2={cy + 2} />
      <line x1={cx}      y1={cy - 14} x2={cx - 10} y2={cy - 6} />
      <line x1={cx}      y1={cy - 14} x2={cx + 10} y2={cy - 6} />
      <line x1={cx - 10} y1={cy - 6}  x2={cx - 12} y2={cy + 14} />
      <line x1={cx + 10} y1={cy - 6}  x2={cx + 12} y2={cy + 14} />
    </g>
  );
}

// House icon
function LoadIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke="#4ade80" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points={`${cx},${cy - 14} ${cx - 14},${cy - 2} ${cx + 14},${cy - 2}`} />
      <rect x={cx - 9} y={cy - 2} width={18} height={16} rx={1} />
      <rect x={cx - 3} y={cy + 4} width={6} height={10} rx={1} />
    </g>
  );
}

// Hub icon (inverter)
function HubIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <rect x={cx - 22} y={cy - 22} width={44} height={44} rx={8} fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
      <circle cx={cx} cy={cy - 6} r={4} fill="#f97316" />
      <rect x={cx - 10} y={cy + 4} width={20} height={7} rx={3.5} fill="#334155" />
    </g>
  );
}

interface NodeCircleProps {
  cx: number; cy: number;
  color: string;
  children: React.ReactNode;
}

function NodeCircle({ cx, cy, color, children }: NodeCircleProps) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={NODE_R + 8} fill={color} fillOpacity={0.06} />
      <circle cx={cx} cy={cy} r={NODE_R + 2} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={NODE_R} fill="#0f172a" stroke={color} strokeWidth={1.8} />
      {children}
    </g>
  );
}

export default function EnergyFlowDiagram({
  energyFlow,
  production,
  consumption,
  batteryLevel,
}: EnergyFlowDiagramProps) {
  const { solarToBattery, solarToLoad, solarToGrid, batteryToLoad, gridToLoad } = energyFlow;

  // Hub edge connection points
  const hubTop    = { x: HUB.x, y: HUB.y - HUB_R };
  const hubBottom = { x: HUB.x, y: HUB.y + HUB_R };
  const hubLeft   = { x: HUB.x - HUB_R, y: HUB.y };
  const hubRight  = { x: HUB.x + HUB_R, y: HUB.y };

  // Orthogonal path bends (go horizontal to hub x, then vertical to hub edge)
  const paths = {
    solar:   orthoPath({ x: SOLAR.x + NODE_R,   y: SOLAR.y   }, hubTop),
    grid:    orthoPath({ x: GRID.x - NODE_R,     y: GRID.y    }, hubTop),
    battery: orthoPath({ x: BATTERY.x + NODE_R,  y: BATTERY.y }, hubBottom),
    load:    orthoPath({ x: LOAD.x - NODE_R,     y: LOAD.y    }, hubBottom),
  };

  // State per active connection
  const activeSolar   = production > 0;
  const activeBatToLoad = batteryToLoad > 0;
  const activeGrid    = gridToLoad > 0;
  const activeSolBat  = solarToBattery > 0;
  const activeSolGrid = solarToGrid > 0;

  const batteryColor = batteryLevel >= 60 ? '#34d399' : batteryLevel >= 30 ? '#fbbf24' : '#f87171';
  const batteryStatus = solarToBattery > 0 ? 'Cargando' : batteryToLoad > 0 ? 'Descargando' : 'En espera';

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Flujo de energía</h2>
          <p className="text-xs text-slate-500 mt-0.5">Estimación — próxima hora</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${production >= consumption ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {production >= consumption ? 'Excedente' : 'Déficit'} {Math.abs(production - consumption).toFixed(1)} kW
        </span>
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ maxHeight: 320 }}>
        <defs>
          {/* Paths with IDs for animateMotion */}
          <path id="path-solar"   d={paths.solar}   />
          <path id="path-grid"    d={paths.grid}    />
          <path id="path-battery" d={paths.battery} />
          <path id="path-load"    d={paths.load}    />

          {/* Reversed paths for opposite direction animation */}
          {/* We control direction with keyPoints instead */}
        </defs>

        {/* ── CONNECTOR LINES ── */}

        {/* Solar line */}
        <path
          d={paths.solar} fill="none"
          stroke={activeSolar ? '#fbbf24' : '#1e293b'}
          strokeWidth={activeSolar ? 2.5 : 1.5}
          strokeOpacity={activeSolar ? 0.4 : 1}
          strokeLinecap="round"
        />
        {/* Grid line */}
        <path
          d={paths.grid} fill="none"
          stroke={activeGrid || activeSolGrid ? '#7dd3fc' : '#1e293b'}
          strokeWidth={activeGrid || activeSolGrid ? 2.5 : 1.5}
          strokeOpacity={activeGrid || activeSolGrid ? 0.4 : 1}
          strokeLinecap="round"
        />
        {/* Battery line */}
        <path
          d={paths.battery} fill="none"
          stroke={activeSolBat || activeBatToLoad ? batteryColor : '#1e293b'}
          strokeWidth={activeSolBat || activeBatToLoad ? 2.5 : 1.5}
          strokeOpacity={activeSolBat || activeBatToLoad ? 0.4 : 1}
          strokeLinecap="round"
        />
        {/* Load line */}
        <path
          d={paths.load} fill="none"
          stroke={solarToLoad > 0 || activeBatToLoad || activeGrid ? '#4ade80' : '#1e293b'}
          strokeWidth={solarToLoad > 0 || activeBatToLoad || activeGrid ? 2.5 : 1.5}
          strokeOpacity={solarToLoad > 0 || activeBatToLoad || activeGrid ? 0.4 : 1}
          strokeLinecap="round"
        />

        {/* ── ANIMATED DOTS ── */}

        {/* Solar → Hub */}
        {activeSolar && (
          <>
            <FlowDot pathId="path-solar" color="#fbbf24" dur="1.8s" begin="0s" />
            <FlowDot pathId="path-solar" color="#fbbf24" dur="1.8s" begin="0.6s" />
            <FlowDot pathId="path-solar" color="#fbbf24" dur="1.8s" begin="1.2s" />
          </>
        )}

        {/* Hub → Grid (solar export) */}
        {activeSolGrid && (
          <>
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="0s"   reverse />
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="0.6s" reverse />
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="1.2s" reverse />
          </>
        )}
        {/* Grid → Hub (import) */}
        {activeGrid && (
          <>
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="0s" />
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="0.6s" />
            <FlowDot pathId="path-grid" color="#7dd3fc" dur="1.8s" begin="1.2s" />
          </>
        )}

        {/* Solar → Battery */}
        {activeSolBat && (
          <>
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="0s"   reverse />
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="0.67s" reverse />
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="1.33s" reverse />
          </>
        )}
        {/* Battery → Hub */}
        {activeBatToLoad && (
          <>
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="0s" />
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="0.67s" />
            <FlowDot pathId="path-battery" color={batteryColor} dur="2s" begin="1.33s" />
          </>
        )}

        {/* Hub → Load */}
        {(solarToLoad > 0 || activeBatToLoad || activeGrid) && (
          <>
            <FlowDot pathId="path-load" color="#4ade80" dur="1.8s" begin="0s"   reverse />
            <FlowDot pathId="path-load" color="#4ade80" dur="1.8s" begin="0.6s" reverse />
            <FlowDot pathId="path-load" color="#4ade80" dur="1.8s" begin="1.2s" reverse />
          </>
        )}

        {/* ── HUB (center) ── */}
        <HubIcon cx={HUB.x} cy={HUB.y} />

        {/* ── NODES ── */}

        {/* Solar */}
        <NodeCircle cx={SOLAR.x} cy={SOLAR.y} color="#fbbf24">
          <SolarIcon cx={SOLAR.x} cy={SOLAR.y} size={28} />
        </NodeCircle>
        {/* Solar label */}
        <text x={SOLAR.x + 42} y={SOLAR.y - 10} fontSize={13} fontWeight="700" fill="#fbbf24">
          {production.toFixed(2)} kW
        </text>
        <text x={SOLAR.x + 42} y={SOLAR.y + 6} fontSize={11} fill="#94a3b8">FV Solar</text>

        {/* Grid */}
        <NodeCircle cx={GRID.x} cy={GRID.y} color="#7dd3fc">
          <GridIcon cx={GRID.x} cy={GRID.y} />
        </NodeCircle>
        {/* Grid label (left-aligned since it's on the right) */}
        <text x={GRID.x - 42} y={GRID.y - 10} fontSize={13} fontWeight="700" fill="#7dd3fc" textAnchor="end">
          {(solarToGrid > 0 ? solarToGrid : gridToLoad > 0 ? gridToLoad : 0).toFixed(2)} kW
        </text>
        <text x={GRID.x - 42} y={GRID.y + 6} fontSize={11} fill="#94a3b8" textAnchor="end">
          {solarToGrid > 0 ? 'Exportando' : gridToLoad > 0 ? 'Importando' : 'Red'}
        </text>

        {/* Battery */}
        <NodeCircle cx={BATTERY.x} cy={BATTERY.y} color={batteryColor}>
          <BatteryIcon cx={BATTERY.x} cy={BATTERY.y} level={batteryLevel} />
        </NodeCircle>
        {/* Battery label */}
        <text x={BATTERY.x - 8} y={BATTERY.y - 48} fontSize={11} fill="#94a3b8" textAnchor="middle">
          {batteryLevel.toFixed(0)}%
        </text>
        <text x={BATTERY.x + 42} y={BATTERY.y - 10} fontSize={13} fontWeight="700" fill={batteryColor}>
          {(solarToBattery > 0 ? solarToBattery : batteryToLoad).toFixed(2)} kW
        </text>
        <text x={BATTERY.x + 42} y={BATTERY.y + 6} fontSize={11} fill="#94a3b8">{batteryStatus}</text>

        {/* Load / Consumption */}
        <NodeCircle cx={LOAD.x} cy={LOAD.y} color="#4ade80">
          <LoadIcon cx={LOAD.x} cy={LOAD.y} />
        </NodeCircle>
        {/* Load label */}
        <text x={LOAD.x - 42} y={LOAD.y - 10} fontSize={13} fontWeight="700" fill="#4ade80" textAnchor="end">
          {consumption.toFixed(2)} kW
        </text>
        <text x={LOAD.x - 42} y={LOAD.y + 6} fontSize={11} fill="#94a3b8" textAnchor="end">Consumo</text>
      </svg>
    </div>
  );
}
