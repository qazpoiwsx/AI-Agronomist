import express from "express";
import { GoogleGenAI } from "@google/genai";
import webpush from "web-push";

const app = express();
app.use(express.json({ limit: '50mb' }));

// Database mock/in-memory for Vercel (real apps should use external DB)
// For history, we'll just return success for now or suggest using Firebase/Supabase
app.post("/api/history", (req, res) => {
  res.json({ success: true });
});

// Notifications
app.post("/api/subscribe", (req, res) => {
  res.status(201).json({});
});

app.post("/api/send-notification", async (req, res) => {
  const { subscription, title, message } = req.body;
  const vapidKeys = {
    publicKey: process.env.VITE_VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || ''
  };

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    return res.status(500).json({ error: "VAPID keys not configured" });
  }

  webpush.setVapidDetails(
    "mailto:example@yourdomain.com",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, message }));
    res.json({ success: true });
  } catch (err) {
    console.error("Push error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Gemini Analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { image, culture, ageDays, location, customCultureName, weather, lang, currency, unitSystem } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set in environment." });
    }

    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const plantName = culture === 'other' && customCultureName ? customCultureName : culture;
    const areaUnit = unitSystem === 'metric' ? '1 hectare' : '1 acre';
    const weightUnit = unitSystem === 'metric' ? 'tons' : 'bushels';

    const prompt = `
      You are a world-class expert agronomist specializing in agriculture in Kazakhstan and the CIS.
      Analyze this plant image.
      
      Context:
      - Culture: ${plantName}
      - Plant age: ${ageDays} days
      - Coordinates: ${location ? \`\${location.lat}, \${location.lng}\` : 'unknown'}
      - Requested Currency: ${currency}
      - Requested Unit System: ${unitSystem} (\${areaUnit}, \${weightUnit})
      
      Tasks:
      0. FIRST: Check if the image is related to plants, agriculture, nature, or pests. If it's a photo of a person, a car, an interior, or anything unrelated to plants/nature, set "isPlantRelated" to false.
      1. Identify the problem (Disease, Pest, Stress) or if "healthy".
      2. Severity: low, medium, high.
      3. Economic damage: Yield loss (%), Loss in \${currency} and \${weightUnit} per \${areaUnit}.
      4. 3 actions: Cheapest, Most effective, Agrotechnical.
      
      Return JSON:
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
      
      Respond in language: \${lang === 'ru' ? 'Russian' : lang === 'kz' ? 'Kazakh' : 'English'}.
    `;

    const imageParts = [{
      inlineData: {
        mimeType: "image/jpeg",
        data: image.split(",")[1],
      },
    }];

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }]
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || result.response.text();
    const jsonContent = text.includes('```json') ? text.split('```json')[1].split('```')[0] : text;
    res.json(JSON.parse(jsonContent));
  } catch (err: any) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Gemini Chat
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, context, lang, currency, unitSystem } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not set." });
    }

    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const systemInstruction = `
      You are an AI agronomist assistant in Kazakhstan. Respond in \${lang === 'ru' ? 'Russian' : lang === 'kz' ? 'Kazakh' : 'English'}.
      Context: \${JSON.stringify(context)}
    `;

    const result = await model.generateContent({
      contents: messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      systemInstruction: systemInstruction
    });

    const chatText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || result.response.text();
    res.json({ text: chatText });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

export default app;
