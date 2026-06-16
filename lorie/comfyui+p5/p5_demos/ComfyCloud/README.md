# ComfyCloud + p5.js

Run ComfyUI workflows from a p5.js sketch using [Comfy Cloud](https://docs.comfy.org/development/cloud/api-reference). Because browsers block direct API calls (CORS), this demo uses a small local Node.js proxy server that forwards requests to `cloud.comfy.org` and injects your API key server-side — so the key never touches the browser.

> If you'd like to write code in an online editor like [OpenProcessing](https://openprocessing.org/) or the official [p5 Editor](https://editor.p5js.org), you still need to run a local Node.js proxy server.

---

## Reference docs

- [Comfy Cloud API reference](https://docs.comfy.org/development/cloud/api-reference)
- [Getting an API key](https://docs.comfy.org/development/api-development/getting-an-api-key)
- [Workflow API format](https://docs.comfy.org/development/api-development/workflow-api-format)

---

## 1. Get an API key

1. Log in at [platform.comfy.org](https://platform.comfy.org/login)
2. In the **API Keys** section click **+ New**, give it a name, and click **Generate**
3. Copy the key immediately — it is only shown once

> **Never commit your API key to git (not just this one, any API key).** The `.env` file is gitignored for this reason.

---

## 2. Install dependencies

Requires **Node.js 18 or later**.

```bash
cd p5_demos/ComfyCloud
npm install
```

---

## 3. Configure your API key

```bash
cp .env.example .env
```

Open `.env` and replace the placeholder with your real key:

```
COMFY_API_KEY=comfyui-your-key-here
PORT=3000
```

---

## 4. Start the proxy server

```bash
node server.js
```

You should see:

```
[proxy] Listening on http://localhost:3000
[proxy] Forwarding to https://cloud.comfy.org
```

Leave this terminal running while you use the sketch.

---

## 5. Open the sketch

Open `img2img_demo/index.html` in a browser (e.g. with VS Code Live Server).

The sketch connects to the proxy at `http://localhost:3000` by default — this is set at the top of `sketch.js`:

```js
const proxyUrl = "http://localhost:3000";
```

---

## 6. Generate an image

1. The left panel shows the p5.js drawing
2. Click **Generate img2img** (or press `Space`) to send the drawing to ComfyCloud
3. Wait for the result to appear in the right panel — generation typically takes 10–30 seconds
4. Press `r` to randomize the seed, `s` to save both the input and result images

The browser console will show progress:

```
[helper] executing node: 3
[helper] executing node: 8
[helper] execution complete
```

---

## File structure

```
ComfyCloud/
├── server.js                  # Local proxy server (run this first)
├── package.json
├── .env.example               # Template — copy to .env and add your key
├── .env                       # Your API key (gitignored)
└── img2img_demo/
    ├── index.html
    ├── sketch.js              # p5 drawing + workflow setup (edit this)
    ├── p5.comfyui-helper.js   # Proxy-aware ComfyCloud helper (do not edit)
    └── workflow_img2img_api.json
```

---

## How it works

```
Browser (p5 sketch)
  │  HTTP  POST /api/upload/image   (canvas → jpg)
  │  HTTP  POST /api/prompt         (workflow JSON + client_id)
  │  HTTP  GET  /api/view?filename= (download result image)
  │  WS    ws://localhost:3000/ws   (execution progress)
  ▼
server.js  (localhost:3000)
  │  adds X-API-Key header to every request
  │  follows 302 redirect on /api/view → streams image back
  │  WS: proxies messages, injects token in WS URL
  ▼
cloud.comfy.org
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `CORS` errors in browser | Proxy isn't running — start `node server.js` |
| `401 Unauthorized` in server terminal | Wrong API key in `.env` |
| `the input file doesn't exist` | Upload failed before prompt was submitted |
| No progress logs after submission | WebSocket not connecting — check server terminal for `[ws] ComfyCloud connection established` |
| `Cannot GET /` in browser | You navigated to `http://localhost:3000` directly — this is harmless, open the sketch via `index.html` instead |
