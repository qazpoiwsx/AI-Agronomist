import React, { useState } from 'react';
import { 
  CheckSquare, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  X, 
  Filter, 
  Sparkles, 
  ShieldCheck, 
  ChevronRight,
  Info,
  Calendar
} from 'lucide-react';
import { Recommendation, Field } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
  fields: Field[];
  lang: Language;
  onUpdateStatus: (id: string, status: Recommendation['status']) => Promise<void>;
  onCreateRecommendation: (rec: Partial<Recommendation>) => Promise<void>;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  recommendations,
  fields,
  lang,
  onUpdateStatus,
  onCreateRecommendation
}) => {
  const t = translations[lang];

  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fieldId: fields[0]?.id || '',
    title: '',
    description: '',
    priority: 'HIGH' as Recommendation['priority'],
    reason: '',
    suggestedAction: '',
    expectedBenefit: ''
  });

  const handleOpenCreate = () => {
    setFormData({
      fieldId: fields[0]?.id || '',
      title: '',
      description: '',
      priority: 'HIGH',
      reason: '',
      suggestedAction: '',
      expectedBenefit: ''
    });
    setIsModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const selField = fields.find(f => f.id === formData.fieldId);
    await onCreateRecommendation({
      ...formData,
      fieldName: selField?.name || t.tableField,
      status: 'NEW'
    });
    setIsModalOpen(false);
  };

  const filteredRecs = recommendations.filter(r => {
    const matchesPriority = filterPriority === 'all' || r.priority === filterPriority;
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesPriority && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {t.recsHeaderTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.recsHeaderDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">{t.recsAllPriorities}</option>
            <option value="CRITICAL">{t.recsPriorityCritical}</option>
            <option value="HIGH">{t.recsPriorityHigh}</option>
            <option value="MEDIUM">{t.recsPriorityMedium}</option>
            <option value="LOW">{t.recsPriorityLow}</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">{t.recsAllStatuses}</option>
            <option value="NEW">{t.recsStatusNew}</option>
            <option value="IN_PROGRESS">{t.recsStatusInProgress}</option>
            <option value="COMPLETED">{t.recsStatusCompleted}</option>
            <option value="DISMISSED">{t.recsStatusDismissed}</option>
          </select>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{t.recsAddMeasure}</span>
          </button>
        </div>
      </div>

      {/* Recommendations Cards List */}
      {filteredRecs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="font-serif font-bold text-lg text-slate-900 mb-1">
            {t.noActiveRecs}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {t.recsAllCompletedDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRecs.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 shadow-xs hover:shadow-lg transition-all p-6 flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white",
                      rec.priority === 'CRITICAL' ? "bg-red-500" :
                      rec.priority === 'HIGH' ? "bg-amber-500" :
                      rec.priority === 'MEDIUM' ? "bg-blue-600" : "bg-emerald-600"
                    )}>
                      {rec.priority === 'CRITICAL' ? t.recsPriorityCritical :
                       rec.priority === 'HIGH' ? t.recsPriorityHigh :
                       rec.priority === 'MEDIUM' ? t.recsPriorityMedium : t.recsPriorityLow}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{rec.fieldName}</span>
                  </div>

                  <span className={cn(
                    "px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase tracking-wider",
                    rec.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                    rec.status === 'IN_PROGRESS' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                    rec.status === 'DISMISSED' ? "bg-slate-100 text-slate-500 border border-slate-200" :
                    "bg-amber-50 text-amber-700 border border-amber-200"
                  )}>
                    {rec.status === 'COMPLETED' ? t.recsStatusCompleted :
                     rec.status === 'IN_PROGRESS' ? t.recsStatusInProgress :
                     rec.status === 'DISMISSED' ? t.recsStatusDismissed : t.recsStatusNew}
                  </span>
                </div>

                <h3 className="font-serif font-bold text-base text-slate-900 leading-snug mb-2">
                  {rec.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {rec.description}
                </p>

                {/* Structured Rationale Grid */}
                <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                  <div>
                    <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5">
                      {t.recsReasonLabel}
                    </span>
                    <p className="text-slate-800 font-medium">{rec.reason}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5">
                      {t.recsActionLabel}
                    </span>
                    <p className="text-slate-800 font-medium">{rec.suggestedAction}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="font-bold text-[10px] text-emerald-700 uppercase tracking-widest block mb-0.5">
                      {t.recsBenefitLabel}
                    </span>
                    <p className="text-emerald-800 font-bold">{rec.expectedBenefit}</p>
                  </div>
                </div>
              </div>

              {/* Status Update Buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 font-medium">
                  {new Date(rec.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1.5">
                  {rec.status !== 'IN_PROGRESS' && rec.status !== 'COMPLETED' && (
                    <button
                      onClick={() => onUpdateStatus(rec.id, 'IN_PROGRESS')}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold uppercase transition-colors"
                    >
                      {t.recsBtnInProgress}
                    </button>
                  )}
                  {rec.status !== 'COMPLETED' && (
                    <button
                      onClick={() => onUpdateStatus(rec.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-bold uppercase transition-colors shadow-xs"
                    >
                      {t.recsBtnCompleted}
                    </button>
                  )}
                  {rec.status !== 'DISMISSED' && (
                    <button
                      onClick={() => onUpdateStatus(rec.id, 'DISMISSED')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold uppercase transition-colors"
                    >
                      {t.recsBtnDismiss}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-serif font-bold text-lg text-slate-900">{t.recsModalTitle}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsTargetField}</label>
                <select
                  value={formData.fieldId}
                  onChange={(e) => setFormData({ ...formData, fieldId: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                >
                  {fields.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.crop})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsRecommendationTitleLabel}</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t.recsTitlePlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsPriorityLabel}</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                >
                  <option value="CRITICAL">{t.recsPriorityCriticalOpt}</option>
                  <option value="HIGH">{t.recsPriorityHighOpt}</option>
                  <option value="MEDIUM">{t.recsPriorityMediumOpt}</option>
                  <option value="LOW">{t.recsPriorityLowOpt}</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsReasonInputLabel}</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder={t.recsReasonPlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsActionInputLabel}</label>
                <textarea
                  rows={2}
                  value={formData.suggestedAction}
                  onChange={(e) => setFormData({ ...formData, suggestedAction: e.target.value })}
                  placeholder={t.recsActionPlaceholder}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 mb-1 block">{t.recsBenefitInputLabel}</label>
                <input
                  type="text"
                  value={formData.expectedBenefit}
                  onChange={(e) => setFormData({ ...formData, expectedBenefit: e.target.value })}
                  placeholder={t.recsBenefitPlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
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
