import React, { useState } from 'react';
import { 
  TrendingDown, 
  DollarSign, 
  Package, 
  Calculator, 
  Info, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { Field, AnalysisResult, Currency, UnitSystem, PlantCulture } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface YieldLossViewProps {
  fields: Field[];
  analyses: AnalysisResult[];
  currency: Currency;
  unitSystem: UnitSystem;
  lang: Language;
}

export const YieldLossView: React.FC<YieldLossViewProps> = ({
  fields,
  analyses,
  currency,
  unitSystem,
  lang
}) => {
  const t = translations[lang];

  // Interactive Scenario Parameters
  const [selectedFieldId, setSelectedFieldId] = useState<string>(fields[0]?.id || '');
  const [cropPrice, setCropPrice] = useState<number>(75000); // KZT per ton
  const [plannedYield, setPlannedYield] = useState<number>(2.4); // tons per ha
  const [infectionPercent, setInfectionPercent] = useState<number>(25); // 25% of field
  const [damageSeverity, setDamageSeverity] = useState<number>(30); // 30% yield loss on infected area
  const [treatmentCostPerHa, setTreatmentCostPerHa] = useState<number>(12000); // KZT per ha

  const activeField = fields.find(f => f.id === selectedFieldId) || fields[0] || {
    name: t.tableField,
    areaHectares: 100,
    crop: 'wheat' as PlantCulture
  };

  // Math
  const fieldArea = activeField.areaHectares;
  const affectedArea = Math.round((fieldArea * (infectionPercent / 100)) * 10) / 10;
  
  // Total potential yield without disease
  const baselineTotalProduction = fieldArea * plannedYield; // tons
  
  // Loss without treatment
  const lossTons = Math.round((affectedArea * plannedYield * (damageSeverity / 100)) * 10) / 10;
  const totalFinancialLoss = Math.round(lossTons * cropPrice);
  const financialLossPerHa = Math.round(totalFinancialLoss / fieldArea);

  // Economic efficiency of treatment
  const totalTreatmentCost = Math.round(affectedArea * treatmentCostPerHa);
  const netSavedMoney = totalFinancialLoss - totalTreatmentCost;
  const roiMultiplier = totalTreatmentCost > 0 ? (totalFinancialLoss / totalTreatmentCost).toFixed(1) : '4.2';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t.yieldEconomicModule}
            </span>
          </div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {t.yieldEconomicModuleTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t.yieldEconomicModuleDesc}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
          >
            {fields.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.areaHectares} {t.hectareShort})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Results KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Financial Loss */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
            <TrendingDown className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            {t.yieldPotentialLossNoTreatment}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-serif font-bold text-red-600">
              {totalFinancialLoss.toLocaleString()}
            </h3>
            <span className="text-xs font-bold text-red-500 uppercase">{currency}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            ≈ {financialLossPerHa.toLocaleString()} {currency}/{t.hectareShort} {t.yieldPerHaTotalField}
          </p>
        </div>

        {/* Biological Weight Loss */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            {t.yieldCommercialLoss}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-serif font-bold text-slate-900">
              {lossTons}
            </h3>
            <span className="text-xs font-bold text-slate-500 uppercase">{t.yieldGrainTons}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {t.yieldAffectedAreaLabel} <b>{affectedArea} {t.hectareShort}</b> ({infectionPercent}{t.yieldPercentOfField})
          </p>
        </div>

        {/* ROI of Treatment */}
        <div className="bg-gradient-to-br from-[#163D2B] to-[#2F7D4A] rounded-3xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center mb-4 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mb-1">
              {t.yieldRoiTitle}
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-serif font-bold text-white">
                {roiMultiplier}x
              </h3>
              <span className="text-xs font-bold text-emerald-300 uppercase">{t.yieldPayback}</span>
            </div>
          </div>
          <p className="text-xs text-emerald-100/80 mt-3">
            {t.yieldFungicideCost} {totalTreatmentCost.toLocaleString()} {currency} • {t.yieldNetSavedProfit} +{netSavedMoney.toLocaleString()} {currency}
          </p>
        </div>
      </div>

      {/* Interactive Agronomic Simulator */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2F7D4A] flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-slate-900">
                {t.yieldSimulatorTitle}
              </h3>
              <p className="text-xs text-slate-400">{t.yieldSimulatorDesc}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sliders Column */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-600">{t.yieldMarketPrice} ({currency}/{t.tons}):</span>
                <span className="text-slate-900">{cropPrice.toLocaleString()} {currency}</span>
              </div>
              <input
                type="range"
                min="40000"
                max="180000"
                step="5000"
                value={cropPrice}
                onChange={(e) => setCropPrice(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2F7D4A]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-600">{t.yieldPlannedYield} ({t.tons}/{t.hectareShort}):</span>
                <span className="text-slate-900">{plannedYield} {t.tons}/{t.hectareShort}</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="6.0"
                step="0.1"
                value={plannedYield}
                onChange={(e) => setPlannedYield(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2F7D4A]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-600">{t.yieldInfectionSpread}</span>
                <span className="text-slate-900">{infectionPercent}% ({affectedArea} {t.hectareShort})</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={infectionPercent}
                onChange={(e) => setInfectionPercent(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#2F7D4A]"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-600">{t.yieldBiologicalDamage}</span>
                <span className="text-slate-900">{damageSeverity}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={damageSeverity}
                onChange={(e) => setDamageSeverity(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
            </div>
          </div>

          {/* Right Comparison Column: Treated vs Untreated */}
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
            <h4 className="font-serif font-bold text-sm text-slate-900 mb-4">
              {t.yieldStrategyComparison}
            </h4>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-red-200">
                <p className="font-bold text-red-700 uppercase tracking-wider text-[10px] mb-1">{t.yieldScenario1Title}</p>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600">{t.yieldCropLossLabel}</span>
                  <span className="font-bold text-red-600 text-sm">-{lossTons} {t.tons} (-{totalFinancialLoss.toLocaleString()} {currency})</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-emerald-200">
                <p className="font-bold text-emerald-700 uppercase tracking-wider text-[10px] mb-1">{t.yieldScenario2Title}</p>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-slate-600">{t.yieldTreatmentCostLabel}</span>
                  <span className="font-bold text-slate-800">{totalTreatmentCost.toLocaleString()} {currency}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-600">{t.yieldSavedHarvestLabel}</span>
                  <span className="font-bold text-emerald-600 text-sm">+{netSavedMoney.toLocaleString()} {currency}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-slate-400" />
              <span>{t.yieldCalculationNote}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
