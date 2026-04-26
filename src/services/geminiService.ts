import { AnalysisResult, PlantCulture, ChatMessage, Currency, UnitSystem } from "../types";
import { WeatherData } from "./weatherService";

async function sendPushAfterAnalysis(result: AnalysisResult, lang: string) {
  try {
    const notificationBody = `${lang === 'ru' ? 'Диагноз' : lang === 'kz' ? 'Диагноз' : 'Diagnosis'}: ${result.diagnosis}. ${lang === 'ru' ? 'Потери' : lang === 'kz' ? 'Шығындар' : 'Losses'}: ${result.economicImpact?.potentialLossPercentage}%`;
    
    // Get stored subscription from localStorage
    const subStr = localStorage.getItem('push_subscription');
    if (!subStr) return;
    
    const subscription = JSON.parse(subStr);
    
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        title: lang === 'ru' ? 'Анализ готов!' : lang === 'kz' ? 'Талдау дайын!' : 'Analysis Ready!',
        message: notificationBody
      })
    });
  } catch (err) {
    console.error("Failed to trigger push notification:", err);
  }
}

export async function analyzePlantImage(
  base64Image: string,
  culture: PlantCulture,
  ageDays: number,
  location: { lat: number, lng: number } | null,
  customCultureName: string | null = null,
  weather: WeatherData | null = null,
  lang: string = 'ru',
  currency: Currency = 'KZT',
  unitSystem: UnitSystem = 'metric'
): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image,
      culture,
      ageDays,
      location,
      customCultureName,
      weather,
      lang,
      currency,
      unitSystem
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || 'Analysis failed server-side');
  }

  const result = await response.json();
  const analysisId = Math.random().toString(36).substr(2, 9);

  const analysisResponse: AnalysisResult = {
    ...result,
    id: analysisId,
    timestamp: Date.now(),
    imageUrl: base64Image,
    culture: culture === 'other' && customCultureName ? customCultureName : culture,
    weatherContext: weather ? {
      temp: weather.temp,
      humidity: weather.humidity,
      forecast: weather.condition
    } : undefined
  };

  // Trigger notification if it's not a "healthy" result or just for all results
  if (analysisResponse.isPlantRelated) {
    sendPushAfterAnalysis(analysisResponse, lang);
  }

  // Save to history in background
  try {
    fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...analysisResponse,
        userId: 'default-user' // In real app, get from auth
      })
    });
  } catch (err) {
    console.error("Failed to save to history:", err);
  }

  return analysisResponse;
}

export async function getAgronomistChatResponse(
  messages: ChatMessage[],
  context?: Partial<AnalysisResult>,
  lang: string = 'ru',
  currency: Currency = 'KZT',
  unitSystem: UnitSystem = 'metric'
): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      context,
      lang,
      currency,
      unitSystem
    })
  });

  if (!response.ok) {
    throw new Error('Chat failed server-side');
  }

  const data = await response.json();
  return data.text || (lang === 'ru' ? "Извините, я не смог обработать ваш запрос." : "Sorry, I couldn't process your request.");
}

// Keep chatWithAssistant for compatibility if needed elsewhere
export const chatWithAssistant = getAgronomistChatResponse;
