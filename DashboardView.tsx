import React from 'react';
import { 
  Sprout, 
  MapPin, 
  FileCheck2, 
  AlertTriangle, 
  ShieldAlert, 
  TrendingDown, 
  Camera, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Activity, 
  CloudSun,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Droplets
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  CartesianGrid 
} from 'recharts';
import { Field, DroneMission, AnalysisResult, Recommendation, AgroNotification } from '../types';
import { Language, translations } from '../translations';
import { TabRoute } from './Sidebar';
import { cn } from '../lib/utils';

interface DashboardViewProps {
  fields: Field[];
  missions: DroneMission[];
  analyses: AnalysisResult[];
  recommendations: Recommendation[];
  notifications: AgroNotification[];
  setActiveTab: (tab: TabRoute) => void;
  lang: Language;
  onSelectField?: (field: Field) => void;
  onSelectAnalysis?: (analysis: AnalysisResult) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  fields,
  missions,
  analyses,
  recommendations,
  notifications,
  setActiveTab,
  lang,
  onSelectField,
  onSelectAnalysis
}) => {
  const t = translations[lang];

  // Calculations from real database state
  const totalFields = fields.length;
  const totalArea = fields.reduce((sum, f) => sum + (f.areaHectares || 0), 0);
  const completedAnalyses = analyses.length;
  const fieldsNeedingAttention = fields.filter(f => ['warning', 'critical'].includes(f.currentHealth));
  const detectedDiseasesCount = analyses.filter(a => ['disease', 'pest'].includes(a.issueType)).length;

  const healthyArea = fields.filter(f => f.currentHealth === 'healthy').reduce((sum, f) => sum + f.areaHectares, 0);
  const stressArea = fields.filter(f => f.currentHealth === 'warning').reduce((sum, f) => sum + f.areaHectares, 0);
  const diseaseArea = fields.filter(f => f.currentHealth === 'critical').reduce((sum, f) => sum + f.areaHectares, 0);
  const pendingArea = fields.filter(f => f.currentHealth === 'pending').reduce((sum, f) => sum + f.areaHectares, 0);

  // Health distribution data for Donut Chart
  const healthData = [
    { name: t.statusHealthy, value: Math.round(healthyArea), color: '#2F7D4A' },
    { name: t.statusStress, value: Math.round(stressArea), color: '#E9A23B' },
    { name: t.statusDisease, value: Math.round(diseaseArea), color: '#D94A4A' },
  ].filter(d => d.value > 0);

  // Crop area breakdown data for Bar Chart
  const cropMap = new Map<string, number>();
  fields.forEach(f => {
    cropMap.set(f.crop, (cropMap.get(f.crop) || 0) + f.areaHectares);
  });
  const cropData = Array.from(cropMap.entries()).map(([crop, area]) => ({
    crop: (t.cultures as any)[crop] || crop,
    area: Math.round(area)
  }));

  // Historical trend data (simulated from analysis timeline)
  const timelineData = [
    { month: 'Май', health: 94, diseases: 2 },
    { month: 'Июн 1-я нед', health: 91, diseases: 3 },
    { month: 'Июн 2-я нед', health: 86, diseases: 6 },
    { month: 'Июн 3-я нед', health: 82, diseases: 8 },
    { month: 'Июн текущая', health: 85, diseases: detectedDiseasesCount || 5 },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner: Quick Actions & Agronomic Philosophy */}
      <div className="bg-gradient-to-r from-[#163D2B] via-[#1b4b35] to-[#2F7D4A] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold uppercase tracking-widest text-emerald-300 mb-3 border border-white/10">
              <span>{t.detectTag}</span>
              <span>•</span>
              <span>{t.analyzeTag}</span>
              <span>•</span>
              <span>{t.predictTag}</span>
              <span>•</span>
              <span>{t.recommendTag}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white mb-2">
              {t.dashboardHeroTitle}
            </h1>
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              {t.dashboardHeroDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => setActiveTab('analysis')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#163D2B] text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-emerald-50 transition-all active:scale-95"
            >
              <Camera className="w-4 h-4 text-[#2F7D4A]" />
              {t.startAnalysis}
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-800/80 hover:bg-emerald-800 text-white border border-white/20 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {t.createField}
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              <MapPin className="w-4 h-4" />
              {t.map}
            </button>
          </div>
        </div>
      </div>

      {/* Empty State Callout for Clean Databases */}
      {totalFields === 0 && (
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-7 h-7" />
          </div>
          <h3 className="font-serif font-bold text-lg text-slate-900 mb-1">
            {t.noFieldsTitle}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            {t.noFieldsSubtitle}
          </p>
          <button
            onClick={() => setActiveTab('fields')}
            className="px-6 py-3 rounded-2xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all inline-flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createField}</span>
          </button>
        </div>
      )}

      {/* 5 Key Overview Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Fields */}
        <div 
          onClick={() => setActiveTab('fields')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Sprout className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2F7D4A] transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.totalFields}
          </p>
          <h3 className="text-2xl font-serif font-bold text-slate-900">{totalFields}</h3>
        </div>

        {/* Cultivated Area */}
        <div 
          onClick={() => setActiveTab('fields')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t.hectareShort}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.totalArea}
          </p>
          <h3 className="text-2xl font-serif font-bold text-slate-900">{Math.round(totalArea)} <span className="text-sm font-sans font-normal text-slate-400">{t.hectareShort}</span></h3>
        </div>

        {/* Completed Analyses */}
        <div 
          onClick={() => setActiveTab('history')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.aiAnalysesCount}
          </p>
          <h3 className="text-2xl font-serif font-bold text-slate-900">{completedAnalyses}</h3>
        </div>

        {/* Fields Needing Attention */}
        <div 
          onClick={() => setActiveTab('fields')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200 bg-amber-50/20 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{t.badgeAttention}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.fieldsInRisk}
          </p>
          <h3 className="text-2xl font-serif font-bold text-amber-700">{fieldsNeedingAttention.length}</h3>
        </div>

        {/* Detected Diseases */}
        <div 
          onClick={() => setActiveTab('health')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-red-200 bg-red-50/20 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">{t.badgeOutbreaks}</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            {t.diseaseCases}
          </p>
          <h3 className="text-2xl font-serif font-bold text-red-600">{detectedDiseasesCount}</h3>
        </div>
      </div>

      {/* Critical Agricultural Alerts Section */}
      {fieldsNeedingAttention.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-900 leading-tight">
                {t.phytosanitaryAlertTitle}
              </h4>
              <p className="text-xs text-amber-800/80 mt-0.5">
                {fieldsNeedingAttention.map(f => `${f.name} (${f.crop})`).join(', ')} — {t.phytosanitaryAlertDesc}.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('recommendations')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm"
          >
            {t.recommendationsNav}
          </button>
        </div>
      )}

      {/* Field Health Overview & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Health Area Breakdown & Donut */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">
                  {t.fieldHealthBreakdown}
                </h3>
                <p className="text-xs text-slate-400">{t.totalArea}: {Math.round(totalArea)} {t.hectareShort}</p>
              </div>
              <button 
                onClick={() => setActiveTab('health')} 
                className="text-xs font-bold text-[#2F7D4A] hover:underline"
              >
                {t.details}
              </button>
            </div>

            <div className="h-56 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthData}
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center pointer-events-none">
                <span className="text-2xl font-serif font-bold text-slate-900">
                  {totalArea > 0 ? Math.round((healthyArea / totalArea) * 100) : 100}%
                </span>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.healthyShare}</p>
              </div>
            </div>

            {/* Breakdown bars */}
            <div className="space-y-3 mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#2F7D4A]" />
                  {t.healthyNormal}
                </span>
                <span className="font-bold text-slate-900">{Math.round(healthyArea)} {t.hectareShort} ({totalArea > 0 ? Math.round((healthyArea / totalArea) * 100) : 0}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#E9A23B]" />
                  {t.stressRisk}
                </span>
                <span className="font-bold text-amber-700">{Math.round(stressArea)} {t.hectareShort} ({totalArea > 0 ? Math.round((stressArea / totalArea) * 100) : 0}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#D94A4A]" />
                  {t.confirmedDisease}
                </span>
                <span className="font-bold text-red-600">{Math.round(diseaseArea)} {t.hectareShort} ({totalArea > 0 ? Math.round((diseaseArea / totalArea) * 100) : 0}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Crop Distribution & Timeline Trends */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-slate-900">
                  {t.cropAreaDistribution}
                </h3>
                <p className="text-xs text-slate-400">{t.cropRotationSubtitle}</p>
              </div>
              <button 
                onClick={() => setActiveTab('fields')} 
                className="text-xs font-bold text-[#2F7D4A] hover:underline"
              >
                {t.fields}
              </button>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cropData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="crop" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit={` ${t.hectareShort}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#163D2B', borderRadius: 12, border: 'none', color: '#fff', fontSize: 12 }} 
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="area" fill="#2F7D4A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{t.agroClimateMonitoring}</span>
            <span className="font-semibold text-emerald-700">{t.optimalMoisture}</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Analyses & Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Field Analyses */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-serif font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#2F7D4A]" />
              {t.latestAnalyses}
            </h3>
            <button 
              onClick={() => setActiveTab('history')}
              className="text-xs font-bold text-[#2F7D4A] hover:underline flex items-center gap-1"
            >
              <span>{t.history}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {analyses.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-xs">{t.historyEmpty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.slice(0, 3).map((item) => (
                <div 
                  key={item.id}
                  onClick={() => {
                    if (onSelectAnalysis) onSelectAnalysis(item);
                    setActiveTab('history');
                  }}
                  className="p-3.5 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0",
                      item.severity === 'high' ? "bg-red-100 text-red-600" :
                      item.severity === 'medium' ? "bg-amber-100 text-amber-600" :
                      "bg-emerald-100 text-[#2F7D4A]"
                    )}>
                      {item.issueType === 'disease' ? '🦠' : item.issueType === 'pest' ? '🐞' : '🌱'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">{item.diagnosis}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {item.fieldName || item.culture} • {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                      item.severity === 'high' ? "bg-red-50 text-red-600 border border-red-200" :
                      item.severity === 'medium' ? "bg-amber-50 text-amber-600 border border-amber-200" :
                      "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    )}>
                      {item.severity === 'high' ? t.high : item.severity === 'medium' ? t.medium : t.low}
                    </span>
                    <p className="text-[10px] font-bold text-slate-600 mt-1">
                      -{item.economicImpact?.potentialLossPercentage || 0}% {t.yieldLossSuffix}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Agronomic Recommendations */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-serif font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#2F7D4A]" />
              {t.recommendationsNav}
            </h3>
            <button 
              onClick={() => setActiveTab('recommendations')}
              className="text-xs font-bold text-[#2F7D4A] hover:underline flex items-center gap-1"
            >
              <span>{t.details}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {recommendations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p>{t.noActiveRecs}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {t.recsGeneratedFrom}
                </p>
              </div>
            ) : (
              recommendations.slice(0, 3).map((rec) => (
              <div 
                key={rec.id}
                className="p-3.5 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                        rec.priority === 'CRITICAL' ? "bg-red-500 text-white" :
                        rec.priority === 'HIGH' ? "bg-amber-500 text-white" :
                        "bg-emerald-600 text-white"
                      )}>
                        {rec.priority}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">{rec.fieldName}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{rec.title}</h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{rec.description}</p>
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase shrink-0",
                    rec.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700" :
                    rec.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-700" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {rec.status}
                  </span>
                </div>
              </div>
            )))}
          </div>
        </div>
      </div>
    </div>
  );
};
