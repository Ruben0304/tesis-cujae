import { BatteryConfig, SystemConfig, SolarPanelConfig } from '@/types';
import { listPanels } from './panelService';
import { listBatteries } from './batteryService';
import { DEFAULT_SYSTEM_CONFIG } from './systemDefaults';

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function aggregateSolar(panels: SolarPanelConfig[]): SystemConfig['solar'] {
  if (panels.length === 0) {
    return DEFAULT_SYSTEM_CONFIG.solar;
  }

  const totalCapacity = panels.reduce(
    (acc, panel) => acc + panel.quantity * panel.ratedPowerKw,
    0
  );
  const totalCount = panels.reduce((acc, panel) => acc + panel.quantity, 0);
  const totalStrings = panels.reduce((acc, panel) => acc + panel.quantity, 0);
  const primary = panels[0];

  return {
    capacityKw: round(totalCapacity),
    panelRatedKw: primary.ratedPowerKw,
    panelCount: totalCount,
    strings: totalStrings || undefined,
    panelEfficiencyPercent: undefined,
    panelAreaM2: undefined,
    spec: primary,
  };
}

function aggregateBattery(batteries: BatteryConfig[]): SystemConfig['battery'] {
  if (batteries.length === 0) {
    return DEFAULT_SYSTEM_CONFIG.battery;
  }

  const totalCapacity = batteries.reduce(
    (acc, battery) => acc + battery.quantity * battery.capacityKwh,
    0
  );
  const totalModules = batteries.reduce((acc, battery) => acc + battery.quantity, 0);
  const primary = batteries[0];

  return {
    capacityKwh: round(totalCapacity),
    moduleCapacityKwh: primary.capacityKwh,
    moduleCount: totalModules,
    maxDepthOfDischargePercent: undefined,
    chargeRateKw: undefined,
    dischargeRateKw: undefined,
    efficiencyPercent: undefined,
    spec: primary,
  };
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const [panels, batteries] = await Promise.all([listPanels(), listBatteries()]);

    return {
      location: DEFAULT_SYSTEM_CONFIG.location,
      solar: aggregateSolar(panels),
      battery: aggregateBattery(batteries),
    };
  } catch (error) {
    console.error('No se pudo obtener la configuración del sistema. Usando valores por defecto.', error);
    return DEFAULT_SYSTEM_CONFIG;
  }
}

export { DEFAULT_SYSTEM_CONFIG };
