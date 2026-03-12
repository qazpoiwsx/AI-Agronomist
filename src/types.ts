export type PlantCulture = 'wheat' | 'barley' | 'corn' | 'sunflower' | 'potato' | 'tomato' | 'apple' | 'grape' | 'cotton' | 'other';
export type SeverityLevel = 'low' | 'medium' | 'high';

export type Currency = 'KZT' | 'RUB' | 'USD';
export type UnitSystem = 'metric' | 'imperial';

export interface AnalysisResult {
  id: string;
  timestamp: number;
  isPlantRelated?: boolean;
  culture: PlantCulture;
  customCultureName?: string;
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
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
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
