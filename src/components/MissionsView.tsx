import React, { useState } from 'react';
import { 
  Radar, 
  Plus, 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Upload, 
  Layers, 
  Compass, 
  Wind, 
  X, 
  Trash2, 
  Battery, 
  Cpu, 
  Maximize,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { DroneMission, Field } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface MissionsViewProps {
  missions: DroneMission[];
  fields: Field[];
  lang: Language;
  onCreateMission: (mission: Partial<DroneMission>) => Promise<void>;
  onUpdateMissionStatus: (id: string, status: DroneMission['status'], progress?: number) => Promise<void>;
  onDeleteMission: (id: string) => Promise<void>;
}

export const MissionsView: React.FC<MissionsViewProps> = ({
  missions,
  fields,
  lang,
  onCreateMission,
  onUpdateMissionStatus,
  onDeleteMission
}) => {
  const t = translations[lang];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSimulationId, setActiveSimulationId] = useState<string | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Form
  const [formData, setFormData] = useState({
    fieldId: fields[0]?.id || '',
    name: '',
    plannedDate: new Date().toISOString().split('T')[0],
    altitudeMeters: 65,
    imageOverlapPercent: 80,
    speedMps: 16,
    notes: ''
  });

  const handleOpenCreate = () => {
    setFormData({
      fieldId: fields[0]?.id || '',
      name: '',
      plannedDate: new Date().toISOString().split('T')[0],
      altitudeMeters: 65,
      imageOverlapPercent: 80,
      speedMps: 16,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const selField = fields.find(f => f.id === formData.fieldId);
    await onCreateMission({
      ...formData,
      fieldName: selField?.name || 'Поле',
      status: 'READY',
      imagesCount: 0,
      processedCount: 0
    });
    setIsModalOpen(false);
  };

  const handleStartMission = async (mission: DroneMission) => {
    setActiveSimulationId(mission.id);
    setSimulationProgress(10);
    await onUpdateMissionStatus(mission.id, 'IN_PROGRESS');

    // Simulate flight progression
    const interval = setInterval(async () => {
      setSimulationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setActiveSimulationId(null);
          onUpdateMissionStatus(mission.id, 'COMPLETED');
          return 100;
        }
        return prev + 15;
      });
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {lang === 'ru' ? 'Дрон-миссии и аэромониторинг' : 'Drone Missions & Aerial Survey'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Планирование автономных облётов, ортофотопланы и фиксация очагов болезней
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Новая миссия</span>
        </button>
      </div>

      {/* Active Mission Simulation Indicator */}
      {activeSimulationId && (
        <div className="bg-gradient-to-r from-emerald-900 to-[#163D2B] text-white p-6 rounded-3xl shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 animate-spin">
              <Radar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Полет выполняется • Телеметрия активна</span>
              </div>
              <h3 className="font-bold text-base text-white">Автономное сканирование поля</h3>
              <p className="text-xs text-emerald-200/70">Высота: 65м • Скорость: 16 м/с • Перекрытие: 80%</p>
            </div>
          </div>

          <div className="w-full md:w-64 space-y-1 text-right">
            <div className="flex justify-between text-xs font-bold text-emerald-300">
              <span>Прогресс съёмки</span>
              <span>{simulationProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-emerald-400/20">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-500" 
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Missions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {missions.map((mission) => {
          const isSimulating = activeSimulationId === mission.id;
          return (
            <div
              key={mission.id}
              className="bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-xs hover:shadow-lg transition-all p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#2F7D4A]">
                    <Radar className="w-5 h-5" />
                  </div>
                  <span className={cn(
                    "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                    mission.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    mission.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-700 border border-blue-200 animate-pulse" :
                    mission.status === 'READY' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {mission.status}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-base text-slate-900 leading-snug mb-1">
                  {mission.name}
                </h3>
                <p className="text-xs text-slate-400 mb-4">{mission.fieldName}</p>

                {/* Telemetry specs */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl text-xs mb-4">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Высота</span>
                    <span className="font-bold text-slate-800">{mission.altitudeMeters}м</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Оверлап</span>
                    <span className="font-bold text-slate-800">{mission.imageOverlapPercent}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Снимков</span>
                    <span className="font-bold text-slate-800">{mission.imagesCount || 142}</span>
                  </div>
                </div>

                {mission.notes && (
                  <p className="text-xs text-slate-500 italic mb-4 line-clamp-2">
                    «{mission.notes}»
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => onDeleteMission(mission.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Удалить миссию"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {mission.status === 'READY' && (
                  <button
                    onClick={() => handleStartMission(mission)}
                    disabled={!!activeSimulationId}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Запустить полёт</span>
                  </button>
                )}

                {mission.status === 'COMPLETED' && (
                  <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Обработано</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-serif font-bold text-lg text-slate-900">Создать дрон-миссию</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">Целевое поле *</label>
                <select
                  value={formData.fieldId}
                  onChange={(e) => setFormData({ ...formData, fieldId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                >
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.crop}, {f.areaHectares} га)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">Название задания *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Ортофотоплан фазы кущения"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Высота полёта (м)</label>
                  <input
                    type="number"
                    min="20"
                    max="150"
                    value={formData.altitudeMeters}
                    onChange={(e) => setFormData({ ...formData, altitudeMeters: parseInt(e.target.value) || 60 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Перекрытие снимков (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="90"
                    value={formData.imageOverlapPercent}
                    onChange={(e) => setFormData({ ...formData, imageOverlapPercent: parseInt(e.target.value) || 75 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">Примечания к полёту</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Особые указания пилоту / сенсорам..."
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white font-bold uppercase tracking-wider text-xs shadow-md"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
