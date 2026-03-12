import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, PlantCulture, ChatMessage, Currency, UnitSystem } from "../types";
import { WeatherData } from "./weatherService";

const MODEL_NAME = "gemini-3-flash-preview";

export async function analyzePlantImage(
  base64Image: string, 
  culture: PlantCulture, 
  ageDays: number,
  location?: { lat: number; lng: number },
  customCultureName?: string,
  weather?: WeatherData,
  lang: string = 'ru',
  currency: Currency = 'KZT',
  unitSystem: UnitSystem = 'metric'
): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const plantName = culture === 'other' && customCultureName ? customCultureName : culture;
  const areaUnit = unitSystem === 'metric' ? '1 hectare' : '1 acre';
  const weightUnit = unitSystem === 'metric' ? 'tons' : 'bushels';

  const prompt = `
    You are a world-class expert agronomist specializing in agriculture in Kazakhstan and the CIS.
    Analyze this plant image.
    
    Context:
    - Culture: ${plantName}
    - Plant age: ${ageDays} days
    - Coordinates: ${location ? `${location.lat}, ${location.lng}` : 'unknown'}
    - Requested Currency: ${currency}
    - Requested Unit System: ${unitSystem} (${areaUnit}, ${weightUnit})
    
    Current weather conditions (if available):
    ${weather ? `
    - Temperature: ${weather.temp}°C
    - Humidity: ${weather.humidity}%
    - Precipitation: ${weather.precipitation} mm
    - Wind speed: ${weather.windSpeed} km/h
    - Condition: ${weather.condition}
    ` : 'unknown'}
    
    Tasks:
    0. FIRST: Check if the image is related to plants, agriculture, nature, or pests. If it's a photo of a person, a car, an interior, or anything unrelated to plants/nature, set "isPlantRelated" to false.
    1. Identify the problem: 
       - Disease (fungal, bacterial, viral).
       - Pest (insect, mite, slug, etc.). Specify the exact species if possible.
       - Stress (water deficiency/excess, nutrient deficiency, chemical burn).
    2. If the plant is healthy, specify "healthy".
    3. Assess the severity: low, medium, high.
    4. Calculate economic damage:
       - Yield loss (%).
       - Loss in ${currency} per ${areaUnit}.
       - Loss in ${weightUnit} per ${areaUnit}.
    5. Provide 3 action options:
       - Cheapest (prevention/folk remedies/basic drug).
       - Most effective (modern insecticide/fungicide/fertilizer).
       - Agrotechnical (removal of affected parts, changing watering regime, etc.).
    6. ADJUST RECOMMENDATIONS BASED ON WEATHER: 
       - e.g., if high humidity, warn about fungal risk. 
       - If strong wind, advise delaying spraying.
       - If heat, adjust watering.
    7. Provide local advice for Kazakhstan.
    
    IMPORTANT: Provide all text fields (diagnosis, localizedAdvice, action) in the language: ${lang === 'ru' ? 'Russian' : lang === 'kz' ? 'Kazakh' : 'English'}.
    
    Return the response STRICTLY in JSON format:
    {
      "isPlantRelated": true | false,
      "diagnosis": "Name in ${lang}",
      "confidence": 0.95,
      "issueType": "one of: disease, pest, water, nutrient, pesticide, healthy",
      "severity": "low | medium | high",
      "economicImpact": {
        "potentialLossPercentage": 25,
        "estimatedLossPerArea": 37500,
        "estimatedLossWeight": 0.375
      },
      "recommendations": [
        { "action": "Description in ${lang}", "costEffectiveness": "high | medium | low", "estimatedCost": 5000 }
      ],
      "localizedAdvice": "Markdown text in ${lang}",
      "weatherContext": {
        "temp": ${weather?.temp || 22},
        "humidity": ${weather?.humidity || 45},
        "conditionCode": ${weather?.conditionCode || 0},
        "forecast": "${weather?.condition || '3-day forecast'}"
      }
    }
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(",")[1],
          },
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const result = JSON.parse(response.text || "{}");
    return {
      ...result,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      culture,
      ageDays,
      location,
      currency,
      unitSystem
    } as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse AI response", e);
    throw new Error("Ошибка при анализе изображения");
  }
}

export async function chatWithAssistant(
  messages: ChatMessage[], 
  context?: AnalysisResult, 
  lang: string = 'ru',
  currency: Currency = 'KZT',
  unitSystem: UnitSystem = 'metric'
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const areaUnit = unitSystem === 'metric' ? 'hectare' : 'acre';
  const weightUnit = unitSystem === 'metric' ? 'tons' : 'bushels';

  const systemInstruction = `
    You are an AI agronomist assistant in Kazakhstan. Your goal is to help farmers manage their plots.
    You know everything about wheat, barley, corn, and sunflower in the conditions of the Republic of Kazakhstan.
    
    ${context ? `Current analysis context:
    - Diagnosis: ${context.diagnosis}
    - Severity: ${context.severity}
    - Culture: ${context.culture}
    - Location: ${context.location ? `${context.location.lat}, ${context.location.lng}` : 'not specified'}
    - Currency: ${context.currency}
    - Unit System: ${context.unitSystem}
    ` : ''}
    
    Respond professionally but accessibly. Use Markdown.
    When discussing costs or losses, use ${currency} and ${areaUnit}/${weightUnit}.
    IMPORTANT: Respond in the language: ${lang === 'ru' ? 'Russian' : lang === 'kz' ? 'Kazakh' : 'English'}.
  `;

  const chat = ai.chats.create({
    model: MODEL_NAME,
    config: {
      systemInstruction,
    },
  });

  const lastMessage = messages[messages.length - 1].text;
  const response = await chat.sendMessage({ message: lastMessage });
  
  return response.text || "Извините, я не смог обработать ваш запрос.";
}
