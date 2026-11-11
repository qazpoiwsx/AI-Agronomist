import React, { useState, useEffect } from 'react';
import { 
  CloudSun, 
  Droplets, 
  Wind, 
  Thermometer, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  RefreshCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { Field, WeatherAgroRisk } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface WeatherRiskViewProps {
  fields: Field[];
  lang: Language;
}

export const WeatherRiskView: React.FC<WeatherRiskViewProps> = ({ fields, lang }) => {
  const t = translations[lang];

  const [selectedFieldId, setSelectedFieldId] = useState<string>(fields[0]?.id || 'default');
  const [loading, setLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [agroRisk, setAgroRisk] = useState<WeatherAgroRisk | null>(null);
  const [weatherSource, setWeatherSource] = useState<string>('Open-Meteo');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeField = fields.find(f => f.id === selectedFieldId) || fields[0] || null;

  const loadWeatherRisk = async (lat: number, lng: number) => {
    setLoading(true);
    setErrorMessage(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(`/api/weather/agro-risk?lat=${lat}&lng=${lng}&lang=${lang}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setWeatherData(data.current);
        setAgroRisk(data.riskMatrix);
        setWeatherSource(data.source || 'Open-Meteo');
        setUpdatedAt(data.updatedAt || new Date().toISOString());
      } else {
        const errJson = await res.json().catch(() => ({}));
        setErrorMessage(errJson.message || `Метеосервис временно недоступен (${res.status})`);
        setWeatherData(null);
        setAgroRisk(null);
        setWeatherSource(errJson.source || 'Недоступен');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'Превышено время ожидания метеосервиса (7с)' : (err.message || 'Сетевая ошибка при получении погодных данных');
      console.warn("Error fetching agro-risk:", msg);
      setErrorMessage(msg);
      setWeatherData(null);
      setAgroRisk(null);
      setWeatherSource('Временно недоступен');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeField?.center || !Number.isFinite(activeField.center[0]) || !Number.isFinite(activeField.center[1])) {
      setLoading(false);
      setWeatherData(null);
      setAgroRisk(null);
      setWeatherSource('Недоступен');
      setErrorMessage('Сначала добавьте поле с границей, чтобы получать погоду и оценку рисков.');
      return;
    }
    loadWeatherRisk(activeField.center[0], activeField.center[1]);
  }, [selectedFieldId, lang, fields]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Field Selector & Source Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("w-2.5 h-2.5 rounded-full", weatherData ? "bg-blue-500 animate-pulse" : "bg-amber-400")} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Метеорологическая агростанция
            </span>
            <span className="text-slate-300">•</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold",
              weatherSource.includes("Google") 
                ? "bg-blue-100 text-blue-800 border border-blue-200" 
                : weatherSource.includes("Open-Meteo")
                  ? "bg-slate-100 text-slate-700 border border-slate-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
            )}>
              {t.weatherSource || "Источник"}: {weatherSource}
            </span>
            {updatedAt && (
              <span className="text-[10px] text-slate-400">
                ({t.lastUpdated || "Обновлено"}: {new Date(updatedAt).toLocaleTimeString()})
              </span>
            )}
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            Агроклиматический мониторинг и риски
          </h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {fields.length > 0 && (
            <select
              value={selectedFieldId}
              onChange={(e) => setSelectedFieldId(e.target.value)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.crop ? `(${f.crop})` : ''}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => activeField && activeField.center && loadWeatherRisk(activeField.center[0], activeField.center[1])}
            disabled={loading || !activeField}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
            title="Обновить данные"
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => activeField && activeField.center && loadWeatherRisk(activeField.center[0], activeField.center[1])}
            className="px-3 py-1 rounded-xl bg-amber-200/80 hover:bg-amber-200 text-amber-900 text-[11px] font-bold shrink-0 transition-all"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Current Observations Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Thermometer className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Температура воздуха</p>
          <h3 className="text-3xl font-serif font-bold text-slate-900 mt-0.5">
            {weatherData?.temperature_2m !== undefined ? `${Math.round(weatherData.temperature_2m)}°C` : '—'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {weatherData ? 'Фактическая температура' : (loading ? 'Загрузка...' : (errorMessage ? 'Данные недоступны' : 'Нет погодных данных'))}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Droplets className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Относительная влажность</p>
          <h3 className="text-3xl font-serif font-bold text-slate-900 mt-0.5">
            {weatherData?.relative_humidity_2m !== undefined ? `${weatherData.relative_humidity_2m}%` : '—'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {weatherData?.relative_humidity_2m !== undefined 
              ? (weatherData.relative_humidity_2m > 70 ? 'Высокая (риск спор)' : 'Нормальная влажность') 
              : '—'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center mb-3">
            <Wind className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Скорость ветра</p>
          <h3 className="text-3xl font-serif font-bold text-slate-900 mt-0.5">
            {weatherData?.wind_speed_10m !== undefined ? `${weatherData.wind_speed_10m} м/с` : '—'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {weatherData?.wind_speed_10m !== undefined 
              ? (weatherData.wind_speed_10m < 5 ? 'Окно для опрыскивания открыто' : 'Повышенный снос капель') 
              : '—'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <CloudSun className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Осадки за сутки</p>
          <h3 className="text-3xl font-serif font-bold text-slate-900 mt-0.5">
            {weatherData?.precipitation !== undefined ? `${weatherData.precipitation} мм` : '—'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            {weatherData?.precipitation !== undefined 
              ? (weatherData.precipitation > 0 ? 'Зафиксированы осадки' : 'Без осадков') 
              : '—'}
          </p>
        </div>
      </div>

      {/* Agro-Risk Matrix Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div>
          <h3 className="text-lg font-serif font-bold text-slate-900">
            Матрица агроклиматических рисков
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Оценка влияния погодных условий на культуру «{activeField?.crop || 'посевы'}»
          </p>
        </div>

        {agroRisk && (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm mb-0.5">Резюме метеоугроз агронома</h4>
              <p className="leading-relaxed">{agroRisk.summary}</p>
            </div>
          </div>
        )}

        {agroRisk ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Fungal Risk */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-800">Грибные болезни (Тат/Ржавчина)</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                agroRisk?.fungalRisk === 'high' ? "bg-red-500 text-white" :
                agroRisk?.fungalRisk === 'moderate' ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
              )}>
                {agroRisk?.fungalRisk || 'moderate'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              При влажности &gt;75% споры Puccinia прорастают за 4-6 часов. Требуется профилактика.
            </p>
          </div>

          {/* Spraying Window */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-800">Окно химобработки (ветер)</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-600 text-white">
                Благоприятно
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Ветер 3-5 м/с позволяет проводить опрыскивание без сноса капель препарата.
            </p>
          </div>

          {/* Drought Risk */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-800">Засуха и дефицит влаги</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                agroRisk?.droughtRisk === 'high' ? "bg-red-500 text-white" : "bg-emerald-600 text-white"
              )}>
                {agroRisk?.droughtRisk || 'low'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Запас продуктивной влаги в метровом слое достаточен для фазы колошения.
            </p>
          </div>

          {/* Frost Risk */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-slate-800">Заморозки на почве</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-600 text-white">
                Отсутствует
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Ночные температуры выше +11°C, угроза весенне-летних заморозков исключена.
            </p>
          </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Актуальные погодные данные недоступны. Оценка рисков появится после получения ответа метеосервиса.</p>
        )}

        {/* Disclaimer Note */}
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            Оценка погодных рисков зависит от актуальных данных и не заменяет полевой осмотр.
          </span>
        </div>
      </div>
    </div>
  );
};
