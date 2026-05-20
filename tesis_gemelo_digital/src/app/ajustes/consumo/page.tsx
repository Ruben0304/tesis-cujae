'use client';

import { useEffect, useState } from 'react';
import ConsumptionProfileConfig from '@/app/components/ConsumptionProfileConfig';
import { ConsumptionProfile } from '@/types';
import { executeQuery } from '@/lib/graphql-client';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

const PROFILE_QUERY = `
  query GetConsumptionProfile {
    consumptionProfile {
      _id
      name
      description
      weekday
      weekend
      isActive
      createdAt
      updatedAt
    }
  }
`;

export default function ConsumptionProfilePage() {
  const [profile, setProfile] = useState<ConsumptionProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    executeQuery<{ consumptionProfile: ConsumptionProfile }>(PROFILE_QUERY)
      .then((data) => setProfile(data.consumptionProfile))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Perfil de consumo</h2>
        <p className="text-sm text-slate-500 mt-1">
          Define el consumo eléctrico típico de la instalación por hora y tipo de día.
          Este perfil se usa para predecir la demanda mientras no haya suficientes datos históricos.
        </p>
      </div>
      <ConsumptionProfileConfig
        initialProfile={profile}
        onSaved={(p) => setProfile(p)}
      />
    </div>
  );
}
