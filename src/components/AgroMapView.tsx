import React, { useState, useRef, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Polygon, 
  Marker, 
  Popup, 
  Circle, 
  ScaleControl, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Layers, 
  Globe, 
  Map as MapIcon, 
  Plus, 
  Minus, 
  Navigation, 
  Filter, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  CloudSun,
  Sprout
} from 'lucide-react';
import { Field, AnalysisResult, DroneMission, PlantCulture, CULTURES } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

interface AgroMapViewProps {
  fields: Field[];
  analyses: AnalysisResult[];
  missions: DroneMission[];
  lang: Language;
  selectedField?: Field | null;
  onSelectAnalysis?: (analysis: AnalysisResult) => void;
}

// Controller to smoothly pan to selected field or bounds
function MapBoundsController({ fields, selectedField }: { fields: Field[]; selectedField?: Field | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedField) {
      map.setView([selectedField.center[0], selectedField.center[1]], 14, { animate: true });
    } else if (fields.length > 0) {
      const allCoords = fields.flatMap(f => f.polygon || [f.center]);
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords.map(c => [c[0], c[1]]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [fields, selectedField, map]);

  return null;
}

export const AgroMapView: React.FC<AgroMapViewProps> = ({
  fields,
  analyses,
  missions,
  lang,
  selectedField,
  onSelectAnalysis
}) => {
  const t = translations[lang];
  const mapRef = useRef<L.Map | null>(null);

  const [mapMode, setMapMode] = useState<'map' | 'satellite' | 'hybrid'>('hybrid');
  
  // Layers toggles
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [showDetections, setShowDetections] = useState(true);
  const [showStressZones, setShowStressZones] = useState(true);
  const [showMissions, setShowMissions] = useState(true);

  // Filter state
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const filteredAnalyses = analyses.filter(a => {
    if (!a.location) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const defaultCenter: [number, number] = selectedField
    ? [selectedField.center[0], selectedField.center[1]]
    : fields.length > 0
    ? [fields[0].center[0], fields[0].center[1]]
    : [51.1645, 71.4777]; // Astana / Akmola Ag region

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Map Control Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Layer Switches */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mr-1">{t.mapLayersLabel}</span>
          
          <button
            onClick={() => setShowBoundaries(!showBoundaries)}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5",
              showBoundaries ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-slate-100 text-slate-500"
            )}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>{t.mapFieldContours}</span>
          </button>

          <button
            onClick={() => setShowDetections(!showDetections)}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5",
              showDetections ? "bg-red-100 text-red-800 border border-red-300" : "bg-slate-100 text-slate-500"
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t.mapDiseaseOutbreaks} ({filteredAnalyses.length})</span>
          </button>

          <button
            onClick={() => setShowStressZones(!showStressZones)}
            className={cn(
              "px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5",
              showStressZones ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-slate-100 text-slate-500"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{t.mapStressZones}</span>
          </button>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.mapThreatLabel}</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">{t.mapAllLevels}</option>
            <option value="high">{t.mapCriticalHigh}</option>
            <option value="medium">{t.mapMediumThreat}</option>
            <option value="low">{t.mapLowThreat}</option>
          </select>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="bg-white rounded-3xl overflow-hidden border-[8px] border-white shadow-xl h-[650px] relative w-full group">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          maxZoom={20}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <ScaleControl position="bottomleft" />
          <MapBoundsController fields={fields} selectedField={selectedField} />

          {/* Base Layer Tiles */}
          {mapMode === 'map' && (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          {(mapMode === 'satellite' || mapMode === 'hybrid') && (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          {mapMode === 'hybrid' && (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Boundaries'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              zIndex={1000}
              maxZoom={19}
            />
          )}

          {/* 1. Field Boundary Polygons */}
          {showBoundaries && fields.map((field) => {
            const isSelected = selectedField?.id === field.id;
            const healthColor = 
              field.currentHealth === 'critical' ? '#ef4444' :
              field.currentHealth === 'warning' ? '#f59e0b' : '#10b981';

            return (
              <React.Fragment key={field.id}>
                <Polygon
                  positions={field.polygon}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : healthColor,
                    fillColor: healthColor,
                    fillOpacity: isSelected ? 0.45 : 0.25,
                    weight: isSelected ? 4 : 2,
                    dashArray: field.currentHealth === 'critical' ? '6, 6' : undefined
                  }}
                >
                  <Popup>
                    <div className="p-3 text-xs min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">
                          {CULTURES.find(c => c.id === field.crop)?.icon || '🌾'}
                        </span>
                        <div>
                          <h4 className="font-serif font-bold text-sm text-slate-900 leading-tight">{field.name}</h4>
                          <p className="text-[10px] text-slate-500">{(t.cultures as any)[field.crop] || field.crop}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 py-2 border-y border-slate-100 my-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t.fieldsAreaLabel}:</span>
                          <span className="font-bold">{field.areaHectares} {t.hectareShort}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t.variety}:</span>
                          <span className="font-bold">{field.variety || t.fieldsNotSpecified}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{t.fieldHealth}:</span>
                          <span className="font-bold uppercase text-[10px]" style={{ color: healthColor }}>
                            {field.currentHealth === 'healthy' ? t.healthyStatus :
                             field.currentHealth === 'warning' ? t.warningStatus :
                             field.currentHealth === 'critical' ? t.criticalStatus : t.pendingStatus}
                          </span>
                        </div>
                      </div>

                      {field.notes && (
                        <p className="text-[11px] text-slate-600 italic mb-2 line-clamp-2">
                          «{field.notes}»
                        </p>
                      )}
                    </div>
                  </Popup>
                </Polygon>

                {/* Center Label Marker */}
                <Marker
                  position={[field.center[0], field.center[1]]}
                  icon={L.divIcon({
                    className: 'field-label-icon',
                    html: `
                      <div style="background: rgba(22, 61, 43, 0.85); color: #fff; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; border: 1px solid rgba(255,255,255,0.4); white-space: nowrap; transform: translate(-50%, -50%); backdrop-filter: blur(4px);">
                        ${field.name} (${field.areaHectares} ${t.hectareShort})
                      </div>
                    `,
                    iconSize: [0, 0]
                  })}
                />
              </React.Fragment>
            );
          })}

          {/* 2. Stress Zones Overlay Circles */}
          {showStressZones && fields.filter(f => f.currentHealth === 'critical' || f.currentHealth === 'warning').map(f => (
            <Circle
              key={`stress-${f.id}`}
              center={[f.center[0], f.center[1]]}
              radius={250}
              pathOptions={{
                color: f.currentHealth === 'critical' ? '#dc2626' : '#d97706',
                fillColor: f.currentHealth === 'critical' ? '#ef4444' : '#f59e0b',
                fillOpacity: 0.2,
                weight: 1,
                dashArray: '4, 4'
              }}
            />
          ))}

          {/* 3. Disease Detections Point Markers */}
          {showDetections && filteredAnalyses.map((item) => (
            <Marker
              key={item.id}
              position={[item.location!.lat, item.location!.lng]}
              icon={L.divIcon({
                className: 'custom-detection-icon',
                html: `
                  <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
                    <div style="width: 30px; height: 30px; border-radius: 50%; background: ${item.severity === 'high' ? '#dc2626' : item.severity === 'medium' ? '#ea580c' : '#16a34a'}; border: 2px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">
                      ${item.issueType === 'disease' ? '🦠' : item.issueType === 'pest' ? '🐞' : '🌱'}
                    </div>
                  </div>
                `,
                iconSize: [34, 34],
                iconAnchor: [17, 17]
              })}
            >
              <Popup>
                <div className="p-3 text-xs min-w-[210px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-bold uppercase text-white",
                      item.severity === 'high' ? "bg-red-600" : item.severity === 'medium' ? "bg-amber-600" : "bg-emerald-600"
                    )}>
                      {item.severity}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.culture}</span>
                  </div>

                  <h4 className="font-serif font-bold text-sm text-slate-900 mb-1">{item.diagnosis}</h4>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {t.mapAiConfidence} <b>{Math.round(item.confidence * 100)}%</b>
                  </p>

                  <div className="p-2 bg-slate-50 rounded-xl mb-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{t.mapLossesLabel}</span>
                      <span className="font-bold text-red-600">-{item.economicImpact?.potentialLossPercentage}%</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{t.mapDamageLabel}</span>
                      <span className="font-bold">{item.economicImpact?.estimatedLossPerArea.toLocaleString()} {t.currency}/{t.hectareShort}</span>
                    </div>
                  </div>

                  {onSelectAnalysis && (
                    <button
                      onClick={() => onSelectAnalysis(item)}
                      className="w-full py-1.5 rounded-xl bg-[#2F7D4A] hover:bg-[#163D2B] text-white font-bold text-[10px] uppercase tracking-wider transition-colors shadow-xs"
                    >
                      {t.mapAnalysisCard}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Map Controller Buttons (Zoom, Layers, Modes) */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          {/* Map Mode Buttons */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 p-1 flex flex-col gap-1">
            <button
              onClick={() => setMapMode('map')}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                mapMode === 'map' ? "bg-[#163D2B] text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              )}
              title={t.mapModeScheme}
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMapMode('satellite')}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                mapMode === 'satellite' ? "bg-[#163D2B] text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              )}
              title={t.satelliteLayer}
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMapMode('hybrid')}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                mapMode === 'hybrid' ? "bg-[#163D2B] text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              )}
              title={t.hybridLayer}
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Legend Overlay at bottom right */}
        <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/60 text-xs hidden sm:block">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t.mapGisLegend}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span className="text-[11px] text-slate-700">{t.mapHealthyField}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              <span className="text-[11px] text-slate-700">{t.mapStressRisk}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-[11px] text-slate-700">{t.mapDiseaseOutbreakRust}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
