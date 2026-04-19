import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import archiver from "archiver";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/admin/download-project", async (req, res) => {
    const adminEmail = req.query.email;
    if (adminEmail !== 'imdadsadiq27@gmail.com') {
      return res.status(403).json({ error: "Unauthorized" });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=shopgenie-source.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error("Archive Error:", err);
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // Add files and folders
    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        'project.zip',
        '.env',
        'android/app/build/**',
        'android/.gradle/**',
        'android/build/**'
      ]
    });

    archive.finalize();
  });

  app.post("/api/remove-bg", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }

      const apiKey = process.env.REMOVE_BG_API_KEY;
      if (!apiKey) {
        console.error("REMOVE_BG_API_KEY is missing");
        return res.status(500).json({ error: "Background removal service not configured" });
      }

      // remove.bg API expects image as file or URL
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      const formData = new FormData();
      formData.append('size', 'auto');
      formData.append('image_file', buffer, { filename: 'image.jpg' });

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': apiKey,
        },
        responseType: 'arraybuffer',
      });

      const resultBase64 = Buffer.from(response.data, 'binary').toString('base64');
      res.json({ image: `data:image/png;base64,${resultBase64}` });
    } catch (error: any) {
      console.error("Background removal error:", error.response?.data?.toString() || error.message);
      res.status(500).json({ error: "Failed to remove background" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
