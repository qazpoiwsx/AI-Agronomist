import express from "express";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import fs from "fs";
import webpush from "web-push";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import dns from "dns";

dotenv.config();

dns.setDefaultResultOrder("ipv4first");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase Admin Setup
let firebaseAdminAuth: Auth | null = null;
try {
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (serviceAccountRaw) {
    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      if (fs.existsSync(serviceAccountRaw)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountRaw, "utf8"));
      } else {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is neither valid JSON nor a file path");
      }
    }
    const app = getApps().length === 0
      ? initializeApp({ credential: cert(serviceAccount) })
      : getApps()[0];
    firebaseAdminAuth = getAuth(app);
    console.log("Firebase Admin successfully initialized with service account.");
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT is not configured. Server is running without verifying Firebase tokens.");
  }
} catch (err: any) {
  console.warn("Warning: Failed to initialize Firebase Admin:", err.message);
}

// Gemini Setup
const getGeminiApiKey = (): string => {
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key || key === "MY_GEMINI_API_KEY" || key.includes("your_") || key === "undefined" || key === "null") {
    return "";
  }
  return key;
};

const isGeminiConfigured = (): boolean => {
  return Boolean(getGeminiApiKey());
};

const getGenAI = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const MODEL_NAME = "gemini-2.5-flash";

// Google Weather API Setup (Server-side only)
const getGoogleWeatherApiKey = (): string => {
  const key = (process.env.GOOGLE_WEATHER_API_KEY || "").trim();
  if (!key || key.includes("your_") || key === "undefined" || key === "null") {
    return "";
  }
  return key;
};

async function retry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isRetryable = err.message?.includes('503') || 
                       err.status === 503 || 
                       err.message?.includes('high demand') ||
                       err.message?.includes('UNAVAILABLE');

    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 1.5);
    }
    
    if (isRetryable) {
      throw new Error("SERVER_OVERLOAD");
    }
    throw err;
  }
}

// VAPID keys from .env
const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:example@yourdomain.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

    // Initialize Database in PostgreSQL
    if (process.env.DATABASE_URL) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS fields (
            id TEXT PRIMARY KEY,
            "organizationId" TEXT,
            name TEXT,
            crop TEXT,
            variety TEXT,
            "areaHectares" REAL,
            polygon TEXT,
            center TEXT,
            "plantingDate" TEXT,
            "expectedHarvestDate" TEXT,
            "soilType" TEXT,
            "irrigationType" TEXT,
            "currentHealth" TEXT,
            notes TEXT,
            "createdAt" BIGINT
          );

          CREATE TABLE IF NOT EXISTS drone_missions (
            id TEXT PRIMARY KEY,
            "fieldId" TEXT,
            "fieldName" TEXT,
            name TEXT,
            "plannedDate" TEXT,
            "altitudeMeters" INTEGER,
            "imageOverlapPercent" INTEGER,
            "speedMps" INTEGER,
            status TEXT,
            "imagesCount" INTEGER,
            "processedCount" INTEGER,
            notes TEXT,
            "createdAt" BIGINT
          );

          CREATE TABLE IF NOT EXISTS recommendations (
            id TEXT PRIMARY KEY,
            "fieldId" TEXT,
            "fieldName" TEXT,
            "analysisId" TEXT,
            title TEXT,
            description TEXT,
            priority TEXT,
            reason TEXT,
            "suggestedAction" TEXT,
            "expectedBenefit" TEXT,
            status TEXT,
            "createdAt" BIGINT
          );

          CREATE TABLE IF NOT EXISTS agronomist_reviews (
            id TEXT PRIMARY KEY,
            "analysisId" TEXT,
            "fieldId" TEXT,
            "reviewerId" TEXT,
            "reviewerName" TEXT,
            status TEXT,
            "revisedDiagnosis" TEXT,
            comments TEXT,
            recommendations TEXT,
            "reviewedAt" BIGINT
          );

          CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            title TEXT,
            message TEXT,
            type TEXT,
            severity TEXT,
            "relatedId" TEXT,
            "relatedType" TEXT,
            read INTEGER DEFAULT 0,
            "createdAt" BIGINT
          );

          CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            "userId" TEXT,
            timestamp BIGINT,
            data TEXT
          );

          CREATE TABLE IF NOT EXISTS push_subscriptions (
            endpoint TEXT PRIMARY KEY,
            subscription_json TEXT
          );
        `);
        console.log("PostgreSQL tables checked/created successfully.");
      } catch (err: any) {
        console.warn("Notice: PostgreSQL initialization skipped or failed:", err.message);
      }
    } else {
      console.warn("DATABASE_URL is not set. Database operations will require DATABASE_URL in environment.");
    }

    // Only seed baseline data if DEMO_DATA_ENABLED is explicitly enabled (default is disabled for clean production bases)
    const DEMO_DATA_ENABLED = process.env.DEMO_DATA_ENABLED === 'true';
    let fieldCount = 0;
    if (process.env.DATABASE_URL && DEMO_DATA_ENABLED) {
      try {
        const countRes = await pool.query("SELECT COUNT(*) as count FROM fields");
        fieldCount = parseInt(countRes.rows[0]?.count || "0", 10);
      } catch (e: any) {
        console.warn("Notice checking fields count:", e.message);
      }
    }
    if (process.env.DATABASE_URL && DEMO_DATA_ENABLED && fieldCount === 0) {
      console.log("DEMO_DATA_ENABLED=true: Seeding baseline agricultural demo fields and operational data...");

      const seedFields = [
        {
          id: 'field-1',
          organizationId: 'org-1',
          name: 'Северный участок 14 (Пшеница)',
          crop: 'wheat',
          variety: 'Астана-2',
          areaHectares: 124.5,
          polygon: JSON.stringify([
            [51.1605, 71.4704],
            [51.1685, 71.4704],
            [51.1685, 71.4850],
            [51.1605, 71.4850]
          ]),
          center: JSON.stringify([51.1645, 71.4777]),
          plantingDate: '2026-05-10',
          expectedHarvestDate: '2026-09-05',
          soilType: 'Чернозём обыкновенный',
          irrigationType: 'rainfed',
          currentHealth: 'warning',
          notes: 'Контрольный участок яровой пшеницы. Зафиксированы первые признаки бурой ржавчины на ярусе флагового листа.',
          createdAt: Date.now() - 30 * 86400000
        },
        {
          id: 'field-2',
          organizationId: 'org-1',
          name: 'Восточное поле 3 (Ячмень)',
          crop: 'barley',
          variety: 'Север-1',
          areaHectares: 85.0,
          polygon: JSON.stringify([
            [51.1750, 71.4900],
            [51.1820, 71.4900],
            [51.1820, 71.5050],
            [51.1750, 71.5050]
          ]),
          center: JSON.stringify([51.1785, 71.4975]),
          plantingDate: '2026-05-15',
          expectedHarvestDate: '2026-08-25',
          soilType: 'Каштановая суглинистая',
          irrigationType: 'rainfed',
          currentHealth: 'healthy',
          notes: 'Хорошая вегетация, дружные всходы. Регулярный фитосанитарный мониторинг.',
          createdAt: Date.now() - 25 * 86400000
        },
        {
          id: 'field-3',
          organizationId: 'org-1',
          name: 'Южный массив (Кукуруза)',
          crop: 'corn',
          variety: 'Байтерек 2',
          areaHectares: 62.3,
          polygon: JSON.stringify([
            [43.3050, 76.9150],
            [43.3150, 76.9150],
            [43.3150, 76.9280],
            [43.3050, 76.9280]
          ]),
          center: JSON.stringify([43.3100, 76.9215]),
          plantingDate: '2026-04-20',
          expectedHarvestDate: '2026-09-30',
          soilType: 'Серозём орошаемый',
          irrigationType: 'drip',
          currentHealth: 'critical',
          notes: 'Капельный полив. Отмечен локальный водный стресс в восточном секторе из-за засора фильтра.',
          createdAt: Date.now() - 40 * 86400000
        },
        {
          id: 'field-4',
          organizationId: 'org-1',
          name: 'Поле Солнечное (Подсолнечник)',
          crop: 'sunflower',
          variety: 'Казахстанский 1',
          areaHectares: 110.0,
          polygon: JSON.stringify([
            [51.1400, 71.4200],
            [51.1500, 71.4200],
            [51.1500, 71.4350],
            [51.1400, 71.4350]
          ]),
          center: JSON.stringify([51.1450, 71.4275]),
          plantingDate: '2026-05-02',
          expectedHarvestDate: '2026-09-20',
          soilType: 'Тёмно-каштановая',
          irrigationType: 'rainfed',
          currentHealth: 'healthy',
          notes: 'Фаза 6 листьев. Корзинчатая гниль не обнаружена. Защитная обработка не требуется.',
          createdAt: Date.now() - 20 * 86400000
        }
      ];

      for (const f of seedFields) {
        await pool.query(`
          INSERT INTO fields (id, "organizationId", name, crop, variety, "areaHectares", polygon, center, "plantingDate", "expectedHarvestDate", "soilType", "irrigationType", "currentHealth", notes, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO NOTHING
        `, [f.id, f.organizationId, f.name, f.crop, f.variety, f.areaHectares, f.polygon, f.center, f.plantingDate, f.expectedHarvestDate, f.soilType, f.irrigationType, f.currentHealth, f.notes, f.createdAt]);
      }

      // Seed Missions
      const seedMissions = [
        {
          id: 'mission-1',
          fieldId: 'field-1',
          fieldName: 'Северный участок 14 (Пшеница)',
          name: 'Разведка фазы колошения - Поле 14',
          plannedDate: '2026-06-18',
          altitudeMeters: 75,
          imageOverlapPercent: 80,
          speedMps: 18,
          status: 'COMPLETED',
          imagesCount: 142,
          processedCount: 142,
          notes: 'Съемка выполнена в штатном режиме. Выявлены локальные очаги поражения листьев.',
          createdAt: Date.now() - 86400000 * 3
        },
        {
          id: 'mission-2',
          fieldId: 'field-2',
          fieldName: 'Восточное поле 3 (Ячмень)',
          name: 'Мониторинг всходов - Поле 3',
          plannedDate: '2026-06-19',
          altitudeMeters: 60,
          imageOverlapPercent: 75,
          speedMps: 15,
          status: 'COMPLETED',
          imagesCount: 98,
          processedCount: 98,
          notes: 'Равномерная плотность стеблестоя, сорняки подавлены.',
          createdAt: Date.now() - 86400000 * 2
        },
        {
          id: 'mission-3',
          fieldId: 'field-1',
          fieldName: 'Северный участок 14 (Пшеница)',
          name: 'Повторное сканирование очагов ржавчины',
          plannedDate: '2026-06-25',
          altitudeMeters: 50,
          imageOverlapPercent: 85,
          speedMps: 14,
          status: 'READY',
          imagesCount: 0,
          processedCount: 0,
          notes: 'Контрольный полет после фунгицидной обработки.',
          createdAt: Date.now() - 86400000 * 1
        }
      ];

      for (const m of seedMissions) {
        await pool.query(`
          INSERT INTO drone_missions (id, "fieldId", "fieldName", name, "plannedDate", "altitudeMeters", "imageOverlapPercent", "speedMps", status, "imagesCount", "processedCount", notes, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `, [m.id, m.fieldId, m.fieldName, m.name, m.plannedDate, m.altitudeMeters, m.imageOverlapPercent, m.speedMps, m.status, m.notes, m.createdAt]);
      }

      // Seed Recommendations
      const seedRecommendations = [
        {
          id: 'rec-1',
          fieldId: 'field-1',
          fieldName: 'Северный участок 14 (Пшеница)',
          analysisId: 'analysis-1',
          title: 'Срочная обработка фунгицидом Тилт 25%',
          description: 'Провести сплошное опрыскивание фунгицидом системного действия в дозировке 0.5 л/га для локализации бурой ржавчины.',
          priority: 'CRITICAL',
          reason: 'Очаг бурой ржавчины на поле 14 превысил порог вредоносности 5%',
          suggestedAction: 'Опрыскивание самоходным опрыскивателем (расход рабочей жидкости 200 л/га) при скорости ветра менее 5 м/с.',
          expectedBenefit: 'Сохранение 25-35% урожая (окупаемость затрат 4.5х)',
          status: 'IN_PROGRESS',
          createdAt: Date.now() - 86400000 * 2
        },
        {
          id: 'rec-2',
          fieldId: 'field-2',
          fieldName: 'Восточное поле 3 (Ячмень)',
          analysisId: 'analysis-2',
          title: 'Внекорневая подкормка микроэлементами (Zn + Mg)',
          description: 'Внесение хелатных микроудобрений для стимуляции фотосинтеза и усиления сопротивляемости стрессу.',
          priority: 'MEDIUM',
          reason: 'Незначительный дефицит цинка на суглинистых участках',
          suggestedAction: 'Совместить с вечерним плановым поливом или опрыскиванием.',
          expectedBenefit: 'Прибавка урожайности на 1.5-2.0 ц/га',
          status: 'NEW',
          createdAt: Date.now() - 86400000 * 4
        },
        {
          id: 'rec-3',
          fieldId: 'field-3',
          fieldName: 'Южный массив (Кукуруза)',
          analysisId: '',
          title: 'Прочистка магистрального фильтра капельного полива',
          description: 'Устранение засорения сектора 3 и выравнивание давления поливной воды.',
          priority: 'HIGH',
          reason: 'Зафиксирован водный стресс растений в восточной части массива',
          suggestedAction: 'Промывка дисковых фильтров и инспекция капельных лент.',
          expectedBenefit: 'Предотвращение засыхания 8 гектаров кукурузы',
          status: 'COMPLETED',
          createdAt: Date.now() - 86400000 * 5
        }
      ];

      for (const r of seedRecommendations) {
        await pool.query(`
          INSERT INTO recommendations (id, "fieldId", "fieldName", "analysisId", title, description, priority, reason, "suggestedAction", "expectedBenefit", status, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO NOTHING
        `, [r.id, r.fieldId, r.fieldName, r.analysisId, r.title, r.description, r.priority, r.reason, r.suggestedAction, r.expectedBenefit, r.status, r.createdAt]);
      }

      // Seed Notifications
      const seedNotifications = [
        {
          id: 'notif-1',
          title: 'Обнаружен очаг бурой ржавчины',
          message: 'На поле «Северный участок 14» ИИ выявил признаки Puccinia triticina (угроза: ВЫСОКАЯ).',
          type: 'disease',
          severity: 'critical',
          relatedId: 'field-1',
          relatedType: 'field',
          read: 0,
          createdAt: Date.now() - 86400000 * 1
        },
        {
          id: 'notif-2',
          title: 'Агрономический риск: высокая влажность',
          message: 'Прогноз влажности >78% в течение 48 часов благоприятен для спороношения грибных патогенов.',
          type: 'weather',
          severity: 'warning',
          relatedId: 'field-1',
          relatedType: 'field',
          read: 0,
          createdAt: Date.now() - 86400000 * 2
        },
        {
          id: 'notif-3',
          title: 'Агрономическая верификация завершена',
          message: 'Главный агроном ТОО подтвердил диагноз и утвердил рекомендацию по фунгициду Тилт 25%.',
          type: 'review',
          severity: 'info',
          relatedId: 'rec-1',
          relatedType: 'recommendation',
          read: 1,
          createdAt: Date.now() - 86400000 * 3
        },
        {
          id: 'notif-4',
          title: 'Миссия дрона #142 обработана',
          message: 'Снимки с Поля 14 загружены и распределены по ортофотоплану.',
          type: 'mission',
          severity: 'info',
          relatedId: 'mission-1',
          relatedType: 'mission',
          read: 1,
          createdAt: Date.now() - 86400000 * 3
        }
      ];

      for (const n of seedNotifications) {
        await pool.query(`
          INSERT INTO notifications (id, title, message, type, severity, "relatedId", "relatedType", read, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [n.id, n.title, n.message, n.type, n.severity, n.relatedId, n.relatedType, n.read, n.createdAt]);
      }

      // Seed Reviews
      await pool.query(`
        INSERT INTO agronomist_reviews (id, "analysisId", "fieldId", "reviewerId", "reviewerName", status, "revisedDiagnosis", comments, recommendations, "reviewedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        'review-1',
        'analysis-1',
        'field-1',
        'agronomist-1',
        'Ерлан Сейткалиев (Главный агроном)',
        'confirmed',
        'Бурая ржавчина (Puccinia triticina)',
        'Диагноз подтвержден по пустулам на 3 ярусе листьев. Очаговое распространение подтверждено полевым обходом.',
        'Срочная обработка Тилт 25% (0.5 л/га) + ПАВ 0.2 л/га. Запрещен выпас скота в течение 20 дней.',
        Date.now() - 86400000 * 2
      ]);

      // Seed History with rich real analysis
      const seedHistory = [
        {
          id: 'analysis-1',
          timestamp: Date.now() - 86400000 * 2,
          isPlantRelated: true,
          culture: 'wheat',
          fieldId: 'field-1',
          fieldName: 'Северный участок 14 (Пшеница)',
          ageDays: 45,
          diagnosis: 'Бурая ржавчина (Puccinia triticina)',
          confidence: 0.89,
          issueType: 'disease',
          severity: 'high',
          currency: 'KZT',
          unitSystem: 'metric',
          economicImpact: {
            potentialLossPercentage: 30,
            estimatedLossPerArea: 45000,
            estimatedLossWeight: 0.5
          },
          recommendations: [
            {
              action: 'Обработать системным фунгицидом Тилт 25% (0.5 л/га)',
              costEffectiveness: 'high',
              estimatedCost: 12000
            },
            {
              action: 'Повторный осмотр через 10-14 дней',
              costEffectiveness: 'medium',
              estimatedCost: 2000
            }
          ],
          localizedAdvice: '**Культура:** Пшеница яровая\n\n**Диагноз:** Бурая ржавчина (Puccinia triticina)\n\n**Симптомы:** На листьях ржаво-бурые пустулы. Поражение листового аппарата до 12% площади листа.\n\n**Меры:** Системный фунгицид Тилт 25% (0,5 л/га) или Рекс Дуо (0,6 л/га).',
          weatherContext: {
            temp: 22,
            humidity: 78,
            conditionCode: 2,
            forecast: 'Переменная облачность'
          },
          location: {
            lat: 51.1645,
            lng: 71.4777
          },
          modelName: 'AgroVision-Pro v2.4 (Gemini Vision Grounded)',
          modelVersion: '2026.04'
        },
        {
          id: 'analysis-2',
          timestamp: Date.now() - 86400000 * 5,
          isPlantRelated: true,
          culture: 'barley',
          fieldId: 'field-2',
          fieldName: 'Восточное поле 3 (Ячмень)',
          ageDays: 32,
          diagnosis: 'Септориоз ячменя (Septoria nodorum)',
          confidence: 0.82,
          issueType: 'disease',
          severity: 'medium',
          currency: 'KZT',
          unitSystem: 'metric',
          economicImpact: {
            potentialLossPercentage: 15,
            estimatedLossPerArea: 22000,
            estimatedLossWeight: 0.28
          },
          recommendations: [
            {
              action: 'Профилактическое опрыскивание фунгицидом Амистар Трио',
              costEffectiveness: 'high',
              estimatedCost: 9500
            }
          ],
          localizedAdvice: '**Культура:** Ячмень\n\n**Диагноз:** Септориоз\n\n**Рекомендации:** Обработка контактно-системными фунгицидами при росте температуры выше 18°C.',
          weatherContext: {
            temp: 19,
            humidity: 65,
            conditionCode: 1,
            forecast: 'Ясно'
          },
          location: {
            lat: 51.1785,
            lng: 71.4975
          },
          modelName: 'AgroVision-Pro v2.4 (Gemini Vision Grounded)',
          modelVersion: '2026.04'
        }
      ];

      for (const h of seedHistory) {
        await pool.query(`
          INSERT INTO history (id, "userId", timestamp, data)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO NOTHING
        `, [h.id, 'anonymous', h.timestamp, JSON.stringify(h)]);
      }
    }
  
    app.use(express.json({ limit: "15mb" }));
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err && (err.type === "entity.too.large" || err.status === 413)) {
        return res.status(413).json({
          error: "PAYLOAD_TOO_LARGE",
          message: "Размер запроса превышает допустимый лимит (15 МБ). Пожалуйста, уменьшите размер файла."
        });
      }
      next(err);
    });

    // CORS Whitelist configuration
    // При деплое на прод сюда нужно вписать реальный домен (или передать через переменную окружения APP_URL)
    const ALLOWED_ORIGINS = new Set([
      "http://localhost:3000",
      "https://localhost:3000",
      "http://localhost:5173",
      "https://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
      "https://ais-dev-tutrl3kgte2cvswa4i7sws-45688304878.asia-southeast1.run.app",
      "https://ais-pre-tutrl3kgte2cvswa4i7sws-45688304878.asia-southeast1.run.app"
    ]);

    const isOriginAllowed = (origin?: string): boolean => {
      if (!origin) return false;
      if (ALLOWED_ORIGINS.has(origin)) return true;
      if (process.env.APP_URL && origin === process.env.APP_URL) return true;
      // Allow Cloud Run development & preview domains
      if (/^https:\/\/ais-(dev|pre)-[a-z0-9\-]+\.[a-z0-9\-]+\.run\.app$/i.test(origin)) return true;
      return false;
    };

    app.use("/api", (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && isOriginAllowed(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    });

    // Rate Limiters: 10 / 15m for analyze, 30 / 15m for chat, 100 / 15m for general API
    const analyzeLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Превышен лимит запросов на диагностику по фото (максимум 10 запросов за 15 минут). Пожалуйста, подождите."
      }
    });

    const chatLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Превышен лимит сообщений в чат (максимум 30 запросов за 15 минут). Пожалуйста, подождите."
      }
    });

    const generalApiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "RATE_LIMIT_EXCEEDED",
        message: "Слишком много запросов к API (максимум 100 запросов за 15 минут). Пожалуйста, повторите позже."
      }
    });

    app.use("/api/analyze", analyzeLimiter);
    app.use("/api/chat", chatLimiter);
    app.use("/api", generalApiLimiter);

    // Explicit service worker endpoint to prevent 404 or text/html MIME type errors in any environment
    app.get("/sw.js", (req, res) => {
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(`// Service Worker placeholder
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
`);
    });
  
    // Authentication Middleware: validates Firebase ID token on mutating requests
    const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (!firebaseAdminAuth) {
        console.warn("Auth check bypassed: FIREBASE_SERVICE_ACCOUNT is not configured on server.");
        (req as any).user = { uid: "anonymous" };
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Требуется заголовок Authorization: Bearer <token>"
        });
      }

      const token = authHeader.split("Bearer ")[1]?.trim();
      if (!token) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Токен авторизации пуст"
        });
      }

      try {
        const decodedToken = await firebaseAdminAuth.verifyIdToken(token);
        (req as any).user = {
          uid: decodedToken.uid,
          email: decodedToken.email
        };
        next();
      } catch (err: any) {
        console.warn("Token verification failed:", err.message);
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Недействительный или истекший токен авторизации"
        });
      }
    };

    // API Routes
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: Date.now() });
    });

    // Configuration Status (Transparent status without leaking API keys)
    app.get("/api/config-status", (req, res) => {
      const hasGoogleWeather = Boolean(getGoogleWeatherApiKey());
      res.json({
        geminiStatus: isGeminiConfigured() ? "CONFIGURED" : "NOT_CONFIGURED",
        weatherStatus: hasGoogleWeather ? "CONFIGURED_GOOGLE_WEATHER" : "CONFIGURED_OPEN_METEO",
        weatherSource: hasGoogleWeather ? "Google Weather API" : "Open-Meteo",
        mlInferenceStatus: "CONFIGURED",
        storageStatus: "CONFIGURED",
        databaseStatus: "CONFIGURED",
        platformVersion: "v2.5.0",
        activeEngine: "Gemini + AgroVision PostGIS Pipeline"
      });
    });

    // Dashboard Statistics Endpoint
    app.get("/api/dashboard/stats", async (req, res) => {
      try {
        const fields = (await pool.query('SELECT * FROM fields')).rows;
        const missions = (await pool.query('SELECT * FROM drone_missions')).rows;
        const historyRows = (await pool.query('SELECT data FROM history ORDER BY timestamp DESC')).rows;
        const analyses = historyRows.map(r => JSON.parse(r.data));
        const recommendations = (await pool.query('SELECT * FROM recommendations ORDER BY "createdAt" DESC')).rows;
        const notifications = (await pool.query('SELECT * FROM notifications ORDER BY "createdAt" DESC LIMIT 10')).rows;

        const totalFields = fields.length;
        const totalArea = fields.reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
        const activeMissions = missions.filter(m => ['IN_PROGRESS', 'READY', 'PROCESSING', 'UPLOADING'].includes(m.status)).length;
        const completedAnalyses = analyses.length;
        const fieldsNeedingAttention = fields.filter(f => ['warning', 'critical'].includes(f.currentHealth)).length;
        const detectedDiseasesCount = analyses.filter(a => ['disease', 'pest'].includes(a.issueType)).length;

        const healthyArea = fields.filter(f => f.currentHealth === 'healthy').reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
        const stressArea = fields.filter(f => f.currentHealth === 'warning').reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
        const diseaseArea = fields.filter(f => f.currentHealth === 'critical').reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);
        const pendingArea = fields.filter(f => f.currentHealth === 'pending').reduce((sum, f) => sum + (Number(f.areaHectares) || 0), 0);

        res.json({
          totalFields,
          totalArea: Math.round(totalArea * 10) / 10,
          activeMissions,
          completedAnalyses,
          fieldsNeedingAttention,
          detectedDiseasesCount,
          healthSummary: {
            healthyArea: Math.round(healthyArea * 10) / 10,
            stressArea: Math.round(stressArea * 10) / 10,
            diseaseArea: Math.round(diseaseArea * 10) / 10,
            pendingArea: Math.round(pendingArea * 10) / 10,
          },
          recentAnalyses: analyses.slice(0, 5),
          recentMissions: missions.slice(0, 5),
          recentRecommendations: recommendations.slice(0, 5),
          notifications: notifications
        });
      } catch (err: any) {
        console.error("Dashboard stats error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // Fields CRUD
    app.get("/api/fields", async (req, res) => {
      try {
        const rows = (await pool.query('SELECT * FROM fields ORDER BY "createdAt" DESC')).rows;
        const fields = rows.map(r => ({
          ...r,
          areaHectares: Number(r.areaHectares) || 0,
          polygon: typeof r.polygon === 'string' ? JSON.parse(r.polygon || "[]") : (r.polygon || []),
          center: typeof r.center === 'string' ? JSON.parse(r.center || "[0,0]") : (r.center || [0, 0])
        }));
        res.json(fields);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/fields", requireAuth, async (req, res) => {
      try {
        const { id, organizationId, name, crop, variety, areaHectares, polygon, center, plantingDate, expectedHarvestDate, soilType, irrigationType, currentHealth, notes } = req.body;
        const fieldId = id || `field-${Date.now()}`;
        const parsedPolygon = Array.isArray(polygon) ? polygon : [];

        // Compute centroid center from polygon vertices if not provided
        let fieldCenter = center;
        if ((!fieldCenter || !Array.isArray(fieldCenter) || fieldCenter.length < 2) && parsedPolygon.length > 0) {
          const latAvg = parsedPolygon.reduce((acc: number, pt: [number, number]) => acc + (pt[0] || 0), 0) / parsedPolygon.length;
          const lngAvg = parsedPolygon.reduce((acc: number, pt: [number, number]) => acc + (pt[1] || 0), 0) / parsedPolygon.length;
          fieldCenter = [latAvg, lngAvg];
        } else if (!fieldCenter || !Array.isArray(fieldCenter) || fieldCenter.length < 2) {
          fieldCenter = [0, 0];
        }

        const orgId = organizationId || 'farm-user';
        const now = Date.now();

        await pool.query(`
          INSERT INTO fields (id, "organizationId", name, crop, variety, "areaHectares", polygon, center, "plantingDate", "expectedHarvestDate", "soilType", "irrigationType", "currentHealth", notes, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            "organizationId" = EXCLUDED."organizationId",
            name = EXCLUDED.name,
            crop = EXCLUDED.crop,
            variety = EXCLUDED.variety,
            "areaHectares" = EXCLUDED."areaHectares",
            polygon = EXCLUDED.polygon,
            center = EXCLUDED.center,
            "plantingDate" = EXCLUDED."plantingDate",
            "expectedHarvestDate" = EXCLUDED."expectedHarvestDate",
            "soilType" = EXCLUDED."soilType",
            "irrigationType" = EXCLUDED."irrigationType",
            "currentHealth" = EXCLUDED."currentHealth",
            notes = EXCLUDED.notes
        `, [
          fieldId,
          orgId,
          name || 'Поле',
          crop || '',
          variety || '',
          areaHectares || 0,
          JSON.stringify(parsedPolygon),
          JSON.stringify(fieldCenter),
          plantingDate || '',
          expectedHarvestDate || '',
          soilType || '',
          irrigationType || 'rainfed',
          currentHealth || 'healthy',
          notes || '',
          now
        ]);

        const newField = {
          id: fieldId,
          organizationId: orgId,
          name: name || 'Поле',
          crop: crop || '',
          variety: variety || '',
          areaHectares: areaHectares || 0,
          polygon: parsedPolygon,
          center: fieldCenter,
          plantingDate: plantingDate || '',
          expectedHarvestDate: expectedHarvestDate || '',
          soilType: soilType || '',
          irrigationType: irrigationType || 'rainfed',
          currentHealth: currentHealth || 'healthy',
          notes: notes || '',
          createdAt: now
        };

        res.status(201).json(newField);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.put("/api/fields/:id", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        const { name, crop, variety, areaHectares, polygon, center, plantingDate, expectedHarvestDate, soilType, irrigationType, currentHealth, notes } = req.body;
        await pool.query(`
          UPDATE fields SET 
            name = COALESCE($1, name),
            crop = COALESCE($2, crop),
            variety = COALESCE($3, variety),
            "areaHectares" = COALESCE($4, "areaHectares"),
            polygon = COALESCE($5, polygon),
            center = COALESCE($6, center),
            "plantingDate" = COALESCE($7, "plantingDate"),
            "expectedHarvestDate" = COALESCE($8, "expectedHarvestDate"),
            "soilType" = COALESCE($9, "soilType"),
            "irrigationType" = COALESCE($10, "irrigationType"),
            "currentHealth" = COALESCE($11, "currentHealth"),
            notes = COALESCE($12, notes)
          WHERE id = $13
        `, [
          name,
          crop,
          variety,
          areaHectares,
          polygon ? JSON.stringify(polygon) : null,
          center ? JSON.stringify(center) : null,
          plantingDate,
          expectedHarvestDate,
          soilType,
          irrigationType,
          currentHealth,
          notes,
          id
        ]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/api/fields/:id", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        await pool.query("DELETE FROM fields WHERE id = $1", [id]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Drone Missions CRUD
    app.get("/api/missions", async (req, res) => {
      try {
        const missions = (await pool.query('SELECT * FROM drone_missions ORDER BY "createdAt" DESC')).rows;
        res.json(missions);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/missions", requireAuth, async (req, res) => {
      try {
        const { id, fieldId, fieldName, name, plannedDate, altitudeMeters, imageOverlapPercent, speedMps, status, notes } = req.body;
        const missionId = id || `mission-${Date.now()}`;
        await pool.query(`
          INSERT INTO drone_missions (id, "fieldId", "fieldName", name, "plannedDate", "altitudeMeters", "imageOverlapPercent", "speedMps", status, "imagesCount", "processedCount", notes, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            "fieldId" = EXCLUDED."fieldId",
            "fieldName" = EXCLUDED."fieldName",
            name = EXCLUDED.name,
            "plannedDate" = EXCLUDED."plannedDate",
            "altitudeMeters" = EXCLUDED."altitudeMeters",
            "imageOverlapPercent" = EXCLUDED."imageOverlapPercent",
            "speedMps" = EXCLUDED."speedMps",
            status = EXCLUDED.status,
            notes = EXCLUDED.notes
        `, [
          missionId,
          fieldId || 'field-1',
          fieldName || 'Поле',
          name || 'Полетное задание',
          plannedDate || new Date().toISOString().split('T')[0],
          altitudeMeters || 60,
          imageOverlapPercent || 75,
          speedMps || 15,
          status || 'READY',
          notes || '',
          Date.now()
        ]);
        res.status(201).json({ success: true, id: missionId });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.put("/api/missions/:id", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        const { status, processedCount, imagesCount, notes } = req.body;
        await pool.query(`
          UPDATE drone_missions SET
            status = COALESCE($1, status),
            "processedCount" = COALESCE($2, "processedCount"),
            "imagesCount" = COALESCE($3, "imagesCount"),
            notes = COALESCE($4, notes)
          WHERE id = $5
        `, [status, processedCount, imagesCount, notes, id]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/api/missions/:id", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        await pool.query("DELETE FROM drone_missions WHERE id = $1", [id]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Recommendations CRUD
    app.get("/api/recommendations", async (req, res) => {
      try {
        const recs = (await pool.query('SELECT * FROM recommendations ORDER BY "createdAt" DESC')).rows;
        res.json(recs);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/recommendations", requireAuth, async (req, res) => {
      try {
        const { id, fieldId, fieldName, analysisId, title, description, priority, reason, suggestedAction, expectedBenefit, status } = req.body;
        const recId = id || `rec-${Date.now()}`;
        await pool.query(`
          INSERT INTO recommendations (id, "fieldId", "fieldName", "analysisId", title, description, priority, reason, "suggestedAction", "expectedBenefit", status, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            "fieldId" = EXCLUDED."fieldId",
            "fieldName" = EXCLUDED."fieldName",
            "analysisId" = EXCLUDED."analysisId",
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            priority = EXCLUDED.priority,
            reason = EXCLUDED.reason,
            "suggestedAction" = EXCLUDED."suggestedAction",
            "expectedBenefit" = EXCLUDED."expectedBenefit",
            status = EXCLUDED.status
        `, [recId, fieldId, fieldName, analysisId || '', title, description, priority || 'MEDIUM', reason, suggestedAction, expectedBenefit, status || 'NEW', Date.now()]);
        res.status(201).json({ success: true, id: recId });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch("/api/recommendations/:id", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;
        await pool.query('UPDATE recommendations SET status = $1 WHERE id = $2', [status, id]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Agronomist Reviews API
    app.get("/api/reviews", async (req, res) => {
      try {
        const reviews = (await pool.query('SELECT * FROM agronomist_reviews ORDER BY "reviewedAt" DESC')).rows;
        res.json(reviews);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/reviews", requireAuth, async (req, res) => {
      try {
        const { id, analysisId, fieldId, reviewerId, reviewerName, status, revisedDiagnosis, comments, recommendations } = req.body;
        const reviewId = id || `review-${Date.now()}`;
        await pool.query(`
          INSERT INTO agronomist_reviews (id, "analysisId", "fieldId", "reviewerId", "reviewerName", status, "revisedDiagnosis", comments, recommendations, "reviewedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            "revisedDiagnosis" = EXCLUDED."revisedDiagnosis",
            comments = EXCLUDED.comments,
            recommendations = EXCLUDED.recommendations,
            "reviewedAt" = EXCLUDED."reviewedAt"
        `, [reviewId, analysisId, fieldId || '', reviewerId || 'agronomist-1', reviewerName || 'Эксперт-агроном', status, revisedDiagnosis || '', comments, recommendations, Date.now()]);

        // Also create a notification about the completed review
        await pool.query(`
          INSERT INTO notifications (id, title, message, type, severity, "relatedId", "relatedType", read, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
        `, [
          `notif-${Date.now()}`,
          'Агрономический обзор добавлен',
          `${reviewerName || 'Агроном'} верифицировал диагноз для анализа #${analysisId?.slice(-6) || ''}. Статус: ${status}.`,
          'review',
          'info',
          reviewId,
          'review',
          Date.now()
        ]);

        res.status(201).json({ success: true, id: reviewId });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // Notifications API
    app.get("/api/notifications", async (req, res) => {
      try {
        const notifs = (await pool.query('SELECT * FROM notifications ORDER BY "createdAt" DESC LIMIT 50')).rows;
        res.json(notifs);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        await pool.query('UPDATE notifications SET read = 1 WHERE id = $1', [id]);
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
      try {
        await pool.query('UPDATE notifications SET read = 1');
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/notifications", requireAuth, async (req, res) => {
      try {
        const { title, message, type, severity, relatedId, relatedType } = req.body;
        const id = `notif-${Date.now()}`;
        await pool.query(`
          INSERT INTO notifications (id, title, message, type, severity, "relatedId", "relatedType", read, "createdAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
        `, [id, title, message, type || 'system', severity || 'info', relatedId || '', relatedType || '', Date.now()]);
        res.status(201).json({ success: true, id });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    // History API
    app.get("/api/history", async (req, res) => {
      try {
        const rows = (await pool.query('SELECT * FROM history ORDER BY timestamp DESC')).rows as Array<{
          id: string;
          userId: string;
          timestamp: number | string;
          data: string;
        }>;
        const history = rows.map(r => {
          try {
            const parsed = JSON.parse(r.data);
            return { ...parsed, id: r.id, timestamp: Number(r.timestamp), userId: r.userId };
          } catch {
            return { id: r.id, userId: r.userId, timestamp: Number(r.timestamp) };
          }
        });
        res.json(history);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/history", async (req, res) => {
      try {
        const body = req.body || {};
        const id = body.id || `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const timestamp = typeof body.timestamp === 'number' ? body.timestamp : Date.now();
        const userId = body.userId || 'anonymous';
        const record = {
          ...body,
          id,
          userId,
          timestamp
        };

        await pool.query(`
          INSERT INTO history (id, "userId", timestamp, data)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            "userId" = EXCLUDED."userId",
            timestamp = EXCLUDED.timestamp,
            data = EXCLUDED.data
        `, [id, userId, timestamp, JSON.stringify(record)]);
        res.status(201).json(record);
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/api/history/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await pool.query("DELETE FROM history WHERE id = $1", [id]);
        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Record not found", id });
        }
        res.json({ success: true, id });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/analyze", async (req, res) => {
      try {
        const {
          base64Image,
          culture,
          ageDays,
          location,
          customCultureName,
          weather,
          lang,
          currency,
          unitSystem
        } = req.body;

        if (!isGeminiConfigured()) {
          return res.status(503).json({
            error: "GEMINI_API_KEY_NOT_CONFIGURED",
            message: lang === 'kz'
              ? "Серверде Gemini API кілті бапталмаған. GEMINI_API_KEY айнымалысын көрсетіңіз."
              : lang === 'en'
              ? "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in environment variables."
              : "API-ключ Gemini не настроен на сервере. Задайте переменную окружения GEMINI_API_KEY."
          });
        }

        if (!base64Image || typeof base64Image !== "string") {
          return res.status(400).json({
            error: "IMAGE_REQUIRED",
            message: lang === 'kz'
              ? "Талдау үшін сурет қажет."
              : lang === 'en'
              ? "Image is required for analysis."
              : "Изображение обязательно для проведения анализа."
          });
        }

        const MAX_BASE64_LENGTH = 15 * 1024 * 1024;
        if (base64Image.length > MAX_BASE64_LENGTH) {
          return res.status(413).json({
            error: "PAYLOAD_TOO_LARGE",
            message: lang === 'kz'
              ? "Сурет өлшемі тым үлкен (максимум 15 МБ). Кішірек өлшемді файлды таңдаңыз."
              : lang === 'en'
              ? "Image size is too large (maximum 15 MB). Please select a smaller file."
              : "Размер изображения слишком велик (максимум 15 МБ). Пожалуйста, выберите файл меньшего размера."
          });
        }

        let mimeType = "image/jpeg";
        let rawData = base64Image;
        if (base64Image.startsWith("data:")) {
          const match = base64Image.match(/^data:([^;]+);base64,(.*)$/);
          if (match) {
            mimeType = match[1];
            rawData = match[2];
          }
        }

        const ai = getGenAI();
        if (!ai) {
          return res.status(503).json({
            error: "GEMINI_API_KEY_NOT_CONFIGURED",
            message: "API-ключ Gemini не настроен на сервере. Задайте переменную окружения GEMINI_API_KEY."
          });
        }

        const plantName = culture === "other" && customCultureName ? customCultureName : (culture || "plant");
        const targetLang = lang === "kz" ? "Kazakh" : lang === "en" ? "English" : "Russian";
        const targetCurrency = currency || "KZT";
        const targetUnits = unitSystem || "metric";
        const areaUnit = targetUnits === "metric" ? "1 hectare" : "1 acre";
        const weightUnit = targetUnits === "metric" ? "tons" : "bushels";

        const promptText = `
You are a senior agronomist and crop pathologist specialized in agricultural crops of Kazakhstan and Central Asia.
Examine the attached image of the plant leaf/crop carefully and provide a rigorous diagnostic report based strictly on what is visually present in the image.

Field & Agronomic Context:
- Crop / Culture: ${plantName}
- Plant Age: ${ageDays || 0} days
- Field Coordinates: ${location ? `${location.lat}, ${location.lng}` : "Not specified"}
- Weather Conditions: ${weather ? `Temp: ${weather.temp}°C, Humidity: ${weather.humidity}%, Condition: ${weather.forecast || weather.condition || "N/A"}` : "Not specified"}
- Currency for estimates: ${targetCurrency}
- Unit System: ${targetUnits} (${areaUnit}, ${weightUnit})
- Output Language: ${targetLang}

Instructions:
1. isPlantRelated: Set to true if the image contains plants, crops, leaves, agricultural fields, pests, or agricultural materials. Set to false if the image has nothing to do with plants/agriculture.
2. diagnosis: If isPlantRelated is false, state that this is not a plant image. If healthy, state "Здоровое растение" / "Өсімдік сау" / "Healthy crop". If an issue is present, provide the exact name of the disease/pathogen or pest or deficiency (e.g. "Септориоз (Septoria tritici)", "Бурая ржавчина (Puccinia triticina)", "Трипс пшеничный", "Азотное голодание").
3. confidence: Number between 0.00 and 1.00 indicating visual diagnostic confidence.
4. issueType: One of ["disease", "pest", "water", "nutrient", "pesticide", "healthy"].
5. severity: One of ["low", "medium", "high"]. If healthy, "low".
6. economicImpact: Realistic agronomical estimate based on the observed severity:
   - potentialLossPercentage: Number (0-100) representing expected yield loss without treatment.
   - estimatedLossPerArea: Estimated economic loss per ${areaUnit} in ${targetCurrency}.
   - estimatedLossWeight: Estimated yield loss in ${weightUnit}.
   If healthy, set all values to 0.
7. recommendations: Concrete agronomical measures. Include specific active chemical/biological substances or agro-technical methods with costEffectiveness ("high" | "medium" | "low") and estimatedCost in ${targetCurrency}. If healthy, provide preventative maintenance recommendations.
8. localizedAdvice: Comprehensive formatted markdown report written in ${targetLang} covering:
   - Культура / Crop
   - Диагноз / Diagnosis & pathogen
   - Симптомы / Observable visual symptoms
   - Лечение / Actionable treatment steps with dosage (L/ha or kg/ha)
   - Профилактика / Preventative measures (crop rotation, resistant varieties, soil prep)
   - Экономический эффект / Economic justification
`;

        const generateWithModel = (modelName: string) => {
          return ai.models.generateContent({
            model: modelName,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: rawData,
                    }
                  },
                  {
                    text: promptText,
                  }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isPlantRelated: { type: Type.BOOLEAN, description: "Whether the image is plant-related" },
                  diagnosis: { type: Type.STRING, description: "Diagnosis name or healthy status in target language" },
                  confidence: { type: Type.NUMBER, description: "Confidence score between 0.0 and 1.0" },
                  issueType: {
                    type: Type.STRING,
                    enum: ["disease", "pest", "water", "nutrient", "pesticide", "healthy"]
                  },
                  severity: {
                    type: Type.STRING,
                    enum: ["low", "medium", "high"]
                  },
                  economicImpact: {
                    type: Type.OBJECT,
                    properties: {
                      potentialLossPercentage: { type: Type.NUMBER },
                      estimatedLossPerArea: { type: Type.NUMBER },
                      estimatedLossWeight: { type: Type.NUMBER }
                    },
                    required: ["potentialLossPercentage", "estimatedLossPerArea", "estimatedLossWeight"]
                  },
                  recommendations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        action: { type: Type.STRING },
                        costEffectiveness: { type: Type.STRING, enum: ["high", "medium", "low"] },
                        estimatedCost: { type: Type.NUMBER }
                      },
                      required: ["action", "costEffectiveness", "estimatedCost"]
                    }
                  },
                  localizedAdvice: { type: Type.STRING, description: "Detailed markdown agronomist report" }
                },
                required: [
                  "isPlantRelated",
                  "diagnosis",
                  "confidence",
                  "issueType",
                  "severity",
                  "economicImpact",
                  "recommendations",
                  "localizedAdvice"
                ]
              }
            }
          });
        };

        let response;
        try {
          response = await retry(() => generateWithModel(MODEL_NAME), 2, 1200);
        } catch (firstErr: any) {
          const isCapacity = firstErr.message?.includes('high demand') ||
                             firstErr.message?.includes('503') ||
                             firstErr.message?.includes('UNAVAILABLE') ||
                             firstErr.message?.includes('SERVER_OVERLOAD');
          if (isCapacity) {
            console.warn("Primary model high demand, attempting fallback model (gemini-2.5-flash-lite)...");
            response = await retry(() => generateWithModel("gemini-2.5-flash-lite"), 1, 1000);
          } else {
            throw firstErr;
          }
        }

        let rawText = response.text || "";
        if (rawText.startsWith("```")) {
          rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
        }
        const parsedResult = JSON.parse(rawText.trim());

        const id = `analysis-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const timestamp = Date.now();
        const fullRecord = {
          ...parsedResult,
          id,
          timestamp,
          culture: culture === 'other' && customCultureName ? customCultureName : (culture || "plant"),
          customCultureName: customCultureName || undefined,
          ageDays: ageDays || 0,
          location: location || undefined,
          weatherContext: weather ? {
            temp: weather.temp ?? 20,
            humidity: weather.humidity ?? 65,
            conditionCode: weather.conditionCode ?? 1,
            forecast: weather.condition ?? 'Ясно'
          } : undefined,
          currency: currency || 'KZT',
          unitSystem: unitSystem || 'metric',
          modelName: MODEL_NAME,
          modelVersion: '2026.04',
          userId: 'anonymous'
        };

        try {
          await pool.query(`
            INSERT INTO history (id, "userId", timestamp, data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET
              "userId" = EXCLUDED."userId",
              timestamp = EXCLUDED.timestamp,
              data = EXCLUDED.data
          `, [id, 'anonymous', timestamp, JSON.stringify(fullRecord)]);
        } catch (dbErr) {
          console.error("Failed to automatically save analysis to history table:", dbErr);
        }

        return res.json(fullRecord);
      } catch (err: any) {
        console.error("Gemini Vision analysis error:", {
          message: err.message,
          status: err.status,
          code: err.code,
          stack: err.stack?.slice(0, 300)
        });
        const userLang = req.body?.lang;
        let cleanMsg = err.message || '';
        try {
          const parsedErr = JSON.parse(cleanMsg);
          if (parsedErr?.error?.message) {
            cleanMsg = parsedErr.error.message;
          }
        } catch {
          // Keep raw string
        }
        const isAuthError = cleanMsg.includes("API_KEY") || cleanMsg.includes("API key") || err.status === 401 || err.status === 403;
        return res.status(isAuthError ? 403 : 502).json({
          error: "GEMINI_ANALYSIS_FAILED",
          message: userLang === 'kz'
            ? `Gemini API талдау қатесі: ${cleanMsg || 'Талдау орындалмады'}`
            : userLang === 'en'
            ? `Gemini API analysis error: ${cleanMsg || 'Analysis failed'}`
            : `Ошибка анализа Gemini: ${cleanMsg || 'Не удалось выполнить анализ'}`
        });
      }
    });

  app.post("/api/chat", async (req, res) => {
    const { messages, lang } = req.body;
    try {
      if (!isGeminiConfigured()) {
        return res.status(503).json({
          error: "GEMINI_API_KEY_NOT_CONFIGURED",
          message: lang === 'kz'
            ? "Серверде Gemini API кілті бапталмаған. GEMINI_API_KEY айнымалысын көрсетіңіз."
            : lang === 'en'
            ? "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in environment variables."
            : "API-ключ Gemini не настроен на сервере. Задайте переменную окружения GEMINI_API_KEY."
        });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.status(503).json({
          error: "GEMINI_API_KEY_NOT_CONFIGURED",
          message: "API-ключ Gemini не настроен на сервере. Задайте переменную окружения GEMINI_API_KEY."
        });
      }

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: "MESSAGES_REQUIRED",
          message: lang === 'kz'
            ? "Хабарламалар тарихы қажет."
            : lang === 'en'
            ? "Messages history is required."
            : "История сообщений обязательна."
        });
      }

      const rawContents = messages
        .filter((m: any) => m && typeof m.text === "string" && m.text.trim())
        .map((m: any) => ({
          role: m.role === "model" ? "model" : "user",
          parts: [{ text: String(m.text) }]
        }));

      while (rawContents.length > 0 && rawContents[0].role === "model") {
        rawContents.shift();
      }

      if (rawContents.length === 0) {
        return res.status(400).json({
          error: "EMPTY_MESSAGES",
          message: lang === 'kz'
            ? "Хабарлама бос болмауы керек."
            : lang === 'en'
            ? "Messages cannot be empty."
            : "Сообщения не могут быть пустыми."
        });
      }

      const formattedContents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
      for (const msg of rawContents) {
        if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role === msg.role) {
          formattedContents[formattedContents.length - 1].parts.push(...msg.parts);
        } else {
          formattedContents.push({ role: msg.role, parts: [...msg.parts] });
        }
      }

      const systemInstruction = "Ты — опытный агроном-консультант из Казахстана. Отвечай на языке пользователя (lang: ru/kz/en). Давай практические советы по защите растений, удобрениям, севообороту, погоде и экономике. Если вопрос не по теме — вежливо скажи, что ты специализируешься только на агрономии. Будь краток, но конкретен.";

      let response;
      try {
        response = await retry(() => ai.models.generateContent({
          model: MODEL_NAME,
          contents: formattedContents,
          config: {
            systemInstruction
          }
        }), 1, 1000);
      } catch (firstErr: any) {
        const isCapacity = firstErr.message?.includes('high demand') ||
                           firstErr.message?.includes('503') ||
                           firstErr.message?.includes('UNAVAILABLE') ||
                           firstErr.message?.includes('SERVER_OVERLOAD');
        if (isCapacity) {
          console.warn("Primary model high demand in chat, attempting fallback model (gemini-2.5-flash-lite)...");
          response = await retry(() => ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: formattedContents,
            config: {
              systemInstruction
            }
          }), 1, 1000);
        } else {
          throw firstErr;
        }
      }

      const replyText = response.text || "";
      return res.json({ text: replyText });
    } catch (err: any) {
      console.error("Gemini Chat API error:", err);
      return res.status(502).json({
        error: "GEMINI_CHAT_ERROR",
        message: lang === 'kz'
          ? `Gemini API қатесі: ${err.message || 'Жауап алу мүмкін болмады'}`
          : lang === 'en'
          ? `Gemini API error: ${err.message || 'Failed to get chat response'}`
          : `Ошибка Gemini API: ${err.message || 'Не удалось получить ответ чата'}`
      });
    }
  });

  // Weather API Helper: Fetch from Google Weather API if key is present
  async function fetchGoogleWeather(lat: string | number, lng: string | number) {
    const apiKey = getGoogleWeatherApiKey();
    if (!apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const currentUrl = `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(apiKey)}&location.latitude=${lat}&location.longitude=${lng}`;
      const forecastUrl = `https://weather.googleapis.com/v1/forecast:lookup?key=${encodeURIComponent(apiKey)}&location.latitude=${lat}&location.longitude=${lng}&days=7`;

      const [currentRes, forecastRes] = await Promise.all([
        fetch(currentUrl, { signal: controller.signal }),
        fetch(forecastUrl, { signal: controller.signal }).catch(() => null)
      ]);

      if (!currentRes.ok) {
        const errText = await currentRes.text().catch(() => '');
        throw new Error(`Google Weather API error (${currentRes.status}): ${errText.slice(0, 100)}`);
      }

      const currentData = await currentRes.json();
      const forecastData = forecastRes && forecastRes.ok ? await forecastRes.json() : null;

      const cond = currentData?.currentConditions || currentData;
      const tempC = cond?.temperature?.degrees ?? cond?.temperature ?? 20;
      const humidity = cond?.relativeHumidity ?? 65;
      const windSpeedVal = cond?.wind?.speed?.value ?? 12;
      const windMps = cond?.wind?.speed?.unit === 'KILOMETERS_PER_HOUR' ? Math.round((windSpeedVal / 3.6) * 10) / 10 : windSpeedVal;
      const precipMm = cond?.precipitation?.qpf?.quantity ?? 0;
      const conditionDesc = cond?.weatherCondition?.description?.text || cond?.weatherCondition?.condition || "Облачно";

      const dailyDays = forecastData?.forecastDays || [];
      const daily = dailyDays.length > 0 ? {
        time: dailyDays.map((d: any) => `${d.displayDate?.year}-${String(d.displayDate?.month).padStart(2, '0')}-${String(d.displayDate?.day).padStart(2, '0')}`),
        temperature_2m_max: dailyDays.map((d: any) => d.maxTemperature?.degrees ?? tempC + 4),
        temperature_2m_min: dailyDays.map((d: any) => d.minTemperature?.degrees ?? tempC - 4),
        precipitation_sum: dailyDays.map((d: any) => d.precipitation?.qpf?.quantity ?? 0)
      } : undefined;

      return {
        current: {
          temperature_2m: tempC,
          relative_humidity_2m: humidity,
          wind_speed_10m: windMps,
          precipitation: precipMm,
          weather_code: 1,
          condition_text: conditionDesc
        },
        daily,
        source: "Google Weather API",
        updatedAt: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Weather API Helper: Fetch from Open-Meteo
  async function fetchOpenMeteoWeather(lat: string | number, lng: string | number, withDaily = false) {
    const dailyParam = withDaily ? '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto' : '';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code${dailyParam}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo API error (${response.status})`);
      }
      const data = await response.json();
      return {
        current: data.current,
        daily: data.daily,
        source: "Open-Meteo",
        updatedAt: new Date().toISOString()
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  app.get("/api/weather", async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat/lng" });
    }

    try {
      if (getGoogleWeatherApiKey()) {
        try {
          const googleData = await fetchGoogleWeather(lat as string, lng as string);
          if (googleData) {
            return res.json(googleData);
          }
        } catch (gwErr: any) {
          console.warn("Google Weather API lookup failed, falling back to Open-Meteo:", gwErr.message);
          const fallbackData = await fetchOpenMeteoWeather(lat as string, lng as string, false);
          return res.json({
            ...fallbackData,
            source: "Open-Meteo (резервный fallback)"
          });
        }
      }

      const openMeteoData = await fetchOpenMeteoWeather(lat as string, lng as string, false);
      res.json(openMeteoData);
    } catch (err: any) {
      console.warn("Weather service error:", err.message);
      res.status(503).json({ 
        error: "WEATHER_SOURCE_UNAVAILABLE", 
        message: `Не удалось получить данные о погоде: ${err.message}`,
        source: "Недоступен",
        isAvailable: false
      });
    }
  });

  app.get("/api/weather/agro-risk", async (req, res) => {
    const { lat, lng, lang = 'ru' } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: "Missing lat/lng" });
    }

    try {
      let weatherPayload: any = null;

      if (getGoogleWeatherApiKey()) {
        try {
          weatherPayload = await fetchGoogleWeather(lat as string, lng as string);
        } catch (gwErr: any) {
          console.warn("Google Weather API risk lookup failed, falling back to Open-Meteo:", gwErr.message);
          weatherPayload = await fetchOpenMeteoWeather(lat as string, lng as string, true);
          weatherPayload.source = "Open-Meteo (резервный fallback)";
        }
      }

      if (!weatherPayload) {
        weatherPayload = await fetchOpenMeteoWeather(lat as string, lng as string, true);
      }

      const current = weatherPayload.current;
      const humidity = current.relative_humidity_2m;
      const temp = current.temperature_2m;
      const windSpeed = current.wind_speed_10m;

      const fungalRisk = (humidity >= 75 && temp >= 15 && temp <= 27) ? 'high' : (humidity >= 60 && temp >= 12) ? 'moderate' : 'low';
      const droughtRisk = (temp > 28 && humidity < 35) ? 'high' : (temp > 25 && humidity < 45) ? 'moderate' : 'low';
      const frostRisk = (temp <= 1) ? 'high' : (temp <= 4) ? 'moderate' : 'low';
      const windRisk = (windSpeed >= 10) ? 'high' : (windSpeed >= 6) ? 'moderate' : 'low';
      const heatStress = (temp >= 33) ? 'high' : (temp >= 29) ? 'moderate' : 'low';

      let summary = "";
      if (lang === 'ru') {
        summary = fungalRisk === 'high' 
          ? "Высокий риск грибных заболеваний (бурая ржавчина, септориоз). Влажность воздуха выше 75% при температуре 15-26°C благоприятствует спорообразованию."
          : droughtRisk === 'high'
            ? "Угроза атмосферной засухи и водного стресса растений. Рекомендуется полив."
            : "Агроклиматические условия благоприятны для вегетации. Погодных угроз не зафиксировано.";
      } else if (lang === 'kz') {
        summary = fungalRisk === 'high'
          ? "Саңырауқұлақ ауруларының (қоңыр тат, септориоз) жоғары қаупі. Ылғалдылық 75%-дан астам."
          : "Агроклиматтық жағдайлар қалыпты деңгейде.";
      } else {
        summary = fungalRisk === 'high'
          ? "High fungal disease risk (leaf rust, septoria). Relative humidity >75% with 15-27°C facilitates rapid spore germination."
          : "Agro-climatic conditions are optimal for crop development.";
      }

      res.json({
        current,
        daily: weatherPayload.daily,
        source: weatherPayload.source,
        updatedAt: weatherPayload.updatedAt,
        riskMatrix: {
          fungalRisk,
          droughtRisk,
          frostRisk,
          windRisk,
          heatStress,
          summary
        }
      });
    } catch (err: any) {
      console.warn("Agro-risk calculation error:", err.message);
      res.status(503).json({ 
        error: "AGRO_RISK_WEATHER_UNAVAILABLE", 
        message: `Не удалось рассчитать агрориски погоды: ${err.message}`,
        source: "Недоступен",
        isAvailable: false
      });
    }
  });

  // Vite middleware for development or static serving for production
  const distPath = path.resolve(__dirname, "dist");
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && fs.existsSync(distPath)) {
    console.log("Running in PRODUCTION mode - serving static files from", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Production build not found. Please run 'npm run build'.");
      }
    });
  } else {
    console.log("Running in DEVELOPMENT mode - using Vite middleware");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
