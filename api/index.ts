import express from "express";
import { GoogleGenAI } from "@google/genai";
import webpush from "web-push";

const app = express();
app.use(express.json({ limit: '50mb' }));

// VAPID ключи
const VAPID_PUBLIC = "BGGTC8DIR-VIHMOlfcHWDqNH8tOLolMlsfDMOJOiFH_vCkOSF-x-vYLExZXcK0wWIYunOjYy0bUCU6975m-AGGk";
const VAPID_PRIVATE = "wmymEhZTTB3ksxNgCUwlb3kKEzYP3ROlzO4E8Ru-Njk";
const GEMINI_KEY = "AQ.Ab8RN6L7Gnu8aIYLXsUZlXYJ9ng2_FraAlN0HFJ5g8EZLk_f_g";

// Настройка Push-уведомлений
webpush.setVapidDetails(
  "mailto:example@yourdomain.com",
  VAPID_PUBLIC,
  VAPID_PRIVATE
);

app.post("/api/history", (req, res) => {
  res.json({ success: true });
});

app.post("/api/subscribe", (req, res) => {
  res.status(201).json({});
});

app.post("/api/send-notification", async (req, res) => {
  const { subscription, title, message } = req.body;
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, message }));
    res.json({ success: true });
  } catch (err) {
    console.error("Push error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Анализ изображения растения
app.post("/api/analyze", async (req, res) => {
  try {
    const { image, culture, ageDays, location, customCultureName, lang, currency, unitSystem } = req.body;
    
    const genAI = new GoogleGenAI(GEMINI_KEY);
    // Используем стабильную модель flash
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const plantName = culture === 'other' && customCultureName ? customCultureName : culture;
    const areaUnit = unitSystem === 'metric' ? '1 hectare' : '1 acre';
    const weightUnit = unitSystem === 'metric' ? 'tons' : 'bushels';

    const prompt = `
      You are a world-class expert agronomist. Analyze this plant image.
      Context:
      - Culture: ${plantName}
      - Plant age: ${ageDays} days
      - Coordinates: ${location ? `${location.lat}, ${location.lng}` : 'unknown'}
      - Requested Currency: ${currency}
      - Requested Unit System: ${unitSystem} (${areaUnit}, ${weightUnit})
      
      Tasks:
      0. FIRST: Check if image is plant/nature related. If not, set isPlantRelated to false.
      1. Identify problem (Disease, Pest, Stress) or "healthy".
      2. Severity: low, medium, high.
      3. Economic damage: Yield loss (%), Loss in ${currency} per ${areaUnit}.
      
      Return ONLY JSON:
      {
        "isPlantRelated": boolean,
        "diagnosis": string,
        "confidence": number,
        "issueType": string,
        "severity": string,
        "economicImpact": { "potentialLossPercentage": number, "estimatedLossPerArea": number, "estimatedLossWeight": number },
        "recommendations": [{ "action": string, "costEffectiveness": string, "estimatedCost": number }],
        "localizedAdvice": string
      }
      Respond in: ${lang === 'ru' ? 'Russian' : lang === 'kz' ? 'Kazakh' : 'English'}.
    `;

    const imageParts = [{
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(",")[1],
      },
    }];

    // Правильный вызов generateContent для актуальной библиотеки
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
    const jsonContent = text.includes('```json') 
      ? text.split('
