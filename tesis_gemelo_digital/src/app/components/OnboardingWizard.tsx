'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { executeMutation } from '@/lib/graphql-client';
import { ArrowRightIcon, ArrowLeftIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// Lazy-load Leaflet map (client-only, no SSR)
const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f7',
        color: '#86868b',
        fontSize: 12,
      }}
    >
      Cargando mapa…
    </div>
  ),
});

// ─── GraphQL ──────────────────────────────────────────────────────────────────

const SAVE_LOCATION_MUTATION = `
  mutation SaveLocationConfig($input: LocationConfigInput!) {
    saveLocationConfig(input: $input) { lat lon name }
  }
`;

const CREATE_PANEL_MUTATION = `
  mutation CreatePanel($input: PanelInput!) {
    createPanel(input: $input) { _id }
  }
`;

const CREATE_BATTERY_MUTATION = `
  mutation CreateBattery($input: BatteryInput!) {
    createBattery(input: $input) { _id }
  }
`;

// ─── Presets ──────────────────────────────────────────────────────────────────

const LOCATION_PRESETS = [
  { name: 'La Habana, Cuba',      lat: 23.1136,  lon: -82.3666 },
  { name: 'Santiago de Cuba',     lat: 20.0174,  lon: -75.8171 },
  { name: 'Matanzas, Cuba',       lat: 23.0444,  lon: -81.5776 },
  { name: 'Santa Clara, Cuba',    lat: 22.4065,  lon: -79.9635 },
  { name: 'Camagüey, Cuba',       lat: 21.3809,  lon: -77.9172 },
  { name: 'Holguín, Cuba',        lat: 20.8874,  lon: -76.2674 },
  { name: 'Cienfuegos, Cuba',     lat: 22.1469,  lon: -80.4478 },
  { name: 'Pinar del Río, Cuba',  lat: 22.4170,  lon: -83.6989 },
];

const ORIENTATIONS = ['Sur', 'Sureste', 'Suroeste', 'Este', 'Oeste', 'Norte'];

// Apple-inspired palette
const C = {
  text: '#1d1d1f',
  text2: '#424245',
  text3: '#6e6e73',
  text4: '#86868b',
  border: '#d2d2d7',
  borderLight: '#e5e5e7',
  bg: '#fbfbfd',
  bgChip: '#f5f5f7',
  white: '#ffffff',
  blue: '#0071e3',
  blueHover: '#0077ed',
  green: '#34c759',
  greenDark: '#26a749',
  dark: '#1d1d1f',
};

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Segoe UI", system-ui, sans-serif';

// ─── Animated number counter ──────────────────────────────────────────────────

function useAnimatedNumber(value: number, duration = 400) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
}

type Direction = 'forward' | 'backward' | 'none';

// ─── Reusable form components ─────────────────────────────────────────────────

function Field({
  label, description, children, delay = 0, required,
}: {
  label: string; description?: string; children: React.ReactNode; delay?: number; required?: boolean;
}) {
  return (
    <div className="wiz-stagger" style={{ animationDelay: `${delay}ms` }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          fontSize: 13.5,
          fontWeight: 500,
          color: C.text,
          marginBottom: description ? 4 : 8,
          lineHeight: 1.3,
        }}
      >
        {label}
        {required && (
          <span style={{ fontSize: 12, color: C.text4, fontWeight: 400 }}>
            (requerido)
          </span>
        )}
      </label>
      {description && (
        <p style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.45, marginBottom: 8 }}>
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

function Input({
  value, onChange, type = 'text', placeholder, step, min, max,
}: {
  value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; step?: string;
  min?: string; max?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min={min}
      max={max}
      className="wiz-input"
      style={{
        width: '100%',
        fontFamily: FONT_STACK,
        fontSize: 15,
        color: C.text,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '11px 14px',
        outline: 'none',
        transition: 'all 0.15s ease',
      }}
    />
  );
}

function Select({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="wiz-input"
        style={{
          width: '100%',
          fontFamily: FONT_STACK,
          fontSize: 15,
          color: C.text,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '11px 38px 11px 14px',
          outline: 'none',
          transition: 'all 0.15s ease',
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: C.text4,
        }}
      >
        <svg width="11" height="7" viewBox="0 0 12 8" fill="none">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}

function SectionLabel({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      className="wiz-stagger"
      style={{
        animationDelay: `${delay}ms`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 4,
        marginBottom: -4,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text4,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.borderLight }} />
    </div>
  );
}

function PrimaryButton({
  onClick, loading, disabled, children, delay = 0,
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode; delay?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="wiz-stagger wiz-btn-primary"
      style={{
        animationDelay: `${delay}ms`,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontFamily: FONT_STACK,
        fontSize: 15,
        fontWeight: 500,
        color: C.white,
        background: C.dark,
        borderRadius: 10,
        padding: '13px 22px',
        border: 'none',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.4 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'all 0.18s ease',
      }}
    >
      {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

function SkipLink({ onClick, delay = 0, label = 'Omitir este paso' }: { onClick: () => void; delay?: number; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="wiz-stagger wiz-link"
      style={{
        animationDelay: `${delay}ms`,
        width: '100%',
        fontFamily: FONT_STACK,
        fontSize: 13.5,
        fontWeight: 400,
        color: C.blue,
        padding: '10px 0',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="wiz-back-btn"
      style={{
        position: 'absolute',
        top: 22,
        left: 22,
        width: 34,
        height: 34,
        borderRadius: 999,
        background: C.bgChip,
        color: C.text2,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 10,
        transition: 'all 0.15s ease',
      }}
      aria-label="Volver"
    >
      <ArrowLeftIcon className="w-4 h-4" strokeWidth={2.2} />
    </button>
  );
}

function ProgressIndicator({ step }: { step: number }) {
  const labels = ['Ubicación', 'Paneles', 'Baterías'];
  return (
    <div style={{ width: '100%', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        {labels.map((label, idx) => {
          const n = idx + 1;
          const filled = step >= n;
          const active = step === n;
          return (
            <div key={n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div
                style={{
                  width: '100%',
                  height: 3,
                  borderRadius: 999,
                  background: filled ? C.dark : C.borderLight,
                  transition: 'background 0.5s ease',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 500,
                  color: filled ? C.text : C.text4,
                  letterSpacing: '0.02em',
                  transition: 'color 0.3s ease',
                }}
              >
                {n}. {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepHeader({
  eyebrow, title, description,
}: {
  eyebrow: string; title: string; description: string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p
        className="wiz-stagger"
        style={{
          animationDelay: '0ms',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.text4,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </p>
      <h2
        className="wiz-stagger"
        style={{
          animationDelay: '60ms',
          fontSize: 26,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h2>
      <p
        className="wiz-stagger"
        style={{
          animationDelay: '120ms',
          fontSize: 14.5,
          color: C.text2,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  );
}

// ─── Step content ──────────────────────────────────────────────────────────────

function WelcomeContent({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div>
      <p
        className="wiz-stagger"
        style={{
          animationDelay: '0ms',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.green,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Asistente de configuración
      </p>

      <h1
        className="wiz-stagger"
        style={{
          animationDelay: '60ms',
          fontSize: 32,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          marginBottom: 14,
        }}
      >
        Configure su sistema fotovoltaico
      </h1>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '120ms',
          fontSize: 15,
          color: C.text2,
          lineHeight: 1.55,
          marginBottom: 28,
        }}
      >
        Este asistente le guiará en la configuración inicial del gemelo digital.
        Los parámetros que ingrese se utilizarán para los cálculos de producción
        solar, predicciones meteorológicas y estimaciones de autonomía energética.
      </p>

      <div
        className="wiz-stagger"
        style={{
          animationDelay: '180ms',
          background: C.bgChip,
          borderRadius: 12,
          padding: '18px 20px',
          marginBottom: 24,
        }}
      >
        <p
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: C.text4,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Lo que vamos a configurar
        </p>

        {[
          { n: '1', title: 'Ubicación geográfica', sub: 'Coordenadas de la instalación.' },
          { n: '2', title: 'Arreglo fotovoltaico', sub: 'Especificaciones de los paneles solares.' },
          { n: '3', title: 'Sistema de almacenamiento', sub: 'Capacidad de las baterías.' },
        ].map((item, i) => (
          <div
            key={item.n}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              paddingTop: i === 0 ? 0 : 12,
              paddingBottom: i === 2 ? 0 : 12,
              borderBottom: i < 2 ? `1px solid ${C.borderLight}` : 'none',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: C.white,
                border: `1px solid ${C.border}`,
                color: C.text2,
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              {item.n}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>
                {item.title}
              </p>
              <p style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.4 }}>
                {item.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '240ms',
          fontSize: 13,
          color: C.text3,
          lineHeight: 1.5,
          marginBottom: 24,
        }}
      >
        Tiempo estimado: 2 minutos. Toda la información puede modificarse
        posteriormente desde la sección de Ajustes.
      </p>

      <PrimaryButton onClick={onStart} delay={300}>
        Comenzar configuración
        <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
      </PrimaryButton>

      <SkipLink onClick={onSkip} delay={340} label="Omitir y configurar manualmente más tarde" />
    </div>
  );
}

function LocationContent({
  onSave, onSkip,
}: {
  onSave: (data: { lat: number; lon: number; name: string }) => Promise<void>;
  onSkip: () => void;
}) {
  const [preset, setPreset] = useState('La Habana, Cuba');
  const [lat, setLat] = useState('23.1136');
  const [lon, setLon] = useState('-82.3666');
  const [name, setName] = useState('La Habana, Cuba');
  const [saving, setSaving] = useState(false);

  const handlePreset = (val: string) => {
    setPreset(val);
    const p = LOCATION_PRESETS.find(p => p.name === val);
    if (p) { setLat(String(p.lat)); setLon(String(p.lon)); setName(p.name); }
  };

  const handleMapPick = (newLat: number, newLon: number) => {
    setLat(newLat.toFixed(4));
    setLon(newLon.toFixed(4));
    setPreset('__custom__');
  };

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lonN = parseFloat(lon);
    if (isNaN(latN) || isNaN(lonN) || !name.trim()) { onSkip(); return; }
    setSaving(true);
    await onSave({ lat: latN, lon: lonN, name: name.trim() });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 1 de 3"
        title="Ubicación geográfica"
        description="Especifique la ubicación de la instalación. Estos datos se utilizan para calcular la radiación solar disponible y para obtener pronósticos meteorológicos del servicio Open-Meteo."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionLabel delay={180}>Selección rápida</SectionLabel>

        <Field
          label="Localidad"
          description="Seleccione una ciudad cubana preconfigurada o elija «Personalizada» para introducir coordenadas manualmente."
          delay={220}
        >
          <Select
            value={preset}
            onChange={handlePreset}
            options={[
              ...LOCATION_PRESETS.map(p => ({ value: p.name, label: p.name })),
              { value: '__custom__', label: 'Coordenadas personalizadas' },
            ]}
          />
        </Field>

        <SectionLabel delay={260}>Coordenadas</SectionLabel>

        <div
          className="wiz-stagger"
          style={{ animationDelay: '290ms' }}
        >
          <p style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.45, marginBottom: 10 }}>
            Haga clic en el mapa para seleccionar la ubicación, o arrastre el marcador. Los campos siguientes se actualizarán automáticamente.
          </p>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 240,
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              background: '#f5f5f7',
            }}
          >
            <MapPicker
              lat={Number.isFinite(latNum) ? latNum : 23.1136}
              lon={Number.isFinite(lonNum) ? lonNum : -82.3666}
              onChange={handleMapPick}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Latitud"
            description="Grados decimales (-90 a 90)."
            delay={330}
          >
            <Input
              value={lat}
              onChange={v => { setLat(v); setPreset('__custom__'); }}
              type="number"
              step="0.0001"
              min="-90"
              max="90"
              placeholder="23.1136"
            />
          </Field>
          <Field
            label="Longitud"
            description="Grados decimales (-180 a 180)."
            delay={370}
          >
            <Input
              value={lon}
              onChange={v => { setLon(v); setPreset('__custom__'); }}
              type="number"
              step="0.0001"
              min="-180"
              max="180"
              placeholder="-82.3666"
            />
          </Field>
        </div>

        <Field
          label="Nombre del sistema"
          description="Etiqueta descriptiva que aparecerá en reportes y en el panel principal."
          delay={410}
        >
          <Input value={name} onChange={setName} placeholder="CUJAE — La Habana, Cuba" />
        </Field>
      </div>

      <div style={{ marginTop: 28 }}>
        <PrimaryButton onClick={handleSave} loading={saving} delay={470}>
          Continuar
          <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
        </PrimaryButton>
        <SkipLink onClick={onSkip} delay={510} />
      </div>
    </div>
  );
}

function PanelContent({
  onSave, onSkip,
}: {
  onSave: (data: {
    manufacturer: string; model?: string; ratedPowerKw: number;
    quantity: number; tiltDegrees?: number; orientation?: string;
  }) => Promise<void>;
  onSkip: () => void;
}) {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [ratedPowerKw, setRatedPowerKw] = useState('0.55');
  const [quantity, setQuantity] = useState('10');
  const [tiltDegrees, setTiltDegrees] = useState('15');
  const [orientation, setOrientation] = useState('Sur');
  const [saving, setSaving] = useState(false);

  const totalKw = (parseFloat(ratedPowerKw) || 0) * (parseInt(quantity) || 0);
  const animatedTotal = useAnimatedNumber(totalKw);

  const handleSave = async () => {
    const kw = parseFloat(ratedPowerKw);
    const qty = parseInt(quantity);
    if (!manufacturer.trim() || !Number.isFinite(kw) || kw <= 0 || !Number.isFinite(qty) || qty <= 0) {
      onSkip();
      return;
    }
    setSaving(true);
    await onSave({
      manufacturer: manufacturer.trim(),
      model: model.trim() || undefined,
      ratedPowerKw: kw,
      quantity: qty,
      tiltDegrees: tiltDegrees ? parseFloat(tiltDegrees) : undefined,
      orientation: orientation || undefined,
    });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 2 de 3"
        title="Arreglo fotovoltaico"
        description="Registre las especificaciones técnicas de sus paneles solares. La potencia total instalada es el parámetro principal del modelo de simulación de producción."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionLabel delay={180}>Identificación</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Fabricante" required delay={220}>
            <Input value={manufacturer} onChange={setManufacturer} placeholder="Canadian Solar" />
          </Field>
          <Field label="Modelo" description="Opcional." delay={260}>
            <Input value={model} onChange={setModel} placeholder="CS6R-550MS" />
          </Field>
        </div>

        <SectionLabel delay={300}>Características técnicas</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Potencia por panel"
            description="Potencia nominal STC en kilowatts."
            delay={340}
          >
            <Input value={ratedPowerKw} onChange={setRatedPowerKw} type="number" step="0.01" min="0.01" placeholder="0.55" />
          </Field>
          <Field
            label="Número de paneles"
            description="Cantidad total del arreglo."
            delay={380}
          >
            <Input value={quantity} onChange={setQuantity} type="number" step="1" min="1" placeholder="10" />
          </Field>
        </div>

        <SectionLabel delay={420}>Geometría del montaje</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Inclinación"
            description="Ángulo respecto al plano horizontal (°)."
            delay={460}
          >
            <Input value={tiltDegrees} onChange={setTiltDegrees} type="number" step="1" min="0" max="90" placeholder="15" />
          </Field>
          <Field
            label="Orientación"
            description="Dirección de las caras frontales."
            delay={500}
          >
            <Select value={orientation} onChange={setOrientation} options={ORIENTATIONS.map(o => ({ value: o, label: o }))} />
          </Field>
        </div>
      </div>

      {/* Summary */}
      <div
        className="wiz-stagger"
        style={{
          animationDelay: '540ms',
          marginTop: 22,
          background: C.bgChip,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 13, color: C.text3 }}>Potencia instalada estimada</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {animatedTotal > 0.05 ? animatedTotal.toFixed(1) : '—'}
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text3, marginLeft: 4 }}>kW</span>
        </span>
      </div>

      <div style={{ marginTop: 24 }}>
        <PrimaryButton onClick={handleSave} loading={saving} delay={580}>
          Continuar
          <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
        </PrimaryButton>
        <SkipLink onClick={onSkip} delay={620} />
      </div>
    </div>
  );
}

function BatteryContent({
  onSave, onSkip,
}: {
  onSave: (data: { manufacturer: string; model?: string; capacityKwh: number; quantity: number }) => Promise<void>;
  onSkip: () => void;
}) {
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [capacityKwh, setCapacityKwh] = useState('100');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const totalKwh = (parseFloat(capacityKwh) || 0) * (parseInt(quantity) || 0);
  const animatedTotal = useAnimatedNumber(totalKwh);

  const handleSave = async () => {
    const cap = parseFloat(capacityKwh);
    const qty = parseInt(quantity);
    if (!manufacturer.trim() || !Number.isFinite(cap) || cap <= 0 || !Number.isFinite(qty) || qty <= 0) {
      onSkip();
      return;
    }
    setSaving(true);
    await onSave({
      manufacturer: manufacturer.trim(),
      model: model.trim() || undefined,
      capacityKwh: cap,
      quantity: qty,
    });
    setSaving(false);
  };

  return (
    <div>
      <StepHeader
        eyebrow="Paso 3 de 3"
        title="Sistema de almacenamiento"
        description="Configure su banco de baterías. La capacidad total determina la autonomía del sistema durante períodos sin radiación solar o durante apagones."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SectionLabel delay={180}>Identificación</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Fabricante" required delay={220}>
            <Input value={manufacturer} onChange={setManufacturer} placeholder="CATL" />
          </Field>
          <Field label="Modelo" description="Opcional." delay={260}>
            <Input value={model} onChange={setModel} placeholder="LiFePO4-100" />
          </Field>
        </div>

        <SectionLabel delay={300}>Capacidad</SectionLabel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Capacidad por módulo"
            description="Capacidad nominal en kWh."
            delay={340}
          >
            <Input value={capacityKwh} onChange={setCapacityKwh} type="number" step="0.1" min="0.1" placeholder="100" />
          </Field>
          <Field
            label="Número de módulos"
            description="Cantidad de unidades."
            delay={380}
          >
            <Input value={quantity} onChange={setQuantity} type="number" step="1" min="1" placeholder="1" />
          </Field>
        </div>
      </div>

      <div
        className="wiz-stagger"
        style={{
          animationDelay: '420ms',
          marginTop: 22,
          background: C.bgChip,
          border: `1px solid ${C.borderLight}`,
          borderRadius: 10,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontSize: 13, color: C.text3 }}>Almacenamiento total estimado</span>
        <span style={{ fontSize: 17, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
          {animatedTotal > 0.5 ? animatedTotal.toFixed(0) : '—'}
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text3, marginLeft: 4 }}>kWh</span>
        </span>
      </div>

      <div style={{ marginTop: 24 }}>
        <PrimaryButton onClick={handleSave} loading={saving} delay={460}>
          Finalizar configuración
          <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
        </PrimaryButton>
        <SkipLink onClick={onSkip} delay={500} />
      </div>
    </div>
  );
}

function DoneContent({ onFinish }: { onFinish: () => void }) {
  return (
    <div>
      {/* Check badge — restrained, single icon */}
      <div className="wiz-stagger" style={{ animationDelay: '0ms', display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.white,
            boxShadow: `0 6px 20px -6px ${C.green}80`,
          }}
        >
          <CheckIcon className="w-7 h-7 wiz-check-pop" strokeWidth={2.8} />
        </div>
      </div>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '80ms',
          textAlign: 'center',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.green,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Configuración completada
      </p>

      <h2
        className="wiz-stagger"
        style={{
          animationDelay: '140ms',
          textAlign: 'center',
          fontSize: 28,
          fontWeight: 600,
          color: C.text,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
          marginBottom: 14,
        }}
      >
        El sistema está listo
      </h2>

      <p
        className="wiz-stagger"
        style={{
          animationDelay: '200ms',
          textAlign: 'center',
          fontSize: 14.5,
          color: C.text2,
          lineHeight: 1.55,
          marginBottom: 28,
          maxWidth: 360,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        El gemelo digital está configurado y comenzará a procesar
        datos de su instalación. Podrá modificar cualquier parámetro
        desde el módulo de Ajustes en cualquier momento.
      </p>

      <PrimaryButton onClick={onFinish} delay={260}>
        Ir al panel principal
        <ArrowRightIcon className="w-4 h-4" strokeWidth={2.4} />
      </PrimaryButton>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>('none');
  const [transitioning, setTransitioning] = useState(false);

  const navigate = useCallback((next: number, dir: Direction) => {
    setDirection(dir);
    setTransitioning(true);
    setTimeout(() => {
      setStep(next);
      setTransitioning(false);
    }, 180);
  }, []);

  const forward = useCallback((next: number) => navigate(next, 'forward'), [navigate]);
  const back = useCallback(() => {
    if (step > 0 && step < 4) navigate(step - 1, 'backward');
  }, [step, navigate]);

  const finish = useCallback(() => {
    try { localStorage.setItem('gd_onboarding_done', '1'); } catch { /* ignore */ }
    onComplete();
  }, [onComplete]);

  const handleSaveLocation = useCallback(async (data: { lat: number; lon: number; name: string }) => {
    try { await executeMutation(SAVE_LOCATION_MUTATION, { input: data }); } catch { /* ignore */ }
    forward(2);
  }, [forward]);

  const handleSavePanel = useCallback(async (data: {
    manufacturer: string; model?: string; ratedPowerKw: number;
    quantity: number; tiltDegrees?: number; orientation?: string;
  }) => {
    try { await executeMutation(CREATE_PANEL_MUTATION, { input: data }); } catch { /* ignore */ }
    forward(3);
  }, [forward]);

  const handleSaveBattery = useCallback(async (data: {
    manufacturer: string; model?: string; capacityKwh: number; quantity: number;
  }) => {
    try { await executeMutation(CREATE_BATTERY_MUTATION, { input: data }); } catch { /* ignore */ }
    forward(4);
  }, [forward]);

  const cardTransform = transitioning
    ? {
        opacity: 0,
        transform: direction === 'forward' ? 'translateX(-10px)' : 'translateX(10px)',
      }
    : { opacity: 1, transform: 'translateX(0)' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '32px 16px',
        fontFamily: FONT_STACK,
      }}
    >
      <style>{`
        @keyframes wiz-fade-in-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wiz-stagger {
          animation: wiz-fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes wiz-check-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .wiz-check-pop {
          animation: wiz-check-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
        }
        @keyframes wiz-blob-1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(35px, -22px); }
          66% { transform: translate(-28px, 22px); }
        }
        @keyframes wiz-blob-2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-40px, 28px); }
        }
        .wiz-blob { animation: wiz-blob-1 22s ease-in-out infinite; }
        .wiz-blob-b { animation: wiz-blob-2 28s ease-in-out infinite; }
        .wiz-input:focus {
          border-color: ${C.dark} !important;
          background: ${C.white} !important;
          box-shadow: 0 0 0 3px rgba(29,29,31,0.08);
        }
        .wiz-input:hover {
          border-color: #b8b8bf;
        }
        .wiz-btn-primary:hover:not(:disabled) {
          background: #000 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
        }
        .wiz-btn-primary:active:not(:disabled) {
          transform: scale(0.985);
        }
        .wiz-link:hover {
          color: ${C.blueHover} !important;
        }
        .wiz-back-btn:hover {
          background: #e8e8ed !important;
          color: ${C.text} !important;
        }
        .wiz-back-btn:active {
          transform: scale(0.94);
        }
        /* Leaflet overrides for embedded map */
        .leaflet-container {
          font-family: ${FONT_STACK};
          background: #f5f5f7;
        }
        .leaflet-container a {
          color: ${C.blue};
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
        }
        .leaflet-control-zoom a {
          background: ${C.white} !important;
          color: ${C.text} !important;
          border: 1px solid ${C.borderLight} !important;
          font-weight: 500 !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${C.bgChip} !important;
        }
      `}</style>

      {/* Background — light atmospheric */}
      <div
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'linear-gradient(135deg, #eef1f6 0%, #e3e7ee 50%, #dde2eb 100%)',
        }}
      />
      <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
        <div
          className="wiz-blob"
          style={{
            position: 'absolute',
            top: '8%',
            left: '10%',
            width: 480,
            height: 480,
            borderRadius: '50%',
            background: 'rgba(52,199,89,0.13)',
            filter: 'blur(120px)',
          }}
        />
        <div
          className="wiz-blob-b"
          style={{
            position: 'absolute',
            top: '15%',
            right: '5%',
            width: 460,
            height: 460,
            borderRadius: '50%',
            background: 'rgba(0,113,227,0.12)',
            filter: 'blur(120px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: 'radial-gradient(rgba(0,0,0,1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* CARD CONTAINER */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: 480,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {/* Progress (steps 1–3) */}
        {step >= 1 && step <= 3 && <ProgressIndicator step={step} />}

        {/* WHITE CARD */}
        <div style={{ position: 'relative', width: '100%' }}>
          <div
            style={{
              position: 'relative',
              background: C.white,
              borderRadius: 18,
              padding: '40px 44px',
              boxShadow: '0 30px 80px -20px rgba(15,23,42,0.22), 0 6px 20px -6px rgba(15,23,42,0.1), 0 0 0 1px rgba(0,0,0,0.04)',
              transition: 'opacity 180ms ease, transform 180ms ease',
              ...cardTransform,
            }}
          >
            {step >= 1 && step <= 3 && <BackButton onClick={back} />}

            {step === 0 && <WelcomeContent onStart={() => forward(1)} onSkip={finish} />}
            {step === 1 && <LocationContent onSave={handleSaveLocation} onSkip={() => forward(2)} />}
            {step === 2 && <PanelContent onSave={handleSavePanel} onSkip={() => forward(3)} />}
            {step === 3 && <BatteryContent onSave={handleSaveBattery} onSkip={() => forward(4)} />}
            {step === 4 && <DoneContent onFinish={finish} />}
          </div>
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 500,
            color: C.text4,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Gemelo Digital · CUJAE
        </p>
      </div>
    </div>
  );
}
