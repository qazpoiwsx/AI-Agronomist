import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  const dbDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
  }
  const db = new Database(path.join(dbDir, "plant_health.db"));

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      userId TEXT,
      timestamp INTEGER,
      data TEXT
    )
  `);

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/history", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const stmt = db.prepare("SELECT data FROM history WHERE userId = ? ORDER BY timestamp DESC");
    const rows = stmt.all(userId);
    const history = rows.map((row: any) => JSON.parse(row.data));
    res.json(history);
  });

  app.post("/api/history", (req, res) => {
    const { id, userId, timestamp, ...data } = req.body;
    if (!id || !userId) return res.status(400).json({ error: "id and userId are required" });

    const stmt = db.prepare("INSERT OR REPLACE INTO history (id, userId, timestamp, data) VALUES (?, ?, ?, ?)");
    stmt.run(id, userId, timestamp || Date.now(), JSON.stringify({ id, timestamp, ...data }));
    res.json({ success: true });
  });

  app.delete("/api/history/:id", (req, res) => {
    const { id } = req.params;
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const stmt = db.prepare("DELETE FROM history WHERE id = ? AND userId = ?");
    stmt.run(id, userId);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
