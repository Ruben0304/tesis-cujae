import { WeatherData } from '@/types';
import { Cloud, Droplets, Wind, Gauge, Sun, CloudSun, CloudRain, Thermometer } from 'lucide-react';

interface WeatherSummaryProps {
  weather: WeatherData;
}

export default function WeatherSummary({ weather }: WeatherSummaryProps) {
  const { temperature, solarRadiation, cloudCover, humidity, windSpeed } = weather;
  const locationLabel = weather.locationName ?? 'Ubicación';

  // Determinar ícono del clima según nubosidad
  const getWeatherIcon = () => {
    if (cloudCover < 20) return <Sun className="w-12 h-12 text-yellow-400" />;
    if (cloudCover < 50) return <CloudSun className="w-12 h-12 text-yellow-300" />;
    if (cloudCover < 80) return <Cloud className="w-12 h-12 text-gray-400" />;
    return <CloudRain className="w-12 h-12 text-blue-400" />;
  };

  const getWeatherConditionText = () => {
    if (weather.description) return weather.description;
    if (cloudCover < 20) return 'Soleado';
    if (cloudCover < 50) return 'Parcialmente nublado';
    if (cloudCover < 80) return 'Nublado';
    return 'Lluvioso';
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-sky-50/80 via-white/60 to-blue-50/80 backdrop-blur-sm border border-white/40 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900">Clima del día</h3>
          <span className="text-xs text-sky-600 font-medium bg-sky-100/70 px-2 py-1 rounded-full">
            {locationLabel}
          </span>
        </div>
        <p className="text-xs text-gray-500">
          {weather.provider ?? 'Open-Meteo'}
        </p>
      </div>

      {/* Main Weather Display */}
      <div className="flex items-center justify-center mb-6 p-5 bg-white/50 backdrop-blur-sm rounded-xl border border-white/60">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            {getWeatherIcon()}
          </div>
          <div className="text-5xl font-extrabold text-gray-900 mb-2">
            {temperature.toFixed(1)}°
          </div>
          <div className="text-sm font-medium text-gray-600">
            {getWeatherConditionText()}
          </div>
        </div>
      </div>

      {/* Weather Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 flex-1">
        <div className="flex flex-col items-center justify-center p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 hover:bg-white/60 transition-all duration-200">
          <Gauge className="w-6 h-6 text-orange-500 mb-2" />
          <div className="text-xs text-gray-600 mb-1">Radiación</div>
          <div className="text-xl font-bold text-gray-900">{solarRadiation}</div>
          <div className="text-xs text-gray-500">W/m²</div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 hover:bg-white/60 transition-all duration-200">
          <Cloud className="w-6 h-6 text-gray-500 mb-2" />
          <div className="text-xs text-gray-600 mb-1">Nubosidad</div>
          <div className="text-xl font-bold text-gray-900">{cloudCover}</div>
          <div className="text-xs text-gray-500">%</div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 hover:bg-white/60 transition-all duration-200">
          <Droplets className="w-6 h-6 text-blue-500 mb-2" />
          <div className="text-xs text-gray-600 mb-1">Humedad</div>
          <div className="text-xl font-bold text-gray-900">{humidity}</div>
          <div className="text-xs text-gray-500">%</div>
        </div>

        <div className="flex flex-col items-center justify-center p-4 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 hover:bg-white/60 transition-all duration-200">
          <Wind className="w-6 h-6 text-cyan-500 mb-2" />
          <div className="text-xs text-gray-600 mb-1">Viento</div>
          <div className="text-xl font-bold text-gray-900">{windSpeed.toFixed(1)}</div>
          <div className="text-xs text-gray-500">km/h</div>
        </div>
      </div>

      {/* Pronóstico rápido */}
      {weather.forecast && weather.forecast.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/40">
          <div className="text-xs font-semibold text-gray-700 mb-2">Pronóstico hoy</div>
          <div className="flex items-center justify-between px-2">
            <div className="text-center">
              <div className="text-xs text-gray-600">Máx</div>
              <div className="text-lg font-bold text-red-500">
                {weather.forecast[0].maxTemp.toFixed(0)}°
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">Mín</div>
              <div className="text-lg font-bold text-blue-500">
                {weather.forecast[0].minTemp.toFixed(0)}°
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600">Prod. Est.</div>
              <div className="text-lg font-bold text-green-500">
                {weather.forecast[0].predictedProduction.toFixed(0)} kWh
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
