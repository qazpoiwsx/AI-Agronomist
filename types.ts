export type PlantCulture = 'wheat' | 'barley' | 'corn' | 'sunflower' | 'potato' | 'tomato' | 'apple' | 'grape' | 'cotton' | 'other';
export type SeverityLevel = 'low' | 'medium' | 'high';
export type UserRole = 'FARMER' | 'AGRONOMIST' | 'ADMIN';

export type Currency = 'KZT' | 'RUB' | 'USD';
export type UnitSystem = 'metric' | 'imperial';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'Basic' | 'Enterprise Ag' | 'Research';
  memberCount: number;
}

export interface Field {
  id: string;
  organizationId: string;
  name: string;
  crop: PlantCulture;
  variety: string;
  areaHectares: number;
  polygon: [number, number][];
  center: [number, number];
  plantingDate: string;
  expectedHarvestDate: string;
  soilType: string;
  irrigationType: 'drip' | 'sprinkler' | 'flood' | 'rainfed';
  currentHealth: 'healthy' | 'warning' | 'critical' | 'pending';
  notes?: string;
  createdAt: number;
}

export interface DroneMission {
  id: string;
  fieldId: string;
  fieldName: string;
  name: string;
  plannedDate: string;
  altitudeMeters: number;
  imageOverlapPercent: number;
  speedMps: number;
  status: 'CREATED' | 'READY' | 'IN_PROGRESS' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  imagesCount: number;
  processedCount: number;
  notes?: string;
  createdAt: number;
}

export interface AgronomistReview {
  id: string;
  analysisId: string;
  fieldId?: string;
  reviewerId: string;
  reviewerName: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'modified';
  revisedDiagnosis?: string;
  comments: string;
  recommendations: string;
  reviewedAt: number;
}

export interface Recommendation {
  id: string;
  fieldId: string;
  fieldName: string;
  analysisId?: string;
  title: string;
  description: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  suggestedAction: string;
  expectedBenefit: string;
  status: 'NEW' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  createdAt: number;
}

export interface AgroNotification {
  id: string;
  title: string;
  message: string;
  type: 'disease' | 'weather' | 'mission' | 'recommendation' | 'review' | 'system';
  severity: 'critical' | 'warning' | 'info';
  relatedId?: string;
  relatedType?: 'field' | 'analysis' | 'mission';
  read: boolean;
  createdAt: number;
}

export interface ConfigStatus {
  geminiStatus: 'CONFIGURED' | 'MISSING' | 'ERROR' | 'UNAVAILABLE' | string;
  weatherStatus: 'CONFIGURED' | 'MISSING' | 'ERROR' | 'UNAVAILABLE' | string;
  weatherSource?: string;
  mlInferenceStatus: 'CONFIGURED' | 'MISSING' | 'ERROR' | 'UNAVAILABLE' | string;
  storageStatus: 'CONFIGURED' | 'MISSING' | 'ERROR' | 'UNAVAILABLE' | string;
  databaseStatus: 'CONFIGURED' | 'MISSING' | 'ERROR' | 'UNAVAILABLE' | string;
}

export interface WeatherAgroRisk {
  fungalRisk: 'low' | 'moderate' | 'high';
  droughtRisk: 'low' | 'moderate' | 'high';
  frostRisk: 'low' | 'moderate' | 'high';
  windRisk: 'low' | 'moderate' | 'high';
  heatStress: 'low' | 'moderate' | 'high';
  summary: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: number;
  isPlantRelated?: boolean;
  culture: PlantCulture;
  customCultureName?: string;
  fieldId?: string;
  fieldName?: string;
  ageDays: number;
  diagnosis: string;
  confidence: number;
  issueType: 'disease' | 'pest' | 'water' | 'nutrient' | 'pesticide' | 'healthy';
  severity: SeverityLevel;
  currency: Currency;
  unitSystem: UnitSystem;
  economicImpact: {
    potentialLossPercentage: number;
    estimatedLossPerArea: number; // Per hectare or per acre
    estimatedLossWeight: number; // Tons or Bushels
  };
  recommendations: {
    action: string;
    costEffectiveness: 'high' | 'medium' | 'low';
    estimatedCost: number;
  }[];
  localizedAdvice: string;
  weatherContext?: {
    temp: number;
    humidity: number;
    conditionCode: number;
    forecast: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
  modelName?: string;
  modelVersion?: string;
  review?: AgronomistReview;
  agronomistReview?: AgronomistReview;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  fieldId?: string;
}

export interface Drone {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'charging' | 'offline' | 'returning' | 'landing';
  battery: number;
  altitude: number;
  speed: number;
  connectivity: number;
  scannedArea: number;
  lat: number;
  lng: number;
  homeLat: number;
  homeLng: number;
  bearing: number;
  gpsAccuracy: number;
  path: [number, number][];
  waypoints: [number, number][];
  targetWaypointIndex?: number;
  ownerId: string;
}

export const CULTURES: { id: PlantCulture; name: string; icon: string }[] = [
  { id: 'wheat', name: 'Пшеница', icon: '🌾' },
  { id: 'barley', name: 'Ячмень', icon: '🌾' },
  { id: 'corn', name: 'Кукуруза', icon: '🌽' },
  { id: 'sunflower', name: 'Подсолнечник', icon: '🌻' },
  { id: 'potato', name: 'Картофель', icon: '🥔' },
  { id: 'tomato', name: 'Томат', icon: '🍅' },
  { id: 'apple', name: 'Яблоня', icon: '🍎' },
  { id: 'grape', name: 'Виноград', icon: '🍇' },
  { id: 'cotton', name: 'Хлопок', icon: '☁️' },
  { id: 'other', name: 'Другое', icon: '🌱' },
];
