import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const DATA_DIR = path.join(process.cwd(), "data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/dataset", (req, res) => {
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const filePath = path.join(DATA_DIR, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(req.body));
      res.json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save dataset" });
    }
  });

  app.get("/api/dataset/:id", (req, res) => {
    try {
      const { id } = req.params;
      const filePath = path.join(DATA_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        res.json(JSON.parse(data));
      } else {
        res.status(404).json({ error: "Dataset not found" });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to read dataset" });
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
