/**
 * p5.comfyui-helper (ComfyCloud proxy edition)
 * (c) Gottfried Haider 2024
 * LGPL
 * https://github.com/gohai/p5.comfyui-helper
 *
 * Adapted for use with the local ComfyCloud proxy server by Lorie Chen,
 * Teaching Assistant for Golan Levin's
 * 60-212 Creative Coding course at CMU
 *
 * Talks to server.js (localhost:3000), NOT directly to cloud.comfy.org.
 * The proxy handles auth and CORS — no API key needed in the browser.
 */

"use strict";

console.log("[helper] ComfyCloud proxy edition loaded", new Date().toISOString());

class ComfyUiP5Helper {
  // proxy_url: address of the local proxy, e.g. "http://localhost:3000"
  constructor(proxy_url) {
    this.base_url = proxy_url.replace(/\/$/, "");
    this.clientId = crypto.randomUUID();

    this.setup_websocket();
    this.outputs         = [];
    this.pending_outputs = []; // file info collected from "executed" WS messages
    this.running_prompts = {};
    this.running_uploads = {};
    console.log("[helper] client ID:", this.clientId);
  }

  _url(path) {
    return this.base_url + path;
  }

  setup_websocket() {
    const url    = new URL(this.base_url);
    const proto  = url.protocol === "https:" ? "wss:" : "ws:";
    // No token in URL — the proxy injects the API key server-side
    const wsUrl  = `${proto}//${url.host}/ws?clientId=${this.clientId}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.addEventListener("message", this.websocket_on_message.bind(this));
    this.ws.addEventListener("error",   this.websocket_on_error.bind(this));
    this.ws.addEventListener("close",   this.websocket_on_close.bind(this));
  }

  async websocket_on_message(event) {
    if (typeof event.data !== "string") return;

    const data    = JSON.parse(event.data);
    const msgType = data.type;
    const msgData = data.data ?? {};

    // ignore messages that belong to a different job
    if (msgData.prompt_id && msgData.prompt_id !== this.prompt_id) return;

    if (msgType === "executing") {
      if (msgData.node) console.log(`[helper] executing node: ${msgData.node}`);

    } else if (msgType === "progress") {
      if (this.running_prompts?.[msgData.prompt_id]?.status_callback) {
        this.running_prompts[msgData.prompt_id].status_callback(msgData);
      }

    } else if (msgType === "executed" && msgData.output) {
      this.pending_outputs.push({ node: msgData.node, output: msgData.output });

    } else if (msgType === "execution_success") {
      console.log("[helper] execution complete");
      this._resolve_outputs();
      if (this.callback) this.callback(this.outputs);
      this.resolve(this.outputs);
      this.outputs         = [];
      this.pending_outputs = [];
      delete this.running_prompts[this.prompt_id];

    } else if (msgType === "execution_error") {
      const errorMsg = msgData.exception_message ?? "Unknown error";
      console.warn("[helper] execution error:", errorMsg);
      if (this.callback) this.callback([], errorMsg);
      this.reject(new Error(`Execution error: ${errorMsg}`));
      this.outputs         = [];
      this.pending_outputs = [];
    }
  }

  // The proxy serves images directly at /api/view — just build the URL.
  // No async download or redirect-following needed here.
  _resolve_outputs() {
    for (const { node, output } of this.pending_outputs) {
      for (const key of ["images", "video", "audio"]) {
        for (const fileInfo of output[key] ?? []) {
          const params = new URLSearchParams({
            filename: fileInfo.filename,
            subfolder: fileInfo.subfolder ?? "",
            type: fileInfo.type ?? "output",
          });
          this.outputs.push({
            node: parseInt(node),
            src:  this._url("/api/view?" + params),
          });
        }
      }
    }
  }

  websocket_on_error(event) {
    console.warn("[helper] WebSocket error:", event);
    this.ws.close();
  }

  websocket_on_close(event) {
    setTimeout(() => {
      console.log("[helper] Reconnecting...");
      this.setup_websocket();
    }, 1000);
  }

  async run(workflow, callback, status_callback) {
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    // wait for WebSocket to be open before submitting
    while (this.ws.readyState !== WebSocket.OPEN) {
      console.log("[helper] waiting for WebSocket... state:", this.ws.readyState);
      await delay(200);
    }
    while (Object.values(this.running_uploads).length > 0) {
      await delay(100);
    }

    this.callback        = callback;
    this.outputs         = [];
    this.pending_outputs = [];
    this.prompt_id       = await this.prompt(workflow, status_callback);
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject  = reject;
    });
  }

  async prompt(workflow, status_callback) {
    const options = {
      method:  "POST",
      body:    JSON.stringify({ prompt: workflow, client_id: this.clientId }),
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
    };

    const url = this._url("/api/prompt");
    console.log("[helper] POST", url);

    const res  = await fetch(url, options);
    const text = await res.text();
    console.log("[helper] /prompt status", res.status, "body:", text.slice(0, 200));

    let data;
    try   { data = text ? JSON.parse(text) : {}; }
    catch (e) { throw new Error("Non-JSON response from /prompt: " + e.message); }

    if (!res.ok) {
      if (data?.error) {
        throw new Error(`${data.error.type}: ${data.error.message} (${data.error.details})`);
      } else {
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
    }

    this.running_prompts[data.prompt_id] = { status_callback };
    return data.prompt_id;
  }

  upload_canvas(canvas, filename) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          const formData = new FormData();
          formData.append("image", blob, filename);
          formData.append("type", "input");

          fetch(this._url("/api/upload/image"), { method: "POST", body: formData })
          .then((res)  => res.text())
          .then((t)    => JSON.parse(t))
          .then((json) => resolve(json.name))
          .catch((err) => { console.warn("[helper] Upload failed:", err); reject(err); });
        },
        "image/jpeg",
        0.95
      );
    });
  }

  image(img) {
    if (!img.loadPixels) {
      throw "image() is only implemented for p5 Graphics/Renderer/Image objects";
    }
    img.loadPixels();
    const canvas   = img.canvas;
    const filename = "p5.comfyui-helper-" + crypto.randomUUID() + ".jpg";

    this.running_uploads[filename] = true;
    // Return the Promise so the sketch can await the server-assigned name.
    // ComfyCloud may change the filename on upload (e.g. to avoid conflicts),
    // so we must use json.name — not the locally generated filename.
    return this.upload_canvas(canvas, filename).finally(() => {
      delete this.running_uploads[filename];
    });
  }
}
