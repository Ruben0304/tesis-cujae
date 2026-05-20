'use client';

import { MonitorSmartphone, PieChart, Server, Plus, History } from 'lucide-react';
import { type ComponentType } from 'react';

type SectionKey = 'overview' | 'stats' | 'devices' | 'admin' | 'historial';

interface NavItem {
  id: SectionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface FloatingBottomNavProps {
  active: SectionKey;
  onSelect: (section: SectionKey) => void;
  onAddDevice?: () => void;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Info general', icon: MonitorSmartphone },
  { id: 'stats', label: 'Estadísticas', icon: PieChart },
  { id: 'historial', label: 'Historial', icon: History },
  { id: 'devices', label: 'Ajustes', icon: Server },
];

export default function FloatingBottomNav({
  active,
  onSelect,
  onAddDevice,
}: FloatingBottomNavProps) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="relative">
        <div className="flex items-center gap-8 rounded-full border border-white/50 bg-white/40 px-8 py-3 backdrop-blur-xl shadow-[0_20px_45px_-25px_rgba(15,23,42,0.45)]">
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={label}
              >
                <span
                  className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${isActive ? 'bg-white text-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white/40 text-slate-600'
                    }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onAddDevice}
          className="absolute -right-6 -top-6 grid h-14 w-14 place-items-center rounded-full bg-white text-slate-800 shadow-lg shadow-blue-500/20 transition-transform hover:scale-[1.03]"
          aria-label="Añadir dispositivo"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
