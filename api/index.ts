import express from "express";
import { GoogleGenAI } from "@google/genai";
import webpush from "web-push";

const app = express();
app.use(express.json({ limit: '50mb' }));

// ========== ЗАГЛУШКИ ДЛЯ ИСТОРИИ ==========
app.post("/api/history", (req, res) => {
  res.json({ success: true });
});

// ========== PUSH-УВЕДОМЛЕНИЯ ==========
app.post("/api/subscribe", (req, res) => {
  console.log("Subscription received");
  res.status(201).json({ success: true });
});

app.post("/api/send-notification", async (req, res) => {
  const { subscription, title, message } = req.body;
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }

  webpush.setVapidDetails(
    "mailto:support@ai-agronomist.com",
    publicKey,
    privateKey
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, message }));
    res.json({ success: true });
  } catch (err) {
    console.error("Push error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// ========== АНАЛИЗ ЧЕРЕЗ GEMINI ==========
app.post("/api/analyze", async (req, res) => {
  try {
    const { image, culture, ageDays, location, customCultureName, lang, currency, unitSystem } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel environment" });
    }

    // Правильная инициализация
    const genAI = new GoogleGenAI({ apiKey });

    const plantName = culture === 'other' && customCultureName ? customCultureName : culture;
    const areaUnit = unitSystem === 'metric' ? '1 hectare' : '1 acre';
    const weightUnit = unitSystem === 'metric' ? 'tons' : 'bushels';

    const prompt = `
      You are an expert agronomist. Analyze this plant image.
      Culture: ${plantName}, age: ${ageDays} days.
      Currency: ${currency}, unit system: ${unitSystem}.
      Return ONLY valid JSON (no markdown, no extra text):
      {
        "isPlantRelated": true,
        "diagnosis": "diagnosis name in ${lang}",
        "confidence": 0.95,
        "issueType": "disease",
        "severity": "medium",
        "economicImpact": {
          "potentialLossPercentage": 25,
          "estimatedLossPerArea": 37500,
          "estimatedLossWeight": 0.375
        },
        "recommendations": [
          { "action": "Action description", "costEffectiveness": "high", "estimatedCost": 5000 }
        ],
        "localizedAdvice": "Advice text in ${lang}"
      }
    `;

    const imageBase64 = image.split(",")[1];

    // Правильный вызов API
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
          ]
        }
      ]
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || result.text;
    if (!text) throw new Error("Empty response from Gemini");

    // Очистка от markdown-обёрток
    let jsonString = text;
    if (text.includes("```json")) {
      jsonString = text.split("```json")[1].split("```")[0];
    } else if (text.includes("```")) {
      jsonString = text.split("```")[1].split("```")[0];
    }
    const analysisData = JSON.parse(jsonString.trim());
    res.json(analysisData);
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========== ЧАТ-АССИСТЕНТ ==========
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "No API key" });

    const genAI = new GoogleGenAI({ apiKey });
    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }))
    });
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || result.text;
    res.json({ text: reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

export default app;
