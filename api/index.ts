import express from "express";
import webpush from "web-push";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");

const app = express();
app.use(express.json({ limit: "50mb" }));

// Serving static files from dist
app.use(express.static(distPath));

// Database mock/in-memory for Vercel (real apps should use external DB)
// For history, we'll just return success for now or suggest using Firebase/Supabase
app.post("/api/history", (req, res) => {
  res.json({ success: true });
});

// Notifications
app.get("/api/weather", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat/lng" });
  }

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`
    );
    if (!response.ok) {
      throw new Error(`Weather API responded with ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Weather proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/subscribe", (req, res) => {
  res.status(201).json({});
});

app.post("/api/send-notification", async (req, res) => {
  const { subscription, title, message } = req.body;
  const vapidKeys = {
    publicKey: process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '',
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

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

export default app;
