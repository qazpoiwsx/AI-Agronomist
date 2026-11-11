import React, { useState } from 'react';
import { 
  Sprout, 
  Plus, 
  MapPin, 
  Calendar, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  X, 
  Check, 
  Upload, 
  FileCode, 
  Search, 
  Filter, 
  Layers, 
  Droplet, 
  Thermometer, 
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { Field, PlantCulture, CULTURES } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';
import { TabRoute } from './Sidebar';
import { FieldMapDrawer } from './FieldMapDrawer';
import { isSeedField } from '../lib/demoData';

interface FieldsViewProps {
  fields: Field[];
  lang: Language;
  onAddField: (field: Partial<Field>) => Promise<void>;
  onUpdateField: (id: string, updates: Partial<Field>) => Promise<void>;
  onDeleteField: (id: string) => Promise<void>;
  setActiveTab: (tab: TabRoute) => void;
  onSelectFieldOnMap?: (field: Field) => void;
  userLocation?: { lat: number; lng: number } | null;
  demoDataEnabled?: boolean;
}

export const FieldsView: React.FC<FieldsViewProps> = ({
  fields,
  lang,
  onAddField,
  onUpdateField,
  onDeleteField,
  setActiveTab,
  onSelectFieldOnMap,
  userLocation,
  demoDataEnabled = false
}) => {
  const t = translations[lang];

  const [search, setSearch] = useState('');
  const [filterCrop, setFilterCrop] = useState<string>('all');
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [selectedFieldDetail, setSelectedFieldDetail] = useState<Field | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'location' | 'soil'>('overview');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Map Drawing State
  const [drawnPolygon, setDrawnPolygon] = useState<[number, number][]>([]);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);
  const [calculatedCenter, setCalculatedCenter] = useState<[number, number]>([0, 0]);

  // Form State (Crop and secondary specs are optional)
  const [formData, setFormData] = useState({
    name: '',
    crop: 'wheat' as PlantCulture,
    variety: '',
    plantingDate: '',
    expectedHarvestDate: '',
    soilType: '',
    irrigationType: 'rainfed' as 'drip' | 'sprinkler' | 'flood' | 'rainfed',
    currentHealth: 'healthy' as 'healthy' | 'warning' | 'critical' | 'pending',
    notes: ''
  });

  const handleOpenCreate = () => {
    setEditingField(null);
    setDrawnPolygon([]);
    setCalculatedArea(0);
    const initialCenter: [number, number] = userLocation?.lat && userLocation?.lng 
      ? [userLocation.lat, userLocation.lng] 
      : [51.1645, 71.4777];
    setCalculatedCenter(initialCenter);
    setValidationError(null);
    setFormData({
      name: '',
      crop: 'wheat',
      variety: '',
      plantingDate: '',
      expectedHarvestDate: '',
      soilType: '',
      irrigationType: 'rainfed',
      currentHealth: 'healthy',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: Field) => {
    setEditingField(f);
    const existingPolygon = Array.isArray(f.polygon) ? f.polygon : [];
    setDrawnPolygon(existingPolygon);
    setCalculatedArea(f.areaHectares || 0);
    setCalculatedCenter(f.center || [0, 0]);
    setValidationError(null);
    setFormData({
      name: f.name,
      crop: f.crop || 'wheat',
      variety: f.variety || '',
      plantingDate: f.plantingDate || '',
      expectedHarvestDate: f.expectedHarvestDate || '',
      soilType: f.soilType || '',
      irrigationType: f.irrigationType || 'rainfed',
      currentHealth: f.currentHealth || 'healthy',
      notes: f.notes || ''
    });
    setIsModalOpen(true);
  };

  const handlePolygonChange = (points: [number, number][], areaHectares: number, center: [number, number]) => {
    setDrawnPolygon(points);
    setCalculatedArea(areaHectares);
    setCalculatedCenter(center);
    if (points.length >= 3) {
      setValidationError(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setValidationError(t.fieldsEnterNameError);
      return;
    }
    if (drawnPolygon.length < 3) {
      setValidationError(t.boundaryRequiredAlert || 'Пожалуйста, нарисуйте границу поля на карте (минимум 3 точки)');
      return;
    }

    if (editingField) {
      await onUpdateField(editingField.id, {
        ...formData,
        center: calculatedCenter,
        polygon: drawnPolygon,
        areaHectares: calculatedArea
      });
    } else {
      await onAddField({
        ...formData,
        center: calculatedCenter,
        polygon: drawnPolygon,
        areaHectares: calculatedArea
      });
    }

    setIsModalOpen(false);
  };

  // Filter out demo/seed fields if DEMO_DATA_ENABLED is false; user fields are always retained
  const visibleFields = demoDataEnabled ? fields : fields.filter(f => !isSeedField(f));

  // Filtered fields
  const filteredFields = visibleFields.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) || 
                          f.variety.toLowerCase().includes(search.toLowerCase());
    const matchesCrop = filterCrop === 'all' || f.crop === filterCrop;
    const matchesHealth = filterHealth === 'all' || f.currentHealth === filterHealth;
    return matchesSearch && matchesCrop && matchesHealth;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Controls: Search, Filters, Add Field Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex-1 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.fieldsSearchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]/20 focus:border-[#2F7D4A]"
            />
          </div>

          {/* Crop filter */}
          <select
            value={filterCrop}
            onChange={(e) => setFilterCrop(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">{t.fieldsAllCrops}</option>
            {CULTURES.map(c => (
              <option key={c.id} value={c.id}>
                {c.icon} {(t.cultures as any)[c.id] || c.name}
              </option>
            ))}
          </select>

          {/* Health status filter */}
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="all">{t.fieldsAllStatuses}</option>
            <option value="healthy">{t.healthyStatus || 'В норме'}</option>
            <option value="warning">{t.warningStatus || 'Внимание'}</option>
            <option value="critical">{t.criticalStatus || 'Критическое'}</option>
          </select>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.createField}
        </button>
      </div>

      {/* Fields Grid */}
      {filteredFields.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#2F7D4A] flex items-center justify-center mx-auto mb-4">
            <Sprout className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-slate-900 mb-1">
            {t.fieldsNoFieldsFound}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            {t.fieldsNoFieldsFoundDesc}
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-5 py-2.5 rounded-2xl bg-[#2F7D4A] text-white text-xs font-bold uppercase tracking-wider shadow-md hover:bg-[#163D2B] transition-all"
          >
            {t.createField}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFields.map((field) => {
            const cropObj = CULTURES.find(c => c.id === field.crop);
            return (
              <div
                key={field.id}
                className="bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-lg transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                        {cropObj?.icon || '🌾'}
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-base text-slate-900 leading-snug line-clamp-1">
                          {field.name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {(t.cultures as any)[field.crop] || field.crop} {field.variety && `• ${field.variety}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0",
                        field.currentHealth === 'healthy' ? "bg-emerald-50 text-[#2F7D4A] border border-emerald-200" :
                        field.currentHealth === 'warning' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-red-50 text-red-600 border border-red-200"
                      )}>
                        {field.currentHealth === 'healthy' ? t.healthyStatus :
                         field.currentHealth === 'warning' ? t.warningStatus : t.criticalStatus}
                      </span>
                      {isSeedField(field) && (
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                          {t.fieldsBadgeDemo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Field Specs */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/80 rounded-2xl mb-4 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.fieldsAreaLabel}</p>
                      <p className="font-bold text-slate-800">{field.areaHectares} {t.hectareShort}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.fieldsSoilLabel}</p>
                      <p className="font-bold text-slate-800 truncate">{field.soilType || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.fieldsIrrigationLabel}</p>
                      <p className="font-bold text-slate-800">
                        {field.irrigationType === 'drip' ? t.fieldsIrrigationDrip : 
                         field.irrigationType === 'sprinkler' ? t.fieldsIrrigationSprinkler : 
                         field.irrigationType === 'flood' ? t.fieldsIrrigationFlood : t.fieldsIrrigationRainfed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.fieldsPlantingLabel}</p>
                      <p className="font-bold text-slate-800">{field.plantingDate || '—'}</p>
                    </div>
                  </div>

                  {field.notes && (
                    <p className="text-xs text-slate-500 line-clamp-2 italic mb-2">
                      «{field.notes}»
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (onSelectFieldOnMap) onSelectFieldOnMap(field);
                        setActiveTab('map');
                      }}
                      className="p-2 rounded-xl text-slate-600 hover:text-[#2F7D4A] hover:bg-emerald-50 transition-colors"
                      title={t.fieldsShowOnMap}
                    >
                      <MapPin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(field)}
                      className="p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title={t.editField}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`${t.fieldsConfirmDelete} «${field.name}»?`)) {
                          onDeleteField(field.id);
                        }
                      }}
                      className="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title={t.deleteField}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedFieldDetail(field);
                      setActiveDetailTab('overview');
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-[#2F7D4A] hover:underline"
                  >
                    <span>{t.details}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Field Detail Modal */}
      {selectedFieldDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#2F7D4A] flex items-center justify-center text-xl">
                  {CULTURES.find(c => c.id === selectedFieldDetail.crop)?.icon || '🌾'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-900">{selectedFieldDetail.name}</h3>
                  <p className="text-xs text-slate-500">ID: {selectedFieldDetail.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedFieldDetail(null)}
                className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Status and telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t.cultureLabel}</span>
                  <p className="font-bold text-slate-800">{(t.cultures as any)[selectedFieldDetail.crop] || selectedFieldDetail.crop}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t.variety}</span>
                  <p className="font-bold text-slate-800">{selectedFieldDetail.variety || t.fieldsNotSpecified}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t.fieldsAreaLabel}</span>
                  <p className="font-bold text-slate-800">{selectedFieldDetail.areaHectares} {t.hectareShort}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t.fieldHealth}</span>
                  <p className="font-bold capitalize text-emerald-700">
                    {selectedFieldDetail.currentHealth === 'healthy' ? t.healthyStatus :
                     selectedFieldDetail.currentHealth === 'warning' ? t.warningStatus :
                     selectedFieldDetail.currentHealth === 'critical' ? t.criticalStatus : t.pendingStatus}
                  </p>
                </div>
              </div>

              {/* Coordinates & PostGIS Info */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs space-y-2">
                <h4 className="font-bold text-emerald-950 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#2F7D4A]" />
                  {t.fieldsGeocoordinates}
                </h4>
                <p className="text-slate-600 font-mono text-[11px]">
                  {t.fieldsCenter} {selectedFieldDetail.center[0].toFixed(5)}°N, {selectedFieldDetail.center[1].toFixed(5)}°E
                </p>
                <p className="text-slate-500 text-[11px]">
                  {t.fieldsPolygonVerticesPrefix} {selectedFieldDetail.polygon?.length || 4} {t.fieldsPointsSuffix}
                </p>
              </div>

              {/* Agronomic Notes */}
              <div>
                <h4 className="font-bold text-xs text-slate-900 mb-2">{t.fieldsAgronomicNotes}</h4>
                <p className="text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {selectedFieldDetail.notes || t.fieldsNoNotes}
                </p>
              </div>

              {/* Quick Jump buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedFieldDetail(null);
                    if (onSelectFieldOnMap) onSelectFieldOnMap(selectedFieldDetail);
                    setActiveTab('map');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                >
                  {t.fieldsOpenOnMap}
                </button>
                <button
                  onClick={() => {
                    setSelectedFieldDetail(null);
                    setActiveTab('analysis');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  {t.fieldsLeafDiagnosis}
                </button>
                <button
                  onClick={() => {
                    setSelectedFieldDetail(null);
                    setActiveTab('missions');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  {t.fieldsAssignDrone}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal with Interactive Map Drawing */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  {editingField ? t.editField : t.createField}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t.onlyNameAndBoundaryRequired || "Обязательны только название и контур участка на карте"}
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
              {validationError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* 1. Field Name (REQUIRED) */}
              <div>
                <label className="font-bold text-slate-700 mb-1.5 block">
                  {t.fieldName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.fieldsNamePlaceholder}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2F7D4A]/20 focus:border-[#2F7D4A] text-xs font-medium"
                />
              </div>

              {/* 2. Interactive Map Drawing (REQUIRED BOUNDARY) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#2F7D4A]" />
                    <span>{t.drawFieldContour || "Граница участка на карте"}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {drawnPolygon.length} {t.fieldsPointsCount}
                  </span>
                </div>

                <FieldMapDrawer
                  initialPolygon={drawnPolygon}
                  defaultCenter={calculatedCenter[0] !== 0 ? calculatedCenter : (userLocation ? [userLocation.lat, userLocation.lng] : [51.1645, 71.4777])}
                  onPolygonChange={handlePolygonChange}
                  lang={lang}
                />
              </div>

              {/* 3. Optional Agricultural Parameters */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {t.fieldsOptionalSpecs}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">{t.cropType}</label>
                    <select
                      value={formData.crop}
                      onChange={(e) => setFormData({ ...formData, crop: e.target.value as PlantCulture })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white text-xs"
                    >
                      {CULTURES.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {(t.cultures as any)[c.id] || c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">{t.variety}</label>
                    <input
                      type="text"
                      value={formData.variety}
                      onChange={(e) => setFormData({ ...formData, variety: e.target.value })}
                      placeholder={t.fieldsVarietyPlaceholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">{t.fieldHealth}</label>
                    <select
                      value={formData.currentHealth}
                      onChange={(e) => setFormData({ ...formData, currentHealth: e.target.value as any })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white text-xs"
                    >
                      <option value="healthy">{t.healthyStatus}</option>
                      <option value="warning">{t.warningStatus}</option>
                      <option value="critical">{t.criticalStatus}</option>
                      <option value="pending">{t.pendingStatus}</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">{t.plantingDate}</label>
                    <input
                      type="date"
                      value={formData.plantingDate}
                      onChange={(e) => setFormData({ ...formData, plantingDate: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">{t.irrigation}</label>
                    <select
                      value={formData.irrigationType}
                      onChange={(e) => setFormData({ ...formData, irrigationType: e.target.value as any })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none bg-white text-xs"
                    >
                      <option value="rainfed">{t.fieldsIrrigationRainfed}</option>
                      <option value="drip">{t.fieldsIrrigationDrip}</option>
                      <option value="sprinkler">{t.fieldsIrrigationSprinkler}</option>
                      <option value="flood">{t.fieldsIrrigationFlood}</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="font-bold text-slate-700 mb-1 block">{t.fieldsNotesLabel}</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.fieldsNotesPlaceholder}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold uppercase tracking-wider text-xs"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white font-bold uppercase tracking-wider text-xs shadow-md transition-all active:scale-95"
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
