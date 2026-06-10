/**
 * ComfyCloud local proxy server
 *
 * Forwards requests from the browser (p5.js) to cloud.comfy.org,
 * adding the API key and CORS headers so browsers aren't blocked.
 *
 * Usage:
 *   1. Copy .env.example to .env and fill in your API key
 *   2. npm install
 *   3. node server.js
 *   4. Open your p5 sketch — it talks to http://localhost:3000
 *
 * Requires Node 18+ (native fetch, native crypto)
 */

require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const multer    = require("multer");
const http      = require("http");
const { WebSocketServer } = require("ws");
const WebSocket = require("ws");
const { randomUUID } = require("crypto");

const PORT        = process.env.PORT || 3000;
const COMFY_CLOUD = "https://cloud.comfy.org";
const API_KEY     = process.env.COMFY_API_KEY;

if (!API_KEY) {
  console.error("[proxy] Error: COMFY_API_KEY is not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ── POST /api/prompt ───────────────────────────────────────────────────────
app.post("/api/prompt", async (req, res) => {
  try {
    const r = await fetch(`${COMFY_CLOUD}/api/prompt`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
      body:    JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error("[proxy] /api/prompt error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/upload/image ─────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });
app.post("/api/upload/image", upload.single("image"), async (req, res) => {
  try {
    const formData = new FormData();
    formData.append(
      "image",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );
    formData.append("type", req.body.type || "input");

    const r = await fetch(`${COMFY_CLOUD}/api/upload/image`, {
      method:  "POST",
      headers: { "X-API-Key": API_KEY },
      body:    formData,
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    console.error("[proxy] /api/upload/image error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/view ──────────────────────────────────────────────────────────
// ComfyCloud returns a 302 → signed URL. We follow the redirect server-side
// and stream the image bytes back so the browser never sees the redirect.
app.get("/api/view", async (req, res) => {
  try {
    const params = new URLSearchParams(req.query).toString();
    const r = await fetch(`${COMFY_CLOUD}/api/view?${params}`, {
      headers:  { "X-API-Key": API_KEY },
      redirect: "follow",
    });
    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.status(200).send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error("[proxy] /api/view error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── WebSocket proxy ────────────────────────────────────────────────────────
// Browser connects to ws://localhost:3000/ws?clientId=UUID (no token needed).
// Proxy opens the real connection to ComfyCloud with the server-side API key.
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (clientWs, req) => {
  const url      = new URL("http://localhost" + req.url);
  const clientId = url.searchParams.get("clientId") || randomUUID();
  const comfyUrl = `wss://cloud.comfy.org/ws?clientId=${clientId}&token=${API_KEY}`;

  console.log("[ws] client connected, clientId:", clientId);
  console.log("[ws] connecting to ComfyCloud...");
  const comfyWs = new WebSocket(comfyUrl);

  comfyWs.on("open", () => {
    console.log("[ws] ComfyCloud connection established");
    clientWs.on("message", (data, isBinary) => {
      if (comfyWs.readyState === WebSocket.OPEN) comfyWs.send(data, { binary: isBinary });
    });
  });

  comfyWs.on("message", (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data, { binary: isBinary });
  });

  comfyWs.on("error", (err) => {
    console.error("[ws] ComfyCloud error:", err.message);
    clientWs.close();
  });

  comfyWs.on("close", () => clientWs.close());
  clientWs.on("close",  () => { if (comfyWs.readyState === WebSocket.OPEN) comfyWs.close(); });
  clientWs.on("error",  () => { if (comfyWs.readyState === WebSocket.OPEN) comfyWs.close(); });
});

server.listen(PORT, () => {
  console.log(`[proxy] Listening on http://localhost:${PORT}`);
  console.log(`[proxy] Forwarding to ${COMFY_CLOUD}`);
});
