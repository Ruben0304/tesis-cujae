'use client';

import React, { useEffect, useMemo, useState } from "react";
import type { EnergyFlow } from "@/types";

// ─── Paleta pastel refinada ───────────────────────────────────────────────────
const C = {
  solar:  { light: "#f0b43c", mid: "#d88b13", dark: "#8c5a09", glow: "#f0b43c16" },
  grid:   { light: "#4b5563", mid: "#374151", dark: "#111827", glow: "#4b556316" },
  batHi:  { light: "#63d9a5", mid: "#39b987", dark: "#20815d", glow: "#63d9a516" },
  batMid: { light: "#63d9a5", mid: "#39b987", dark: "#20815d", glow: "#63d9a516" },
  batLo:  { light: "#63d9a5", mid: "#39b987", dark: "#20815d", glow: "#63d9a516" },
  load:   { light: "#5db7ff", mid: "#258fe3", dark: "#135f9f", glow: "#5db7ff16" },
  hub:    { light: "#8c98aa", mid: "#637086", dark: "#465165", glow: "#8c98aa14" },
};

function batColor(level: number) {
  if (level >= 55) return C.batHi;
  if (level >= 25) return C.batMid;
  return C.batLo;
}

// ─── SVG Icons (minimales) ───────────────────────────────────────────────────

const IconSun = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.5" />
    {[0,45,90,135,180,225,270,315].map((deg, i) => {
      const r = Math.PI * deg / 180;
      return <line key={i} x1={12+Math.cos(r)*6.8} y1={12+Math.sin(r)*6.8} x2={12+Math.cos(r)*9.5} y2={12+Math.sin(r)*9.5} />;
    })}
  </svg>
);

const IconBolt = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const IconBattery = ({ level }: { level: number }) => {
  const fill = Math.round((level / 100) * 12);
  return (
    <svg width="22" height="18" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="19" height="12" rx="2.5" />
      <path d="M20 7v4" strokeLinecap="round" />
      <rect x="3" y="5" width={fill} height="8" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
};

const IconHome = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M3 12L12 4l9 8" />
    <path d="M5 10v10h14V10" />
    <rect x="9" y="15" width="6" height="5" rx="0.5" />
  </svg>
);

const IconInverter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 14h2l1.5-3.5 2 5 1.5-3.5H17" />
  </svg>
);

// ─── Layout ───────────────────────────────────────────────────────────────────

const VW  = 680;
const VH  = 560;
const NR  = 52;   // node radius — grande para caber texto dentro
const HUB_WIDTH = 116;
const HUB_HEIGHT = 78;

const SOLAR = { x: 110,      y: 105 };
const GRID  = { x: VW - 110, y: 105 };
const BAT   = { x: 110,      y: VH - 105 };
const LOAD  = { x: VW - 110, y: VH - 105 };
const HUB   = { x: VW / 2,   y: VH / 2 };

const TOP_Y   = HUB.y - HUB_HEIGHT / 2;
const BOT_Y   = HUB.y + HUB_HEIGHT / 2;
const LEFT_X  = HUB.x - HUB_WIDTH / 2;
const RIGHT_X = HUB.x + HUB_WIDTH / 2;

// Caminos independientes — ningún segmento compartido
const PDEFS = {
  solarToHub: `M ${SOLAR.x} ${SOLAR.y + NR} V ${TOP_Y} H ${LEFT_X}`,
  gridToHub:  `M ${GRID.x}  ${GRID.y  + NR} V ${TOP_Y} H ${RIGHT_X}`,
  batToHub:   `M ${BAT.x}   ${BAT.y   - NR} V ${BOT_Y} H ${LEFT_X}`,
  hubToBat:   `M ${LEFT_X}  ${BOT_Y}         H ${BAT.x}  V ${BAT.y  - NR}`,
  hubToGrid:  `M ${RIGHT_X} ${TOP_Y}          H ${GRID.x} V ${GRID.y + NR}`,
  hubToLoad:  `M ${RIGHT_X} ${BOT_Y}          H ${LOAD.x} V ${LOAD.y - NR}`,
};

const FLOW_NODE_STORAGE_KEY = "gd_flow_node_overrides";

type FlowNodeKey = "solar" | "grid" | "battery" | "consumo" | "hub";

type ManualNodeOverride = {
  mode: "prediction" | "manual";
  manualValue: number;
};

type ManualNodeOverrides = Partial<Record<FlowNodeKey, ManualNodeOverride>>;

// ─── Dot animado ─────────────────────────────────────────────────────────────

function FlowDots({ pathId, color, active, dur = 3 }: {
  pathId: string; color: string; active: boolean; dur?: number;
}) {
  if (!active) return null;
  return (
    <>
      {[0, dur / 3, (dur * 2) / 3].map((delay, i) => (
        <circle key={i} r={4} fill={color} fillOpacity={0.75}>
          <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" calcMode="linear">
            <mpath href={`#${pathId}`} />
          </animateMotion>
        </circle>
      ))}
    </>
  );
}

// ─── Línea de track ──────────────────────────────────────────────────────────

function TrackLine({
  d,
  col,
  active,
  idleStroke = "rgba(148,163,184,0.45)",
}: {
  d: string;
  col: { light: string };
  active: boolean;
  idleStroke?: string;
}) {
  return (
    <path
      d={d} fill="none"
      stroke={active ? col.light : idleStroke}
      strokeWidth={active ? 3.8 : 1.5}
      strokeOpacity={active ? 0.95 : 1}
      strokeLinecap="round"
    />
  );
}

// ─── Nodo circular — texto e ícono dentro ────────────────────────────────────

interface NodeDef {
  cx: number; cy: number;
  col: typeof C.solar;
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}

function Node({ cx, cy, col, icon, label, value, onClick }: NodeDef) {
  return (
    <g
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <text
        x={cx}
        y={cy - NR - 16}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#6b7280"
      >
        {label}
      </text>

      <circle cx={cx} cy={cy} r={NR + 8} fill={col.glow} />
      <circle cx={cx} cy={cy} r={NR} fill="#ffffff" />
      <circle cx={cx} cy={cy} r={NR} fill="none"
        stroke={col.light} strokeWidth={1.6} />

      <g transform={`translate(${cx - 10}, ${cy - 30})`} style={{ color: col.mid }}>
        {icon}
      </g>

      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fill={col.mid}
      >
        {value}
      </text>

      <text
        x={cx}
        y={cy + 24}
        textAnchor="middle"
        fontSize="10"
        fontWeight="500"
        fill="#9ca3af"
      >
        kW
      </text>
    </g>
  );
}

// ─── Hub central ─────────────────────────────────────────────────────────────

function Hub({
  cx,
  cy,
  capacityValue,
  onClick,
}: {
  cx: number;
  cy: number;
  capacityValue: string;
  onClick?: () => void;
}) {
  return (
    <g
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <text
        x={cx}
        y={cy - 50}
        textAnchor="middle"
        fontSize="10"
        fontWeight="600"
        fill="#6b7280"
      >
        Inversor
      </text>
      <rect
        x={cx - HUB_WIDTH / 2}
        y={cy - HUB_HEIGHT / 2}
        width={HUB_WIDTH}
        height={HUB_HEIGHT}
        rx={22}
        fill="#ffffff"
      />
      <rect
        x={cx - HUB_WIDTH / 2}
        y={cy - HUB_HEIGHT / 2}
        width={HUB_WIDTH}
        height={HUB_HEIGHT}
        rx={22}
        fill="none"
        stroke={C.hub.light}
        strokeWidth={1.8}
      />
      <g transform={`translate(${cx - 10}, ${cy - 20})`} style={{ color: C.hub.mid }}>
        <IconInverter />
      </g>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill={C.hub.mid}
      >
        {capacityValue}
      </text>
    </g>
  );
}

// ─── Gradients definition ─────────────────────────────────────────────────────

function GradDefs() {
  return (
    <defs>
      {/* Paths para animateMotion */}
      {Object.entries(PDEFS).map(([id, d]) => (
        <path key={id} id={`p-${id}`} d={d} fill="none" />
      ))}
    </defs>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type FlujoEnergiaProps = {
  values?: { solar: number; battery: number; grid: number; consumo: number };
  batteryLevel?: number;
  unit?: string;
  energyFlow?: EnergyFlow | null;
  production?: number;
  consumption?: number;
  batteryPowerFlow?: number;
  inverterCapacityKw?: number;
};

const safe = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;

export default function FlujoEnergia({
  values = { solar: 0, battery: 0, grid: 0, consumo: 0 },
  batteryLevel = 100,
  unit = "kW",
  energyFlow,
  production,
  consumption,
  batteryPowerFlow,
  inverterCapacityKw,
}: FlujoEnergiaProps) {
  const solarToBattery  = safe(energyFlow?.solarToBattery);
  const solarToLoad     = safe(energyFlow?.solarToLoad ?? values.solar);
  const solarToGrid     = safe(energyFlow?.solarToGrid);
  const batteryToLoad   = safe(energyFlow?.batteryToLoad ?? values.battery);
  const gridToLoad      = safe(energyFlow?.gridToLoad ?? values.grid);

  const productionKw  = safe(production ?? solarToLoad + solarToBattery + solarToGrid);
  const consumptionKw = safe(consumption ?? values.consumo);

  const batteryChargeKw    = batteryPowerFlow && batteryPowerFlow > 0 ? batteryPowerFlow : solarToBattery;
  const batteryDischargeKw = batteryPowerFlow && batteryPowerFlow < 0 ? Math.abs(batteryPowerFlow) : batteryToLoad;
  const batteryKw          = Math.max(batteryChargeKw, batteryDischargeKw);
  const gridKw             = Math.max(solarToGrid, gridToLoad);
  const inverterKw         = Math.max(solarToLoad + batteryToLoad + gridToLoad, solarToBattery + solarToGrid);
  const inverterCapacity = Math.max(inverterCapacityKw ?? productionKw ?? 0, inverterKw, 0.1);
  const solarFlowActive = productionKw > 0 || solarToLoad > 0 || solarToBattery > 0 || solarToGrid > 0;

  const batCol = batColor(batteryLevel);
  const [overrides, setOverrides] = useState<ManualNodeOverrides>({});
  const [activeNode, setActiveNode] = useState<FlowNodeKey | null>(null);
  const [draftMode, setDraftMode] = useState<"prediction" | "manual">("prediction");
  const [draftValue, setDraftValue] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FLOW_NODE_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as ManualNodeOverrides;
      setOverrides(parsed);
    } catch (error) {
      console.warn("No se pudieron cargar los valores manuales del flujo.", error);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLOW_NODE_STORAGE_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.warn("No se pudieron guardar los valores manuales del flujo.", error);
    }
  }, [overrides]);

  const predictedValues = useMemo<Record<FlowNodeKey, number>>(() => ({
    solar: productionKw,
    grid: gridKw,
    battery: batteryKw,
    consumo: consumptionKw,
    hub: inverterKw,
  }), [batteryKw, consumptionKw, gridKw, inverterKw, productionKw]);

  const resolvedValues = useMemo<Record<FlowNodeKey, number>>(() => {
    return {
      solar: overrides.solar?.mode === "manual" ? overrides.solar.manualValue : predictedValues.solar,
      grid: overrides.grid?.mode === "manual" ? overrides.grid.manualValue : predictedValues.grid,
      battery: overrides.battery?.mode === "manual" ? overrides.battery.manualValue : predictedValues.battery,
      consumo: overrides.consumo?.mode === "manual" ? overrides.consumo.manualValue : predictedValues.consumo,
      hub: overrides.hub?.mode === "manual" ? overrides.hub.manualValue : predictedValues.hub,
    };
  }, [overrides, predictedValues]);

  const openNodeModal = (node: FlowNodeKey) => {
    const existing = overrides[node];
    setActiveNode(node);
    setDraftMode(existing?.mode ?? "prediction");
    setDraftValue(String(existing?.manualValue ?? predictedValues[node].toFixed(1)));
  };

  const closeNodeModal = () => {
    setActiveNode(null);
  };

  const saveNodeOverride = () => {
    if (!activeNode) return;
    const numericValue = Number(draftValue);
    const safeValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : predictedValues[activeNode];

    setOverrides((current) => ({
      ...current,
      [activeNode]: {
        mode: draftMode,
        manualValue: safeValue,
      },
    }));

    closeNodeModal();
  };

  const activePredictionValue = activeNode ? predictedValues[activeNode] : 0;
  const activeOverride = activeNode ? overrides[activeNode] : undefined;
  const activeLabelMap: Record<FlowNodeKey, string> = {
    solar: "FV",
    grid: "Red eléctrica",
    battery: "Batería",
    consumo: "Consumo",
    hub: "Inversor",
  };

  return (
    <div className="w-full select-none">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ overflow: "visible" }}>
        <GradDefs />

        {/* ── TRACKS ── */}
        <TrackLine d={PDEFS.solarToHub} col={C.solar}  active={solarFlowActive} idleStroke={C.solar.mid} />
        <TrackLine d={PDEFS.gridToHub}  col={C.grid}   active={gridToLoad > 0} idleStroke={C.grid.mid} />
        <TrackLine d={PDEFS.hubToGrid}  col={C.grid}   active={solarToGrid > 0} idleStroke={C.grid.mid} />
        <TrackLine d={PDEFS.batToHub}   col={batCol}   active={batteryDischargeKw > 0} idleStroke={batCol.mid} />
        <TrackLine d={PDEFS.hubToBat}   col={batCol}   active={batteryChargeKw > 0} idleStroke={batCol.mid} />
        <TrackLine d={PDEFS.hubToLoad}  col={C.load}   active={consumptionKw > 0} />

        {/* ── DOTS ── */}
        <FlowDots pathId="p-solarToHub" color={C.solar.light}  active={solarFlowActive}       dur={3.2} />
        <FlowDots pathId="p-gridToHub"  color={C.grid.light}   active={gridToLoad > 0}          dur={3.6} />
        <FlowDots pathId="p-hubToGrid"  color={C.grid.light}   active={solarToGrid > 0}         dur={3.6} />
        <FlowDots pathId="p-batToHub"   color={batCol.light}   active={batteryDischargeKw > 0}  dur={3.4} />
        <FlowDots pathId="p-hubToBat"   color={batCol.light}   active={batteryChargeKw > 0}     dur={3.4} />
        <FlowDots pathId="p-hubToLoad"  color={C.load.light}   active={consumptionKw > 0}       dur={3.0} />

        {/* ── NODOS ── */}

        {/* Solar */}
        <Node
          cx={SOLAR.x} cy={SOLAR.y}
          col={C.solar}
          icon={<IconSun />}
          label="FV"
          value={resolvedValues.solar.toFixed(0)}
          onClick={() => openNodeModal("solar")}
        />

        {/* Red */}
        <Node
          cx={GRID.x} cy={GRID.y}
          col={C.grid}
          icon={<IconBolt />}
          label="Red eléctrica"
          value={resolvedValues.grid.toFixed(0)}
          onClick={() => openNodeModal("grid")}
        />

        {/* Batería */}
        <Node
          cx={BAT.x} cy={BAT.y}
          col={batCol}
          icon={<IconBattery level={batteryLevel} />}
          label="Batería"
          value={resolvedValues.battery.toFixed(0)}
          onClick={() => openNodeModal("battery")}
        />

        {/* Consumo */}
        <Node
          cx={LOAD.x} cy={LOAD.y}
          col={C.load}
          icon={<IconHome />}
          label="Consumo"
          value={resolvedValues.consumo.toFixed(0)}
          onClick={() => openNodeModal("consumo")}
        />

        {/* Hub */}
        <Hub
          cx={HUB.x}
          cy={HUB.y}
          capacityValue={`${inverterCapacity.toFixed(0)} kW`}
          onClick={() => openNodeModal("hub")}
        />
      </svg>

      {activeNode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
          onClick={closeNodeModal}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-6 py-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Configurar nodo
              </p>
              <h3 className="text-2xl font-semibold text-gray-900">
                {activeLabelMap[activeNode]}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Selecciona si quieres usar la prediccion actual o un valor manual persistente.
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDraftMode("prediction")}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${draftMode === "prediction"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-gray-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="text-sm font-semibold">Prediccion</div>
                  <div className="mt-1 text-xs">
                    {activePredictionValue.toFixed(1)} {unit}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDraftMode("manual")}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${draftMode === "manual"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-gray-600 hover:bg-slate-50"
                    }`}
                >
                  <div className="text-sm font-semibold">Valor manual</div>
                  <div className="mt-1 text-xs">
                    Persistente
                  </div>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Valor manual
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  disabled={draftMode !== "manual"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Actual: {(activeOverride?.mode === "manual" ? activeOverride.manualValue : activePredictionValue).toFixed(1)} {unit}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeNodeModal}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveNodeOverride}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
