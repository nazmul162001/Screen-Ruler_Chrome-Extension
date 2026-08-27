"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.stage = {
  enabled: false,
  mode: "breakpoints",
  zoom: 0.65,
  root: null,
  frames: [],

  enable(shadow, mode) {
    this.disable();
    this.enabled = true;
    this.mode = "breakpoints";
    this.shadow = shadow;
    this.zoom = 0.65;
    this.root = document.createElement("div");
    this.root.className = "sr-stage";
    this.root.innerHTML = `
      <div class="sr-stage-top">
        <div class="sr-stage-zoom">
          <button type="button" data-zoom="-">−</button>
          <span data-zoom-label>65%</span>
          <button type="button" data-zoom="+">+</button>
        </div>
        <button type="button" data-refresh title="Reload all viewports">↻</button>
        <input class="sr-stage-url" value="${location.href}" spellcheck="false" />
        <div class="sr-stage-top-right">
          <button type="button" data-add title="Add viewport">+</button>
        </div>
      </div>
      <div class="sr-stage-frames"></div>
      <div class="sr-stage-foot" hidden></div>`;
    shadow.appendChild(this.root);

    this.root.querySelector("[data-zoom='-']").addEventListener("click", () => this.setZoom(this.zoom - 0.05));
    this.root.querySelector("[data-zoom='+']").addEventListener("click", () => this.setZoom(this.zoom + 0.05));
    this.root.querySelector("[data-refresh]").addEventListener("click", () => this.reloadAll());
    this.root.querySelector("[data-add]").addEventListener("click", () => this.addCustom());
    const url = this.root.querySelector(".sr-stage-url");
    url.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.navigate(url.value.trim());
        e.stopPropagation();
      }
    });

    const presets = this.breakpointPresets();
    presets.forEach((p) => this.addFrame(p));
    this.updateFoot();
  },

  breakpointPresets() {
    const bps = (SR.css.breakpoints() || []).map((b) => b.px);
    const unique = [...new Set(bps)].filter((n) => n >= 320 && n <= 1920);
    const widths = unique.length ? unique.slice(0, 6) : [375, 500, 640, 768, 1024];
    return widths.map((w) => ({
      name: `${w}`,
      width: w,
      height: w <= 500 ? 844 : 1024,
    }));
  },

  addFrame(preset) {
    const frame = document.createElement("div");
    frame.className = "sr-frame";
    const width = preset.width;
    const height = preset.height;
    frame.innerHTML = `
      <div class="sr-frame-bar">
        <span class="sr-frame-title">${preset.name} (${width} × ${height})</span>
        <span class="sr-frame-actions">
          <button type="button" data-rotate title="Rotate">↻</button>
          <button type="button" data-close-frame title="Close">×</button>
        </span>
      </div>
      <div class="sr-frame-body">
        <iframe src="${this.embedUrl()}" width="${width}" height="${height}"></iframe>
      </div>`;
    const rec = { el: frame, width, height, name: preset.name, rotated: false };
    frame.querySelector("[data-rotate]").addEventListener("click", () => this.rotate(rec));
    frame.querySelector("[data-close-frame]").addEventListener("click", () => {
      frame.remove();
      this.frames = this.frames.filter((f) => f !== rec);
      this.updateFoot();
    });
    this.root.querySelector(".sr-stage-frames").appendChild(frame);
    this.frames.push(rec);
    this.applyZoom(rec);
    this.bindScrollSync(rec);
  },

  bindScrollSync(rec) {
    const iframe = rec.el.querySelector("iframe");
    const bind = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) return;
        win.addEventListener("scroll", () => this.onFrameScroll(win), { passive: true });
      } catch (_) { /* cross-origin */ }
    };
    iframe.addEventListener("load", bind);
    try {
      if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") bind();
    } catch (_) { /* ignore */ }
  },

  onFrameScroll(sourceWin) {
    if (this._syncing) return;
    this._syncing = true;
    const x = sourceWin.scrollX;
    const y = sourceWin.scrollY;
    this.frames.forEach((f) => {
      try {
        const w = f.el.querySelector("iframe").contentWindow;
        if (w && w !== sourceWin) w.scrollTo(x, y);
      } catch (_) { /* ignore */ }
    });
    requestAnimationFrame(() => { this._syncing = false; });
  },

  embedUrl() {
    try {
      const u = new URL(location.href);
      u.searchParams.set("sr-embed", "1");
      return u.toString();
    } catch (_) {
      return location.href;
    }
  },

  applyZoom(rec) {
    const iframe = rec.el.querySelector("iframe");
    const body = rec.el.querySelector(".sr-frame-body");
    iframe.style.width = `${rec.width}px`;
    iframe.style.height = `${rec.height}px`;
    iframe.style.transform = `scale(${this.zoom})`;
    iframe.style.transformOrigin = "top left";
    body.style.width = `${Math.round(rec.width * this.zoom)}px`;
    body.style.height = `${Math.round(rec.height * this.zoom)}px`;
    rec.el.querySelector(".sr-frame-title").textContent = `${rec.name} (${rec.width} × ${rec.height})`;
  },

  setZoom(next) {
    this.zoom = Math.min(1.25, Math.max(0.25, Math.round(next * 20) / 20));
    this.root.querySelector("[data-zoom-label]").textContent = `${Math.round(this.zoom * 100)}%`;
    this.frames.forEach((f) => this.applyZoom(f));
  },

  rotate(rec) {
    const w = rec.width;
    rec.width = rec.height;
    rec.height = w;
    rec.rotated = !rec.rotated;
    this.applyZoom(rec);
  },

  reloadAll() {
    this.frames.forEach((f) => {
      const iframe = f.el.querySelector("iframe");
      iframe.src = iframe.src;
    });
  },

  navigate(href) {
    let url = href;
    try { url = new URL(href, location.href).toString(); } catch (_) { return; }
    this.frames.forEach((f) => { f.el.querySelector("iframe").src = url; });
  },

  addCustom() {
    const raw = window.prompt("Viewport width × height", "1024x768");
    if (!raw) return;
    const m = String(raw).match(/(\d+)\s*[x×]\s*(\d+)/i);
    if (!m) return;
    this.addFrame({ name: "Custom", width: +m[1], height: +m[2] });
    this.updateFoot();
  },

  updateFoot() {
    const foot = this.root.querySelector(".sr-stage-foot");
    foot.hidden = false;
    foot.textContent = `Breakpoints (${this.frames.length})`;
  },

  disable() {
    this.enabled = false;
    if (this.root) this.root.remove();
    this.root = null;
    this.frames = [];
  },
};

SR.responsive = {
  enabled: false,
  enable(shadow) {
    this.enabled = true;
    SR.stage.enable(shadow, "breakpoints");
  },
  disable() {
    this.enabled = false;
    SR.stage.disable();
  },
};
