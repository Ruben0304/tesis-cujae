import { BoltIcon, ArrowTrendingUpIcon, ChartBarIcon, SparklesIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { SystemMetrics } from '@/types';

interface MetricsCardsProps {
  metrics: SystemMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  const cards = [
    {
      title: 'Producción estimada',
      subtitle: 'Próxima hora',
      value: metrics.currentProduction,
      unit: 'kW',
      icon: BoltIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/20',
    },
    {
      title: 'Consumo estimado',
      subtitle: 'Próxima hora',
      value: metrics.currentConsumption,
      unit: 'kW',
      icon: ChartBarIcon,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
    },
    {
      title: 'Balance proyectado',
      subtitle: 'Excedente o déficit',
      value: metrics.energyBalance,
      unit: 'kW',
      icon: ArrowTrendingUpIcon,
      color: metrics.energyBalance >= 0 ? 'text-green-400' : 'text-red-400',
      bgColor: metrics.energyBalance >= 0 ? 'bg-green-400/10' : 'bg-red-400/10',
      borderColor: metrics.energyBalance >= 0 ? 'border-green-400/20' : 'border-red-400/20',
    },
    {
      title: 'Eficiencia estimada',
      subtitle: 'Comparada con el ideal',
      value: metrics.systemEfficiency,
      unit: '%',
      icon: SparklesIcon,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/20',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              className={`relative overflow-hidden rounded-xl border ${card.borderColor} bg-white p-6 transition-all hover:shadow-lg`}
            >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {card.title}
                </p>
                {card.subtitle && (
                  <p className="text-xs text-gray-500 mb-4 uppercase tracking-wide">
                    {card.subtitle}
                  </p>
                )}
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-extrabold ${card.color}`}>
                    {typeof card.value === 'number'
                      ? `≈${Math.abs(card.value).toFixed(1)}`
                      : card.value}
                  </span>
                  <span className="text-lg font-semibold text-gray-500">
                    {card.unit}
                  </span>
                </div>
              </div>
              <div className={`${card.bgColor} ${card.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>

            {/* Decorative gradient */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${card.bgColor} rounded-full blur-2xl opacity-50`} />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
        <InformationCircleIcon className="w-3 h-3 text-gray-500" />
        <span>Valores estimados mediante clima en vivo y fichas técnicas. No hay mediciones en tiempo real.</span>
      </div>
    </>
  );
}
