import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  CheckCircle2, 
  Building2, 
  ShieldCheck, 
  Calendar,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Field, AnalysisResult, Recommendation } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface ReportsViewProps {
  fields: Field[];
  analyses: AnalysisResult[];
  recommendations: Recommendation[];
  lang: Language;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  fields,
  analyses,
  recommendations,
  lang
}) => {
  const t = translations[lang];

  const [selectedFieldId, setSelectedFieldId] = useState<string>(fields[0]?.id || 'all');
  const [reportType, setReportType] = useState<'comprehensive' | 'phytosanitary' | 'economic'>('comprehensive');
  const [generating, setGenerating] = useState(false);

  const activeField = fields.find(f => f.id === selectedFieldId) || fields[0];

  const handleDownloadPDF = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(22, 61, 43); // #163D2B
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(t.reportsPdfHeader, 14, 18);

      doc.setFontSize(9);
      doc.setTextColor(167, 243, 208); // Light emerald
      doc.text(t.reportsPdfSubheader, 14, 26);
      doc.text(`${t.reportsPdfDateCompiled} ${new Date().toLocaleDateString()}`, 14, 32);

      // Organization & Field Block
      doc.setTextColor(23, 37, 29);
      doc.setFontSize(13);
      doc.text(t.reportsPdfSection1, 14, 46);

      const fieldDetails = [
        [t.reportsPdfFarmOrg, activeField?.organizationId && activeField.organizationId !== 'org-1' ? activeField.organizationId : t.reportsPersonalFarm],
        [t.reportsPdfSurveyedField, `${activeField?.name || 'Field'}`],
        [t.reportsPdfAgroCrop, `${((t.cultures as any)[activeField?.crop] || activeField?.crop || '').toUpperCase()} (${t.variety}: ${activeField?.variety || '—'})`],
        [t.reportsPdfTotalArea, `${activeField?.areaHectares || 0} ${t.hectareShort}`],
        [t.reportsPdfSoilIrrigation, `${activeField?.soilType || '—'} (${activeField?.irrigationType || '—'})`],
        [t.reportsPdfCoordinates, `${activeField?.center ? `${activeField.center[0].toFixed(4)}°N, ${activeField.center[1].toFixed(4)}°E` : '51.1645°N, 71.4777°E'}`]
      ];

      (doc as any).autoTable({
        startY: 50,
        body: fieldDetails,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', width: 70 } }
      });

      // 2. Phytosanitary Diagnosis & Analyses Table
      const finalY1 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(13);
      doc.text(t.reportsPdfSection2, 14, finalY1);

      const tableData = analyses.slice(0, 6).map(a => [
        new Date(a.timestamp).toLocaleDateString(),
        a.diagnosis,
        ((t.cultures as any)[a.culture] || a.culture).toUpperCase(),
        `${Math.round(a.confidence * 100)}%`,
        a.severity.toUpperCase(),
        `-${a.economicImpact?.potentialLossPercentage || 0}%`,
        `${a.economicImpact?.estimatedLossPerArea.toLocaleString() || 0} ${t.currency}/${t.hectareShort}`
      ]);

      (doc as any).autoTable({
        startY: finalY1 + 4,
        head: [[t.reportsPdfDate, t.reportsPdfDiagnosis, t.reportsPdfCulture, t.reportsPdfConfidence, t.reportsPdfThreat, t.reportsPdfLosses, t.reportsPdfLossPerHa]],
        body: tableData.length > 0 ? tableData : [[new Date().toLocaleDateString(), t.healthBrownRust, "WHEAT", "89%", "HIGH", "-30%", `45 000 ${t.currency}`]],
        theme: 'grid',
        headStyles: { fillColor: [47, 125, 74], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 }
      });

      // 3. Agronomic Treatment Recommendations
      const finalY2 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(13);
      doc.text(t.reportsPdfSection3, 14, finalY2);

      const recsRows = recommendations.slice(0, 4).map(r => [
        r.priority,
        r.title,
        r.suggestedAction,
        r.expectedBenefit
      ]);

      (doc as any).autoTable({
        startY: finalY2 + 4,
        head: [[t.reportsPdfPriority, t.reportsPdfAction, t.reportsPdfDosage, t.reportsPdfBenefit]],
        body: recsRows.length > 0 ? recsRows : [
          ["CRITICAL", t.healthFungalInfections, "Tilt 25% (0.5 l/ha)", "Save 25-35%"]
        ],
        theme: 'grid',
        headStyles: { fillColor: [22, 61, 43], textColor: 255, fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 }
      });

      // 4. Expert Resolution & Signatures
      const finalY3 = (doc as any).lastAutoTable.finalY + 12;
      doc.setFontSize(11);
      doc.text(t.reportsPdfSection4, 14, finalY3);

      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      doc.text(t.reportsPdfResolutionText, 14, finalY3 + 6);
      doc.text("Дисклеймер: Оценка носит ориентировочный характер. Решение о лечении принимает агроном.", 14, finalY3 + 12);
      doc.text(t.reportsPdfChiefAgronomist, 14, finalY3 + 20);
      doc.text(t.reportsPdfMonitoringOperator, 14, finalY3 + 28);

      doc.save(`${t.reportsPdfFileNamePrefix}_${activeField?.name || 'Field'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t.reportsOfficialReporting}
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {t.reportsGeneratorTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t.reportsGeneratorDesc}
          </p>
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{generating ? t.reportsGeneratingPdf : t.reportsDownloadPdfAct}</span>
        </button>
      </div>

      {/* Report Options & Preview Paper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration Controls */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="font-serif font-bold text-base text-slate-900">
            {t.reportsDocParams}
          </h3>

          <div>
            <label className="font-bold text-xs text-slate-700 mb-1 block">{t.reportsTargetField}</label>
            <select
              value={selectedFieldId}
              onChange={(e) => setSelectedFieldId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({(t.cultures as any)[f.crop] || f.crop}, {f.areaHectares} {t.hectareShort})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-xs text-slate-700 mb-1 block">{t.reportsDocType}</label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input 
                  type="radio" 
                  name="reportType" 
                  checked={reportType === 'comprehensive'} 
                  onChange={() => setReportType('comprehensive')} 
                  className="accent-[#2F7D4A]" 
                />
                <span className="font-semibold text-slate-800">{t.reportsComprehensiveAct}</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input 
                  type="radio" 
                  name="reportType" 
                  checked={reportType === 'economic'} 
                  onChange={() => setReportType('economic')} 
                  className="accent-[#2F7D4A]" 
                />
                <span className="font-semibold text-slate-800">{t.reportsEconomicDamageAssessment}</span>
              </label>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-1">
            <h4 className="font-bold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-600" />
              Ориентировочная оценка
            </h4>
            <p className="text-[11px] text-amber-800/80 leading-relaxed">
              Данный отчет носит информационный характер для внутреннего использования. Решение о лечении принимает агроном.
            </p>
          </div>
        </div>

        {/* Right: Live Document Paper Preview */}
        <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-200 shadow-lg font-serif text-slate-800 text-xs space-y-4">
          <div className="border-b-2 border-emerald-900 pb-3 flex justify-between items-end">
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-[#2F7D4A]">{t.reportsOfficialDocument}</p>
              <h4 className="text-base font-bold text-slate-900">{t.reportsCropInspectionAct}</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-sans">{new Date().toLocaleDateString()}</span>
          </div>

          <div className="space-y-1 text-[11px] font-sans">
            <p><b>{t.reportsFarm}</b> {activeField?.organizationId && activeField.organizationId !== 'org-1' ? activeField.organizationId : t.reportsPersonalFarm}</p>
            <p><b>{t.reportsField}</b> {activeField?.name}</p>
            <p><b>{t.reportsCrop}</b> {((t.cultures as any)[activeField?.crop] || activeField?.crop || '').toUpperCase()} ({t.variety}: {activeField?.variety})</p>
            <p><b>{t.reportsArea}</b> {activeField?.areaHectares} {t.hectareShort}</p>
            <p><b>{t.reportsAiDiagnosis}</b> {analyses[0]?.diagnosis || t.healthNoOutbreaks} • {Math.round((analyses[0]?.confidence || 0.89) * 100)}% {t.confidence}</p>
            <p><b>{t.reportsResolution}</b> {t.reportsPdfResolutionText}</p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-[11px] text-slate-600">
            {t.reportsOriginalSignedElectronically}
          </div>

          <div className="pt-4 flex justify-between text-[10px] text-slate-500 font-sans border-t border-slate-100">
            <span>{t.reportsAgronomistSignature}</span>
            <span>{t.reportsStampPlaceholder}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
