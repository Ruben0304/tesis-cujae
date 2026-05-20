'use client';

import { useEffect, useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Dashboard from './components/Dashboard';
import AuthGate from './components/AuthGate';
import type { User } from '@/types';

const SESSION_KEY = 'gd_auth_user';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

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

  const handleAuthenticated = (authenticated: User) => {
    setUser(authenticated);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(authenticated));
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center text-gray-600">
          <ArrowPathIcon className="w-12 h-12 text-green-400 animate-spin mx-auto mb-4" />
          Preparando interfaz…
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
