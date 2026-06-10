'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import AuthGate from '@/app/components/AuthGate';
import type { User } from '@/types';
import { canAccessModule, moduleKeyFromPath } from '@/lib/permissions';

const SESSION_KEY = 'gd_auth_user';

const navItems = [
  { href: '/ajustes', label: 'Secciones' },
  { href: '/ajustes/paneles', label: 'Paneles' },
  { href: '/ajustes/baterias', label: 'Baterías' },
  { href: '/ajustes/inversores', label: 'Inversores' },
  { href: '/ajustes/electrodomesticos', label: 'Electrodomésticos' },
  { href: '/ajustes/clima', label: 'Clima' },
  { href: '/ajustes/ubicacion', label: 'Ubicación' },
  { href: '/ajustes/reportes', label: 'Reportes' },
] as const;

export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as User;
        setUser(parsed);
      }
    } catch (error) {
      console.warn('No se pudo leer la sesión almacenada.', error);
    } finally {
      setBootstrapped(true);
    }
  }, []);

  // Guard de ruta único: si el rol del usuario no puede acceder al módulo de la
  // URL actual, lo enviamos al índice de Ajustes (donde solo verá lo permitido).
  useEffect(() => {
    if (!bootstrapped || !user) return;
    const moduleKey = moduleKeyFromPath(pathname);
    if (moduleKey && !canAccessModule(user.role, moduleKey)) {
      router.replace('/ajustes');
    }
  }, [bootstrapped, user, pathname, router]);

  const handleAuthenticated = (authenticated: User) => {
    setUser(authenticated);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(authenticated));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
    router.push('/');
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const pageTitle = useMemo(() => {
    const active = navItems.find((item) => item.href === pathname);
    if (!active) return 'Ajustes';
    return active.label === 'Secciones' ? 'Ajustes' : `Ajustes · ${active.label}`;
  }, [pathname]);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center text-gray-600">
          <ArrowPathIcon className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          Preparando ajustes…
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Atrás
            </button>

            <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Microrred solar</p>
            <h1 className="text-xl font-semibold text-slate-900">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Salir
            </button>
          </div>
        </div>

      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
