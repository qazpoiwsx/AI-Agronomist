import React, { useState } from 'react';
import { 
  ShieldCheck, 
  X, 
  Check, 
  AlertTriangle, 
  FileCheck2, 
  UserCheck, 
  Calendar,
  Sparkles
} from 'lucide-react';
import { AnalysisResult, AgronomistReview } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface AgronomistReviewModalProps {
  analysis: AnalysisResult;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (reviewData: Partial<AgronomistReview>) => Promise<void>;
  reviewerName?: string;
}

export const AgronomistReviewModal: React.FC<AgronomistReviewModalProps> = ({
  analysis,
  isOpen,
  onClose,
  onSubmitReview,
  reviewerName = "Главный агроном"
}) => {
  if (!isOpen) return null;

  const [status, setStatus] = useState<'confirmed' | 'rejected' | 'modified'>('confirmed');
  const [revisedDiagnosis, setRevisedDiagnosis] = useState(analysis.diagnosis);
  const [comments, setComments] = useState(
    'Диагноз подтвержден по морфологическим признакам пустул и цвету спор. Рекомендуется химическая обработка.'
  );
  const [recommendations, setRecommendations] = useState(
    'Применить фунгицид Тилт 25% (0.5 л/га) или Рекс Дуо (0.6 л/га) в ближайшие 48 часов.'
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmitReview({
        analysisId: analysis.id,
        fieldId: analysis.fieldId,
        reviewerId: 'agronomist-1',
        reviewerName,
        status,
        revisedDiagnosis: status === 'modified' ? revisedDiagnosis : analysis.diagnosis,
        comments,
        recommendations
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-slate-900">
                Верификация агронома
              </h3>
              <p className="text-xs text-slate-400">Профессиональная экспертиза ИИ-анализа</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Analysis Context Summary */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Диагноз ИИ</span>
              <span className="text-xs font-bold text-emerald-700">{Math.round(analysis.confidence * 100)}% совпадение</span>
            </div>
            <p className="font-serif font-bold text-sm text-slate-900">{analysis.diagnosis}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Культура: {analysis.culture} • Угроза: {analysis.severity.toUpperCase()}
            </p>
          </div>

          {/* Decision Selector */}
          <div>
            <label className="font-bold text-slate-700 mb-2 block">Решение эксперта *</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('confirmed')}
                className={cn(
                  "p-3 rounded-2xl font-bold uppercase tracking-wider text-[10px] border transition-all text-center",
                  status === 'confirmed'
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                Подтвердить
              </button>

              <button
                type="button"
                onClick={() => setStatus('modified')}
                className={cn(
                  "p-3 rounded-2xl font-bold uppercase tracking-wider text-[10px] border transition-all text-center",
                  status === 'modified'
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                Скорректировать
              </button>

              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={cn(
                  "p-3 rounded-2xl font-bold uppercase tracking-wider text-[10px] border transition-all text-center",
                  status === 'rejected'
                    ? "bg-red-600 text-white border-red-600 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                Отклонить
              </button>
            </div>
          </div>

          {/* Revised Diagnosis if modified */}
          {status === 'modified' && (
            <div>
              <label className="font-bold text-slate-700 mb-1 block">Уточненный диагноз</label>
              <input
                type="text"
                value={revisedDiagnosis}
                onChange={(e) => setRevisedDiagnosis(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 mb-1 block">Агрономическое заключение и симптомы</label>
            <textarea
              rows={3}
              required
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 mb-1 block">Утвержденные защитные меры</label>
            <textarea
              rows={2}
              required
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
            />
          </div>

          <div className="pt-2 text-[10px] text-slate-400">
            Эксперт: <b>{reviewerName}</b> • Электронная подпись будет зафиксирована в реестре.
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-xs"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Сохранение...' : 'Утвердить заключение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
