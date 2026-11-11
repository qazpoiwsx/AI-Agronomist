import React, { useState, useEffect } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Polygon, 
  Polyline, 
  CircleMarker, 
  Tooltip,
  useMapEvents, 
  useMap 
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Undo2, RotateCcw, MapPin, Maximize2 } from 'lucide-react';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';

// Geodesic / Planar Projection Area calculation for agricultural parcels in hectares
export function calculatePolygonAreaHectares(points: [number, number][]): number {
  if (!points || points.length < 3) return 0;
  
  const centerLat = points.reduce((sum, pt) => sum + pt[0], 0) / points.length;
  const rad = Math.PI / 180;
  const earthRadius = 6378137; // meters
  
  const cosLat = Math.cos(centerLat * rad);
  const xy = points.map(([lat, lng]) => [
    lng * rad * earthRadius * cosLat,
    lat * rad * earthRadius
  ]);

  // Shoelace formula in square meters
  let areaM2 = 0;
  const n = xy.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    areaM2 += xy[i][0] * xy[j][1];
    areaM2 -= xy[j][0] * xy[i][1];
  }
  areaM2 = Math.abs(areaM2) / 2;

  // Convert m² to hectares (1 ha = 10,000 m²)
  const ha = areaM2 / 10000;
  return Math.round(ha * 10) / 10;
}

export function calculatePolygonCentroid(points: [number, number][]): [number, number] {
  if (!points || points.length === 0) return [0, 0];
  const latSum = points.reduce((sum, p) => sum + p[0], 0);
  const lngSum = points.reduce((sum, p) => sum + p[1], 0);
  return [latSum / points.length, lngSum / points.length];
}

interface MapClickHandlerProps {
  onAddPoint: (point: [number, number]) => void;
  isClosed: boolean;
}

function MapClickHandler({ onAddPoint, isClosed }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!isClosed) {
        onAddPoint([e.latlng.lat, e.latlng.lng]);
      }
    }
  });
  return null;
}

function MapBoundsController({ points, center }: { points: [number, number][]; center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 3) {
      const bounds = L.latLngBounds(points.map(p => [p[0], p[1]]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    } else if (center && center[0] && center[1]) {
      map.setView(center, 13);
    }
  }, []);

  return null;
}

interface FieldMapDrawerProps {
  initialPolygon?: [number, number][];
  defaultCenter?: [number, number];
  onPolygonChange: (points: [number, number][], areaHectares: number, center: [number, number]) => void;
  lang: Language;
}

export const FieldMapDrawer: React.FC<FieldMapDrawerProps> = ({
  initialPolygon = [],
  defaultCenter = [51.1645, 71.4777],
  onPolygonChange,
  lang
}) => {
  const t = translations[lang];
  const [points, setPoints] = useState<[number, number][]>(initialPolygon);
  const [isClosed, setIsClosed] = useState<boolean>(initialPolygon.length >= 3);

  // Auto center on initial polygon or provided farm center
  const initialMapCenter: [number, number] = points.length > 0 
    ? calculatePolygonCentroid(points) 
    : (defaultCenter[0] && defaultCenter[1] ? defaultCenter : [51.1645, 71.4777]);

  const handleAddPoint = (newPoint: [number, number]) => {
    const updated = [...points, newPoint];
    setPoints(updated);
    const area = calculatePolygonAreaHectares(updated);
    const center = calculatePolygonCentroid(updated);
    onPolygonChange(updated, area, center);
  };

  const handleFinishContour = () => {
    if (points.length < 3) return;
    setIsClosed(true);
    const area = calculatePolygonAreaHectares(points);
    const center = calculatePolygonCentroid(points);
    onPolygonChange(points, area, center);
  };

  const handleUndoPoint = () => {
    if (points.length === 0) return;
    const updated = points.slice(0, -1);
    setPoints(updated);
    setIsClosed(false);
    const area = calculatePolygonAreaHectares(updated);
    const center = calculatePolygonCentroid(updated);
    onPolygonChange(updated, area, center);
  };

  const handleResetContour = () => {
    setPoints([]);
    setIsClosed(false);
    onPolygonChange([], 0, [0, 0]);
  };

  const currentArea = calculatePolygonAreaHectares(points);
  const currentCenter = calculatePolygonCentroid(points);

  return (
    <div className="space-y-3">
      {/* Top action toolbar & calculated area display */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFinishContour}
            disabled={points.length < 3 || isClosed}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs",
              points.length >= 3 && !isClosed
                ? "bg-[#2F7D4A] hover:bg-[#163D2B] text-white active:scale-95"
                : "bg-slate-200/80 text-slate-400 cursor-not-allowed"
            )}
            title="Замкнуть полигон"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t.finishContour || "Завершить контур"}</span>
          </button>

          <button
            type="button"
            onClick={handleUndoPoint}
            disabled={points.length === 0}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Отменить последнюю точку"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>{t.undoPoint || "Отменить точку"}</span>
          </button>

          <button
            type="button"
            onClick={handleResetContour}
            disabled={points.length === 0}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Сбросить все точки"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetContour || "Сбросить"}</span>
          </button>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-[#163D2B] font-bold">
            {t.calculatedArea || "Площадь"}: <span className="font-extrabold text-sm">{currentArea} {t.hectareShort}</span>
          </span>
          <span className="text-slate-500 text-[11px] font-semibold">
            ({points.length} {t.fieldsPointsCount})
          </span>
        </div>
      </div>

      {/* Map container */}
      <div className="relative w-full h-[320px] sm:h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
        <MapContainer
          center={initialMapCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapBoundsController points={points} center={initialMapCenter} />
          <MapClickHandler onAddPoint={handleAddPoint} isClosed={isClosed} />

          {/* Render Vertices */}
          {points.map((pt, idx) => (
            <CircleMarker
              key={`vertex-${idx}`}
              center={[pt[0], pt[1]]}
              radius={6}
              pathOptions={{
                color: '#163D2B',
                fillColor: idx === 0 ? '#10B981' : '#ffffff',
                fillOpacity: 1,
                weight: 2
              }}
            >
              <Tooltip direction="top" offset={[0, -5]} opacity={0.9} permanent={false}>
                <span>{lang === 'kz' ? 'Нүкте' : lang === 'en' ? 'Point' : 'Точка'} {idx + 1}</span>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Render boundary line while drawing */}
          {points.length >= 2 && !isClosed && (
            <Polyline
              positions={points}
              pathOptions={{
                color: '#2F7D4A',
                weight: 3,
                dashArray: '6, 6'
              }}
            />
          )}

          {/* Render closed polygon */}
          {(isClosed || points.length >= 3) && (
            <Polygon
              positions={points}
              pathOptions={{
                color: '#163D2B',
                fillColor: '#2F7D4A',
                fillOpacity: isClosed ? 0.35 : 0.15,
                weight: 3
              }}
            />
          )}
        </MapContainer>

        {/* Floating guidance overlay */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-[1000] pointer-events-none">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-medium shadow-md flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {isClosed 
                ? (lang === 'ru' ? 'Контур завершен. Для изменения используйте «Отменить» или «Сбросить».' : lang === 'kz' ? 'Контур аяқталды. Өзгерту үшін «Нүктені қайтару» немесе «Контурды тазарту» қолданыңыз.' : 'Boundary completed. Use Undo or Reset to change.')
                : (t.clickMapInstructions || "Кликайте по карте для создания вершин границы участка (минимум 3 точки).")}
            </span>
          </div>
        </div>
      </div>

      {currentCenter[0] !== 0 && (
        <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
          <span>
            {lang === 'ru' ? 'Координаты центра' : lang === 'kz' ? 'Орталық координаттары' : 'Centroid'}: {currentCenter[0].toFixed(5)}°N, {currentCenter[1].toFixed(5)}°E
          </span>
          {isClosed && (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <Check className="w-3 h-3" />
              {lang === 'ru' ? 'Контур замкнут' : lang === 'kz' ? 'Контур тұйықталды' : 'Boundary closed'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
