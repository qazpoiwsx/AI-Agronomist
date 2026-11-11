import React from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Droplets, 
  Sun, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';
import { Field, AnalysisResult, PlantCulture, CULTURES } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';
import { TabRoute } from './Sidebar';

interface CropHealthViewProps {
  fields: Field[];
  analyses: AnalysisResult[];
  lang: Language;
  setActiveTab: (tab: TabRoute) => void;
  onSelectField?: (field: Field) => void;
}

export const CropHealthView: React.FC<CropHealthViewProps> = ({
  fields,
  analyses,
  lang,
  setActiveTab,
  onSelectField
}) => {
  const t = translations[lang];

  // Stress factors count
  const diseaseCount = analyses.filter(a => a.issueType === 'disease').length;
  const pestCount = analyses.filter(a => a.issueType === 'pest').length;
  const waterCount = analyses.filter(a => a.issueType === 'water').length;
  const nutrientCount = analyses.filter(a => a.issueType === 'nutrient').length;

  // Timeline data for vegetation index
  const vegetationTimeline = [
    { week: t.healthWeek1, ndvi: 0.28, healthIndex: 95 },
    { week: t.healthWeek2, ndvi: 0.52, healthIndex: 92 },
    { week: t.healthWeek3, ndvi: 0.68, healthIndex: 88 },
    { week: t.healthWeek4, ndvi: 0.74, healthIndex: 84 },
    { week: t.healthWeek5, ndvi: 0.71, healthIndex: 82 },
  ];

  const diseaseDistribution = [
    { name: t.healthBrownRust, cases: diseaseCount || 4, color: '#dc2626' },
    { name: t.healthSeptoria, cases: 2, color: '#ea580c' },
    { name: t.healthWaterStress, cases: waterCount || 1, color: '#0284c7' },
    { name: t.healthNitrogenZincDeficiency, cases: nutrientCount || 1, color: '#eab308' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800">
              {t.healthComplexIndex}
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {t.healthMonitoringTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t.healthMonitoringDesc}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-emerald-50 border border-emerald-200/60 px-5 py-3 rounded-2xl">
          <Activity className="w-8 h-8 text-[#2F7D4A]" />
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">{t.healthAvgHealthIndex}</p>
            <h3 className="text-2xl font-serif font-bold text-[#163D2B]">82 / 100</h3>
          </div>
        </div>
      </div>

      {/* 4 Factor Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">{t.healthFungalInfections}</p>
          <h4 className="text-xl font-serif font-bold text-slate-900 mt-0.5">
            {diseaseCount} {t.healthOutbreakSuffix}
          </h4>
          <p className="text-[11px] text-red-600 font-medium mt-1">
            {diseaseCount > 0 ? (analyses[0]?.diagnosis || t.healthSymptomsDetected) : t.healthNoOutbreaks}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Droplets className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">{t.healthWaterStress}</p>
          <h4 className="text-xl font-serif font-bold text-slate-900 mt-0.5">
            {fields.filter(f => f.currentHealth === 'critical').length > 0
              ? `${Math.round(fields.filter(f => f.currentHealth === 'critical').reduce((s, f) => s + f.areaHectares, 0))} ${t.hectareShort}`
              : fields.length > 0 ? `0 ${t.hectareShort}` : '—'}
          </h4>
          <p className="text-[11px] text-blue-600 font-medium mt-1">
            {fields.find(f => f.currentHealth === 'critical')?.name || (fields.length > 0 ? t.healthStressNotFound : t.healthNoData)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Sun className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">{t.healthTemperatureStress}</p>
          <h4 className="text-xl font-serif font-bold text-slate-900 mt-0.5">{t.healthModerate}</h4>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">{t.healthTempOptimum}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase text-slate-400">{t.healthNitrogenNutrition}</p>
          <h4 className="text-xl font-serif font-bold text-slate-900 mt-0.5">{t.healthNormalStatus}</h4>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">{t.healthPkBackground}</p>
        </div>
      </div>

      {/* Chart: Health Index Dynamics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif font-bold text-base text-slate-900">
                {t.healthVegetationDynamics}
              </h3>
              <p className="text-xs text-slate-400">{t.healthNdviBiologicalIndex}</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vegetationTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2F7D4A" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#2F7D4A" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#163D2B', borderRadius: 12, border: 'none', color: '#fff', fontSize: 12 }} 
                />
                <Area type="monotone" dataKey="healthIndex" stroke="#2F7D4A" strokeWidth={3} fillOpacity={1} fill="url(#healthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown of detected stress types */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-serif font-bold text-base text-slate-900 mb-1">
              {t.healthPhytopathogenStructure}
            </h3>
            <p className="text-xs text-slate-400 mb-4">{t.healthConfirmedInfections}</p>

            <div className="space-y-3">
              {diseaseDistribution.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-800">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                    {item.cases}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => setActiveTab('recommendations')}
              className="w-full py-2.5 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-xs"
            >
              {t.healthViewProtectionMeasures}
            </button>
          </div>
        </div>
      </div>

      {/* Field Inspection Priority Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <h3 className="font-serif font-bold text-base text-slate-900 mb-4">
          {t.healthGroundInspectionPriority}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="pb-3">{t.tableField}</th>
                <th className="pb-3">{t.tableCrop}</th>
                <th className="pb-3">{t.tableArea}</th>
                <th className="pb-3">{t.tableHealthIndex}</th>
                <th className="pb-3">{t.tableStatus}</th>
                <th className="pb-3 text-right">{t.tableAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 font-bold text-slate-900">{f.name}</td>
                  <td className="py-3.5 text-slate-600">{(t.cultures as any)[f.crop] || f.crop} ({f.variety})</td>
                  <td className="py-3.5 text-slate-600 font-mono">{f.areaHectares} {t.hectareShort}</td>
                  <td className="py-3.5">
                    <span className="font-bold text-slate-800">
                      {f.currentHealth === 'healthy' ? '92/100' : f.currentHealth === 'warning' ? '74/100' : '58/100'}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      f.currentHealth === 'healthy' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      f.currentHealth === 'warning' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-red-50 text-red-700 border border-red-200"
                    )}>
                      {f.currentHealth === 'healthy' ? t.healthyStatus : f.currentHealth === 'warning' ? t.warningStatus : t.criticalStatus}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => {
                        if (onSelectField) onSelectField(f);
                        setActiveTab('map');
                      }}
                      className="text-xs font-bold text-[#2F7D4A] hover:underline"
                    >
                      {t.actionToMap}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
