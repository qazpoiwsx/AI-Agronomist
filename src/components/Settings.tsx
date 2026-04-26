import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Currency, UnitSystem } from '../types';
import { translations, Language } from '../translations';
import { PushNotificationManager } from './PushNotificationManager';

interface SettingsProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  lang: Language;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  location: { lat: number; lng: number } | null;
  setLocation: (loc: any) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  showSettings,
  setShowSettings,
  lang,
  currency,
  setCurrency,
  unitSystem,
  setUnitSystem,
  location,
  setLocation
}) => {
  const t = translations[lang];

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowSettings(false)}
        className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[48px] shadow-2xl overflow-hidden"
      >
        <div className="px-10 py-8 border-b border-brand-100 flex items-center justify-between bg-brand-50/30">
          <h3 className="font-serif font-medium text-2xl text-slate-900 tracking-tight">{t.settingsTitle}</h3>
          <button 
            onClick={() => setShowSettings(false)}
            className="w-10 h-10 flex items-center justify-center hover:bg-brand-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-brand-400" />
          </button>
        </div>
        
        <div className="p-10 space-y-8 overflow-y-auto max-h-[80vh]">
          {/* Push Notifications at the top */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1 ml-1">
              <span className="text-[10px] font-bold text-brand-200 uppercase tracking-widest">
                {lang === 'ru' ? 'Уведомления' : lang === 'kz' ? 'Хабарландырулар' : 'Notifications'}
              </span>
              <div className="h-px flex-1 bg-brand-100" />
            </div>
            <PushNotificationManager lang={lang} />
          </div>

          <div className="pt-6 border-t border-brand-100">
            <label className="block text-[10px] font-bold text-brand-300 uppercase tracking-widest mb-3 ml-1">{t.currencyLabel}</label>
            <select 
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="w-full px-6 py-4 bg-brand-50 border border-brand-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-600/5 focus:border-brand-600 text-sm font-medium transition-all"
            >
              <option value="KZT">{t.kzt}</option>
              <option value="USD">{t.usd}</option>
              <option value="RUB">{t.rub}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-brand-300 uppercase tracking-widest mb-3 ml-1">{t.unitsLabel}</label>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setUnitSystem('metric')}
                className={cn(
                  "px-6 py-4 font-bold rounded-2xl transition-all text-[10px] uppercase tracking-widest",
                  unitSystem === 'metric' 
                    ? "bg-brand-800 text-white shadow-xl shadow-brand-800/20" 
                    : "bg-white border border-brand-100 text-brand-400 hover:border-brand-300"
                )}
              >
                {t.metric}
              </button>
              <button 
                onClick={() => setUnitSystem('imperial')}
                className={cn(
                  "px-6 py-4 font-bold rounded-2xl transition-all text-[10px] uppercase tracking-widest",
                  unitSystem === 'imperial' 
                    ? "bg-brand-800 text-white shadow-xl shadow-brand-800/20" 
                    : "bg-white border border-brand-100 text-brand-400 hover:border-brand-300"
                )}
              >
                {t.imperial}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-brand-100">
            <label className="block text-[10px] font-bold text-brand-300 uppercase tracking-widest mb-4 ml-1">
              {lang === 'ru' ? 'Точные координаты (Дроны)' : lang === 'kz' ? 'Нақты координаттар (Дрондар)' : 'Precise Coordinates (Drones)'}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-brand-200 uppercase tracking-widest ml-1">LAT</span>
                <input 
                  type="number" 
                  step="0.000001"
                  value={location?.lat || ''} 
                  onChange={(e) => setLocation((prev: any) => ({ ...(prev || { lat: 0, lng: 0 }), lat: parseFloat(e.target.value) || 0, accuracy: 0 }))}
                  className="w-full px-6 py-3 bg-brand-50 border border-brand-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-brand-600/5 focus:border-brand-600 transition-all"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-brand-200 uppercase tracking-widest ml-1">LNG</span>
                <input 
                  type="number" 
                  step="0.000001"
                  value={location?.lng || ''} 
                  onChange={(e) => setLocation((prev: any) => ({ ...(prev || { lat: 0, lng: 0 }), lng: parseFloat(e.target.value) || 0, accuracy: 0 }))}
                  className="w-full px-6 py-3 bg-brand-50 border border-brand-100 rounded-2xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-brand-600/5 focus:border-brand-600 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full py-5 bg-brand-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-brand-800/20 hover:bg-brand-900 transition-all active:scale-[0.98]"
            >
              {t.save}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
