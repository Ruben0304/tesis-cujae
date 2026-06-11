'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BatteryCharging, Info, Layers, Power, Settings2, BarChart2, MapPin, FileDown, Sun } from 'lucide-react';
import { canAccessModule, moduleKeyFromPath } from '@/lib/permissions';

const sections = [
  {
    href: '/ajustes/paneles',
    title: 'Paneles solares',
    subtitle: 'Potencia, cantidad y limpieza',
    icon: <Layers className="h-5 w-5 text-blue-600" />,
  },
  {
    href: '/ajustes/baterias',
    title: 'Baterías',
    subtitle: 'Capacidad y bancos de almacenamiento',
    icon: <BatteryCharging className="h-5 w-5 text-emerald-600" />,
  },
  {
    href: '/ajustes/inversores',
    title: 'Inversores',
    subtitle: 'Potencia AC y eficiencia',
    icon: <Power className="h-5 w-5 text-indigo-600" />,
  },
  {
    href: '/ajustes/electrodomesticos',
    title: 'Electrodomésticos',
    subtitle: 'Cargas, tiempos y modos',
    icon: <Settings2 className="h-5 w-5 text-amber-600" />,
  },
  {
    href: '/ajustes/consumo',
    title: 'Perfil de consumo',
    subtitle: 'Curva horaria de demanda para predicciones',
    icon: <BarChart2 className="h-5 w-5 text-blue-500" />,
  },
  {
    href: '/ajustes/clima',
    title: 'Fuente de clima',
    subtitle: 'Conexión con servicios meteorológicos',
    icon: <Info className="h-5 w-5 text-fuchsia-600" />,
  },
  {
    href: '/ajustes/ubicacion',
    title: 'Ubicación',
    subtitle: 'Coordenadas geográficas de la instalación',
    icon: <MapPin className="h-5 w-5 text-rose-500" />,
  },
  {
    href: '/ajustes/reportes',
    title: 'Exportar reportes',
    subtitle: 'Descargar datos en CSV o PDF profesional',
    icon: <FileDown className="h-5 w-5 text-sky-600" />,
  },
  {
    href: '/ajustes/sombras',
    title: 'Configurar sombra',
    subtitle: 'Simulador 3D de sombras sobre paneles solares',
    icon: <Sun className="h-5 w-5 text-orange-500" />,
  },
] as const;

export default function AjustesHomePage() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('gd_auth_user');
      setRole(stored ? (JSON.parse(stored)?.role ?? null) : null);
    } catch {
      setRole(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Solo se muestran los módulos que el rol del usuario puede usar.
  const visibleSections = !loaded ? [] : sections.filter((section) => {
    const key = moduleKeyFromPath(section.href);
    return key ? canAccessModule(role, key) : true;
  });

  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 p-6 backdrop-blur-xl shadow-[0_30px_70px_-50px_rgba(15,23,42,0.65)]">
      <header className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Ajustes</h2>
        <p className="text-sm text-slate-500">
          {role === 'admin'
            ? 'Administre cada parte de la configuración en su propia sección.'
            : 'Exporte reportes del sistema. La configuración avanzada está reservada a administradores.'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-2">{section.icon}</div>
            <h3 className="text-base font-semibold text-slate-800 group-hover:text-blue-700">
              {section.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{section.subtitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
