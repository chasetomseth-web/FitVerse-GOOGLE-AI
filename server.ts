import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      nodeEnv: process.env.NODE_ENV
    });
  });

  // Proxy for Open Food Facts to avoid CORS issues
  app.get("/api/off/search", async (req, res) => {
    try {
      const { q, page_size } = req.query;
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q as string)}&json=1&page_size=${page_size || 10}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "OFF API error" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("OFF Proxy Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/off/product/:barcode", async (req, res) => {
    try {
      const { barcode } = req.params;
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ error: "OFF API error" });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("OFF Proxy Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
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

startServer();
