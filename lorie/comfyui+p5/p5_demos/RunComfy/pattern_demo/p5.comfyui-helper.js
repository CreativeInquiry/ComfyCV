/**
 * p5.comfyui-helper
 * (c) Gottfried Haider 2024
 * LGPL
 * https://github.com/gohai/p5.comfyui-helper
 * 
 * 
 * edited by Lorie Chen, 
 * Teaching Assistant for Golan Levin's 
 * 60-212 Creative Coding course at CMU, 
 * with help from ChatGPT
 */

"use strict";

// at top of file:
console.log("[helper] loaded", new Date().toISOString());

// Decide if a text response looks like HTML
function _looksLikeHtml(text) {
  const head = (text || "").trim().slice(0, 32).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

class ComfyUiP5Helper {
  constructor(base_url) {
    this.base_url = base_url.replace(/\/$/, "");
    this.apiPrefix = "";           // "", or "/api" after detection
    this.apiReady = this._detectApiPrefix();  // start detection ASAP

    this.setup_websocket();
    this.outputs = [];
    this.running_prompts = {};
    this.running_uploads = {};
    console.log("[helper] base_url =", this.base_url);
  }

  _url(path) {                     // build full HTTP URL
    return this.base_url + this.apiPrefix + path;
  }

  async _detectApiPrefix() {
    // Try /object_info first (no prefix)
    try {
      const r1 = await fetch(this.base_url + "/object_info");
      const t1 = await r1.text();
      if (r1.ok && !_looksLikeHtml(t1)) { this.apiPrefix = ""; return; }
    } catch {}
    // Fall back to /api/object_info
    try {
      const r2 = await fetch(this.base_url + "/api/object_info");
      const t2 = await r2.text();
      if (r2.ok && !_looksLikeHtml(t2)) { this.apiPrefix = "/api"; return; }
    } catch {}
    // If both fail, keep "" and let normal error handling surface details
    console.warn("[helper] Could not auto-detect API prefix; proceeding without it");
}

  setup_websocket() {
    const url = new URL(this.base_url);  // e.g. https://host
    const wsProto = url.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${url.host}/ws`;   // wss://host/ws
    this.ws = new WebSocket(wsUrl);
    
    // this.ws = new WebSocket(this.base_url + "/ws");
    this.ws.addEventListener("message", this.websocket_on_message.bind(this));
    this.ws.addEventListener("error", this.websocket_on_error.bind(this));
    this.ws.addEventListener("close", this.websocket_on_close.bind(this));
    this.sid = null; // invalidate for reconnection
  }

  async websocket_on_message(event) {
    if (typeof event.data == "string") {
      const data = JSON.parse(event.data);
      if (data.type == "status") {
        // ComfyUI sends the client id (once) after establishing the connection
        if (data.data.sid && !this.sid) {
          this.sid = data.data.sid;
        }
      } else if (data.type == "execution_start") {
        if (data.data.prompt_id == this.prompt_id) {
          //console.log("Execution starts");
        }
      } else if (data.type == "progress") {
        // this is being sent periodically during processing
        this.current_prompt = data.data.prompt_id;
        this.current_node = data.data.node;

        // if there's a status callback set up for the current prompt, run it
        if (this.running_prompts?.[this.current_prompt]?.status_callback) {
          this.running_prompts[this.current_prompt].status_callback(data.data);
        }
      } else if (data.type == "execution_success") {
        if (data.data.prompt_id == this.prompt_id) {
          //console.log("Execution finished");
          await this.get_outputs_from_history(this.prompt_id);
          if (this.callback) {
            this.callback(this.outputs);
          }
          this.resolve(this.outputs);
          this.outputs = [];
          delete this.running_prompts[this.current_prompt];
        }
      } else if (data.type == "execution_interrupted") {
        console.warn("Execution was interrupted");
        if (this.callback) {
          this.callback([], "Execution was interrupted");
        }
        this.reject("Execution was interrupted");
        this.outputs = [];
      } else if (data.type == "execution_error") {
        console.warn(data);
        if (this.callback) {
          this.callback([], "Error during execution");
        }
        this.reject("Error during execution");
      } else {
        //console.log(data);
      }
    }

    if (event.data instanceof Blob) {
      if (this.current_prompt == this.prompt_id) {
        const blob_url = URL.createObjectURL(event.data.slice(8));
        this.outputs.push({
          node: parseInt(this.current_node),
          src: blob_url,
        });
      }
    }
  }

  websocket_on_error(event) {
    console.warn(event);
    this.ws.close();
  }

  websocket_on_close(event) {
    setTimeout(() => {
      console.log("Reconnecting to " + this.base_url);
      this.setup_websocket();
    }, 1000);
  }

  async get_outputs_from_history(prompt_id) {
    try {
      const res = await fetch(this._url("/history/" + prompt_id));
      const text = await res.text();
      const historyAll = JSON.parse(text);
      const history = historyAll[prompt_id];

      const image_outputs = Object.entries(history.outputs)
        .filter(([_, v]) => v?.images?.length > 0)
        .reduce((acc, [k, v]) => { acc[k] = v.images.filter(d => d.type === "output"); return acc; }, {});

      for (const [node_number, images] of Object.entries(image_outputs)) {
        for (const image of images) {
          const params = new URLSearchParams(image).toString();
          const blob_url = this._url("/view?" + encodeURI(params));
          this.outputs.push({ node: parseInt(node_number), src: blob_url });
        }
      }
    } catch (e) {
      console.warn(e);
      throw e;
    }
  }

  async run(workflow, callback, status_callback) {
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    while (!this.sid || Object.values(this.running_uploads).length > 0) {
      await delay(100);
    }
    await this.apiReady; // ensure apiPrefix is set before HTTP calls

    this.callback = callback;
    this.prompt_id = await this.prompt(workflow, status_callback);
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  async prompt(workflow, status_callback) {
    const options = {
      method: "POST",
      body: JSON.stringify({ prompt: workflow, client_id: this.sid }),
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      redirect: "follow",
    };

    const url = this._url("/prompt");
    console.log("[helper] POST", url);

    const res = await fetch(url, options);
    const text = await res.text();
    console.log("[helper] /prompt status", res.status, "body:", text.slice(0, 200));

    let data;
    try { data = text ? JSON.parse(text) : {}; }
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

          let options = {
            method: "POST",
            body: formData,
            redirect: "follow",
          };

          fetch(this._url("/upload/image"), options)
          .then((res) => res.text())
          .then((t) => JSON.parse(t))
          .then((json) => resolve(json.name))
          .catch((err) => { console.warn("Upload failed:", err); reject(err); });
        },
        "image/jpeg",
        0.95
      );
    });
  }

  image(img) {
    let filename;
    if (img.loadPixels) {
      img.loadPixels();
      let canvas = img.canvas;

      // generate a random filename:
      filename = "p5.comfyui-helper-";
      if (crypto) {
        filename += crypto.randomUUID();
      } else {
        filename += Math.random().toString(36).substring(2);
      }
      filename += ".jpg";

      // start upload:
      this.running_uploads[filename] = true;
      this.upload_canvas(canvas, filename).finally(() => {
        delete this.running_uploads[filename];
      });

      return filename;
    } else {
      throw "image() is currently only implemented for p5 Graphics/Renderer/Image objects";
    }
  }
}
