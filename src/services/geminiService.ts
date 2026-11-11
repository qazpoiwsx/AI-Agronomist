import { AnalysisResult, PlantCulture, ChatMessage, Currency, UnitSystem } from "../types";
import { WeatherData } from "./weatherService";

async function sendPushAfterAnalysis(result: AnalysisResult, lang: string) {
  try {
    const notificationBody = `${lang === 'ru' ? 'Диагноз' : lang === 'kz' ? 'Диагноз' : 'Diagnosis'}: ${result.diagnosis}. ${lang === 'ru' ? 'Потери' : lang === 'kz' ? 'Шығындар' : 'Losses'}: ${result.economicImpact?.potentialLossPercentage}%`;
    
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: lang === 'ru' ? 'Анализ готов!' : lang === 'kz' ? 'Талдау дайын!' : 'Analysis Ready!',
        body: notificationBody,
        url: '/'
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
  try {
    const plantName = culture === "other" && customCultureName ? customCultureName : culture;
    const areaUnit = unitSystem === "metric" ? "1 hectare" : "1 acre";
    const weightUnit = unitSystem === "metric" ? "tons" : "bushels";

    const prompt = `
      You are a world-class expert agronomist specializing in agriculture in Kazakhstan and the CIS.
      Analyze this plant image and provide a detailed agronomical assessment for a farmer.
      
      Context:
      - Culture: ${plantName}
      - Plant age: ${ageDays} days
      - Coordinates: ${location ? `${location.lat}, ${location.lng}` : "unknown"}
      - Requested Currency: ${currency}
      - Requested Unit System: ${unitSystem} (${areaUnit}, ${weightUnit})
      
      Requirements for "localizedAdvice":
      If the plant is healthy, set "localizedAdvice" to:
      - RU: "Растение здорово"
      - KZ: "Өсімдік сау"
      - EN: "The plant is healthy"
      
      If there are issues, set "localizedAdvice" as a markdown string following exactly these points in the target language (${lang}):
      1. Культура: (name or "not visible")
      2. Наличие болезни или вредителей: (yes/no and name)
      3. Симптомы: (description)
      4. Лечение: (2-3 tips)
      5. Профилактика: (advice)
 

      Language: ${lang === "ru" ? "Russian" : lang === "kz" ? "Kazakh" : "English"}.
    `;

    if (!base64Image) {
      throw new Error("No image data provided");
    }

    const imageData = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          base64Image, 
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
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Server error during analysis');
    }

    const result = await response.json();

    if (!result) {
      throw new Error("Empty response from AI");
    }

    const analysisId = Math.random().toString(36).substr(2, 9);
    const analysisResponse: AnalysisResult = {
      ...result,
      id: analysisId,
      timestamp: Date.now(),
      imageUrl: base64Image,
      culture: culture === 'other' && customCultureName ? customCultureName : culture,
      weatherContext: (weather && weather.temp !== undefined) ? {
        temp: weather.temp,
        humidity: weather.humidity ?? 0,
        conditionCode: weather.conditionCode,
        forecast: weather.condition
      } : undefined
    };

    if (analysisResponse.isPlantRelated) {
      sendPushAfterAnalysis(analysisResponse, lang);
    }

    // Save to history on backend
    try {
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...analysisResponse,
          userId: 'default-user'
        })
      });
    } catch (err) {
      console.error("Failed to save to history:", err);
    }

    return analysisResponse;
  } catch (err: any) {
    console.error("Analysis error:", err);
    throw err;
  }
}

export async function getAgronomistChatResponse(
  messages: ChatMessage[],
  context?: Partial<AnalysisResult>,
  lang: string = 'ru',
  currency: Currency = 'KZT',
  unitSystem: UnitSystem = 'metric'
): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, lang, context })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error during chat');
    }

    const { text } = await response.json();
    return text || (lang === 'ru' ? "Извините, я не смог обработать ваш запрос." : "Sorry, I couldn't process your request.");
  } catch (err) {
    console.error("Chat error:", err);
    return (lang === 'ru' ? "Извините, произошла ошибка AI." : "Sorry, an AI error occurred.");
  }
}

export const chatWithAssistant = getAgronomistChatResponse;
