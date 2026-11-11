import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, ShieldCheck, Cpu, Database, CloudSun, Save, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Currency, UnitSystem, ConfigStatus } from '../types';
import { translations, Language } from '../translations';

interface SettingsProps {
  showSettings: boolean;
  setShowSettings?: (show: boolean) => void;
  lang: Language;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  location: { lat: number; lng: number } | null;
  setLocation: (loc: any) => void;
  isInlineView?: boolean;
  demoDataEnabled?: boolean;
  setDemoDataEnabled?: (enabled: boolean) => void;
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
  setLocation,
  isInlineView = false,
  demoDataEnabled = false,
  setDemoDataEnabled
}) => {
  const t = translations[lang];
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch('/api/config-status')
      .then(res => res.json())
      .then(data => setConfigStatus(data))
      .catch(() => {});
  }, []);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      if (setShowSettings && !isInlineView) {
        setShowSettings(false);
      }
    }, 1200);
  };

  const content = (
    <div className="space-y-8">
      {/* System Integration Status Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-[#2F7D4A]" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
            {t.settingsSystemIntegrationStatus}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xs">
                AI
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-950">Gemini 1.5 Vision</p>
                <p className="text-[10px] text-emerald-700">{t.settingsPhytopathologicalAnalysis}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              {configStatus?.geminiStatus || 'CONFIGURED'}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-950">SQLite + GIS Geodata</p>
                <p className="text-[10px] text-emerald-700">{t.settingsDatabasePolygons}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              {configStatus?.databaseStatus || 'CONFIGURED'}
            </span>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-700 flex items-center justify-center font-bold text-xs">
                <CloudSun className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-950">
                  {configStatus?.weatherSource || (configStatus?.weatherStatus?.includes('GOOGLE') ? 'Google Weather API' : 'Open-Meteo')}
                </p>
                <p className="text-[10px] text-blue-700">
                  {configStatus?.weatherStatus?.includes('GOOGLE') ? t.settingsMainProvider : t.settingsOpenSourceBackup}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              <CheckCircle2 className="w-3 h-3" />
              {configStatus?.weatherStatus || 'OPEN_METEO'}
            </span>
          </div>

          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-600/10 text-amber-700 flex items-center justify-center font-bold text-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-950">NDVI / Drone Pipeline</p>
                <p className="text-[10px] text-amber-700">{t.settingsOrthophotoProcessing}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              <CheckCircle2 className="w-3 h-3" />
              {configStatus?.mlInferenceStatus || 'CONFIGURED'}
            </span>
          </div>
        </div>
      </div>

      {/* Demo Data Toggle */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-[#2F7D4A]" />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
            {t.demoDataToggle}
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-800">
              {t.settingsShowDemoFields}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t.demoDataDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDemoDataEnabled && setDemoDataEnabled(!demoDataEnabled)}
            className={cn(
              "w-12 h-6 rounded-full transition-colors relative focus:outline-none shrink-0",
              demoDataEnabled ? "bg-[#2F7D4A]" : "bg-slate-300"
            )}
          >
            <span
              className={cn(
                "block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5",
                demoDataEnabled ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>


      {/* Currency & Units */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-3">
            {t.currencyLabel}
          </label>
          <select 
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#2F7D4A] text-sm font-medium transition-all shadow-sm"
          >
            <option value="KZT">{t.kzt} (₸)</option>
            <option value="USD">{t.usd} ($)</option>
            <option value="RUB">{t.rub} (₽)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-3">
            {t.unitsLabel}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={() => setUnitSystem('metric')}
              className={cn(
                "px-4 py-3 font-bold rounded-2xl transition-all text-xs uppercase tracking-wider",
                unitSystem === 'metric' 
                  ? "bg-[#163D2B] text-white shadow-md shadow-emerald-900/20" 
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {t.metric} {t.settingsMetricUnitSuffix}
            </button>
            <button 
              type="button"
              onClick={() => setUnitSystem('imperial')}
              className={cn(
                "px-4 py-3 font-bold rounded-2xl transition-all text-xs uppercase tracking-wider",
                unitSystem === 'imperial' 
                  ? "bg-[#163D2B] text-white shadow-md shadow-emerald-900/20" 
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              {t.imperial} {t.settingsImperialUnitSuffix}
            </button>
          </div>
        </div>
      </div>

      {/* Precise Coordinates for Drones */}
      <div className="pt-4 border-t border-slate-200">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-3">
          {t.settingsBaseCoordinates}
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.settingsLat}</span>
            <input 
              type="number" 
              step="0.000001"
              value={location?.lat || ''} 
              onChange={(e) => setLocation((prev: any) => ({ ...(prev || { lat: 0, lng: 0 }), lat: parseFloat(e.target.value) || 0, accuracy: 0 }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.settingsLng}</span>
            <input 
              type="number" 
              step="0.000001"
              value={location?.lng || ''} 
              onChange={(e) => setLocation((prev: any) => ({ ...(prev || { lat: 0, lng: 0 }), lng: parseFloat(e.target.value) || 0, accuracy: 0 }))}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <button 
          type="button"
          onClick={handleSave}
          className="w-full py-4 bg-[#163D2B] text-white text-xs font-bold uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-950/20 hover:bg-[#2F7D4A] transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{t.settingsSavedSuccess}</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{t.save}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (isInlineView) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h2 className="font-serif font-bold text-2xl text-[#17251D] tracking-tight">{t.settingsTitle}</h2>
            <p className="text-xs text-slate-500 mt-1">
              {t.settingsSubtitleDesc}
            </p>
          </div>
          {content}
        </div>
      </div>
    );
  }

  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowSettings && setShowSettings(false)}
        className="absolute inset-0 bg-brand-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-white rounded-[36px] shadow-2xl overflow-hidden z-10"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-serif font-bold text-xl text-slate-900 tracking-tight">{t.settingsTitle}</h3>
            <p className="text-[11px] text-slate-500">{t.settingsModalSubtitle}</p>
          </div>
          <button 
            onClick={() => setShowSettings && setShowSettings(false)}
            className="w-9 h-9 flex items-center justify-center hover:bg-slate-200/60 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto max-h-[80vh]">
          {content}
        </div>
      </motion.div>
    </div>
  );
};
