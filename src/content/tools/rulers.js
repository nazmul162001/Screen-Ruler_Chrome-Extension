"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.rulers = {
  enabled: false,
  guides: [],
  nodes: {},
  dragging: null,

  enable(shadow) {
    if (this.enabled) return;
    this.shadow = shadow;
    this.enabled = true;
    this.nodes.corner = Object.assign(document.createElement("div"), { className: "sr-ruler-corner" });
    this.nodes.top = Object.assign(document.createElement("div"), { className: "sr-ruler-top" });
    this.nodes.left = Object.assign(document.createElement("div"), { className: "sr-ruler-left" });
    this.nodes.cross = Object.assign(document.createElement("div"), { className: "sr-crosshair" });
    this.nodes.cross.innerHTML = '<div class="x"></div><div class="y"></div>';
    this.nodes.guides = document.createElement("div");
    ["corner", "top", "left", "cross"].forEach((k) => shadow.appendChild(this.nodes[k]));
    shadow.appendChild(this.nodes.guides);
    this.drawTicks();
    this.nodes.top.addEventListener("mousedown", (e) => this.addGuide("h", e.clientY));
    this.nodes.left.addEventListener("mousedown", (e) => this.addGuide("v", e.clientX));
    this._onMove = (e) => this.onMove(e);
    this._onUp = () => { this.dragging = null; };
    window.addEventListener("mousemove", this._onMove, true);
    window.addEventListener("mouseup", this._onUp, true);
    window.addEventListener("resize", this._onResize = () => this.drawTicks());
  },

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    Object.values(this.nodes).forEach((n) => n && n.remove());
    this.nodes = {};
    this.guides = [];
    window.removeEventListener("mousemove", this._onMove, true);
    window.removeEventListener("mouseup", this._onUp, true);
    window.removeEventListener("resize", this._onResize);
  },

  drawTicks() {
    if (!this.nodes.top) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const top = this.nodes.top;
    const left = this.nodes.left;
    top.innerHTML = "";
    left.innerHTML = "";
    for (let x = 0; x < w; x += 10) {
      const tick = document.createElement("div");
      tick.className = "sr-ruler-tick";
      const major = x % 50 === 0;
      Object.assign(tick.style, { left: `${x}px`, top: major ? "8px" : "14px", width: "1px", height: major ? "12px" : "6px" });
      top.appendChild(tick);
      if (x % 100 === 0) {
        const num = document.createElement("div");
        num.className = "sr-ruler-num";
        num.textContent = String(x);
        Object.assign(num.style, { left: `${x + 2}px`, top: "1px" });
        top.appendChild(num);
      }
    }
    for (let y = 0; y < h; y += 10) {
      const tick = document.createElement("div");
      tick.className = "sr-ruler-tick";
      const major = y % 50 === 0;
      Object.assign(tick.style, { top: `${y}px`, left: major ? "8px" : "14px", height: "1px", width: major ? "12px" : "6px" });
      left.appendChild(tick);
      if (y % 100 === 0) {
        const num = document.createElement("div");
        num.className = "sr-ruler-num";
        num.textContent = String(y);
        Object.assign(num.style, { top: `${y + 2}px`, left: "1px", writingMode: "vertical-rl" });
        left.appendChild(num);
      }
    }
  },

  addGuide(axis, pos) {
    const line = document.createElement("div");
    line.className = `sr-guide-line ${axis}`;
    if (axis === "h") line.style.top = `${pos}px`;
    else line.style.left = `${pos}px`;
    const rec = { axis, pos, el: line };
    line.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dragging = rec;
    });
    line.addEventListener("dblclick", (e) => {
      e.preventDefault();
      line.remove();
      this.guides = this.guides.filter((g) => g !== rec);
    });
    this.nodes.guides.appendChild(line);
    this.guides.push(rec);
    this.dragging = rec;
  },

  onMove(e) {
    if (!this.enabled) return;
    const x = this.nodes.cross.querySelector(".x");
    const y = this.nodes.cross.querySelector(".y");
    if (x) x.style.top = `${e.clientY}px`;
    if (y) y.style.left = `${e.clientX}px`;
    if (this.dragging) {
      if (this.dragging.axis === "h") {
        this.dragging.pos = e.clientY;
        this.dragging.el.style.top = `${e.clientY}px`;
      } else {
        this.dragging.pos = e.clientX;
        this.dragging.el.style.left = `${e.clientX}px`;
      }
    }
  },
};

SR.grid = {
  enabled: false,
  visible: true,
  columns: 8,
  gutter: 20,
  margin: 40,
  maxWidth: "auto",
  color: "#FC48FF",
  opacity: 35,
  node: null,
  panel: null,

  enable(shadow) {
    if (this.enabled) return;
    this.shadow = shadow;
    this.enabled = true;
    this.visible = true;
    this.node = document.createElement("div");
    this.node.className = "sr-grid";
    shadow.appendChild(this.node);
    this.mountPanel(shadow);
    this.paint();
    window.addEventListener("resize", this._onResize = () => this.paint());
  },

  mountPanel(shadow) {
    const panel = document.createElement("div");
    panel.className = "sr-grid-panel";
    const cols = [2, 4, 6, 8, 12, 16, 24].map((n) =>
      `<option value="${n}"${n === this.columns ? " selected" : ""}>${n}</option>`
    ).join("");
    const maxVal = this.maxWidth === "auto" || this.maxWidth == null ? "auto" : String(this.maxWidth);
    panel.innerHTML = `
      <div class="sr-grid-panel-head">
        <strong>Layout Grid</strong>
        <button type="button" data-eye title="Show / hide grid" aria-label="Toggle grid visibility">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button type="button" data-close title="Close panel" aria-label="Close">×</button>
      </div>
      <label class="sr-grid-row"><span>Columns</span>
        <select data-field="columns">${cols}</select>
      </label>
      <label class="sr-grid-row"><span>Max Width</span>
        <span class="sr-grid-unit"><input data-field="maxWidth" value="${maxVal}" spellcheck="false" /><i>px</i></span>
      </label>
      <label class="sr-grid-row"><span>Gutter</span>
        <span class="sr-grid-unit"><input data-field="gutter" type="number" min="0" max="80" value="${this.gutter}" /><i>px</i></span>
      </label>
      <label class="sr-grid-row"><span>Margin</span>
        <span class="sr-grid-unit"><input data-field="margin" type="number" min="0" max="200" value="${this.margin}" /><i>px</i></span>
      </label>
      <label class="sr-grid-row"><span>Color</span>
        <span class="sr-grid-color">
          <input data-field="colorPick" type="color" value="${this.normalizeHex(this.color)}" />
          <input data-field="color" value="${this.normalizeHex(this.color).replace("#", "")}" spellcheck="false" />
        </span>
      </label>
      <label class="sr-grid-row sr-grid-opacity"><span>Opacity</span>
        <input data-field="opacity" type="range" min="4" max="80" value="${this.opacity}" />
      </label>`;
    panel.addEventListener("mousedown", (e) => e.stopPropagation());
    panel.addEventListener("click", (e) => e.stopPropagation());
    panel.addEventListener("keydown", (e) => e.stopPropagation());
    panel.addEventListener("keyup", (e) => e.stopPropagation());
    panel.addEventListener("keypress", (e) => e.stopPropagation());
    panel.querySelector("[data-eye]").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setVisible(!this.visible);
    });
    panel.querySelector("[data-close]").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hidePanel();
    });
    panel.querySelector("[data-field=columns]").addEventListener("change", (e) => {
      this.columns = Math.max(2, parseInt(e.target.value, 10) || 8);
      this.paint();
    });
    panel.querySelector("[data-field=maxWidth]").addEventListener("input", (e) => {
      const raw = String(e.target.value).trim().toLowerCase();
      if (!raw || raw === "auto") this.maxWidth = "auto";
      else {
        const n = parseInt(raw, 10);
        this.maxWidth = Number.isFinite(n) && n > 0 ? n : "auto";
      }
      this.paint();
    });
    panel.querySelector("[data-field=gutter]").addEventListener("input", (e) => {
      this.gutter = Math.max(0, parseInt(e.target.value, 10) || 0);
      this.paint();
    });
    panel.querySelector("[data-field=margin]").addEventListener("input", (e) => {
      this.margin = Math.max(0, parseInt(e.target.value, 10) || 0);
      this.paint();
    });
    const colorText = panel.querySelector("[data-field=color]");
    const colorPick = panel.querySelector("[data-field=colorPick]");
    colorPick.addEventListener("input", (e) => {
      this.color = this.normalizeHex(e.target.value);
      colorText.value = this.color.replace("#", "");
      this.paint();
    });
    colorText.addEventListener("input", (e) => {
      this.color = this.normalizeHex(e.target.value);
      colorPick.value = this.normalizeHex(this.color);
      this.paint();
    });
    panel.querySelector("[data-field=opacity]").addEventListener("input", (e) => {
      this.opacity = Math.max(4, Math.min(80, parseInt(e.target.value, 10) || 35));
      this.paint();
    });
    shadow.appendChild(panel);
    this.panel = panel;
    this.syncEye();
  },

  normalizeHex(value) {
    let v = String(value || "").trim();
    if (v.charAt(0) !== "#") v = `#${v}`;
    const parsed = SR.color.parseRgb(v);
    return parsed ? SR.color.toHex({ ...parsed, a: 1 }) : "#FC48FF";
  },

  setVisible(on) {
    this.visible = !!on;
    if (this.node) this.node.style.display = this.visible ? "" : "none";
    this.syncEye();
  },

  syncEye() {
    const btn = this.panel && this.panel.querySelector("[data-eye]");
    if (!btn) return;
    btn.classList.toggle("is-off", !this.visible);
    btn.innerHTML = this.visible
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l18 18"/><path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4"/><path d="M9.9 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-4.2 4.8"/><path d="M6.1 6.1A18 18 0 0 0 2 12s4 7 10 7a11 11 0 0 0 3.2-.5"/></svg>';
  },

  hidePanel() {
    if (this.panel) this.panel.style.display = "none";
  },

  showPanel() {
    if (this.panel) this.panel.style.display = "";
  },

  paint() {
    if (!this.node) return;
    const vw = window.innerWidth;
    const margin = Number(this.margin) || 0;
    const gutter = Number(this.gutter) || 0;
    const columns = Math.max(2, Number(this.columns) || 8);
    let inner = Math.max(0, vw - margin * 2);
    if (this.maxWidth !== "auto" && Number(this.maxWidth) > 0) {
      inner = Math.min(inner, Number(this.maxWidth));
    }
    const offset = (vw - inner) / 2;
    const col = columns > 0 ? (inner - gutter * (columns - 1)) / columns : inner;
    const rgb = SR.color.parseRgb(this.normalizeHex(this.color)) || { r: 252, g: 72, b: 255 };
    const a = Math.max(0.04, Math.min(0.8, (Number(this.opacity) || 35) / 100));
    const fill = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`;
    const stops = [];
    for (let i = 0; i < columns; i++) {
      const x = offset + i * (col + gutter);
      const x2 = x + Math.max(0, col);
      stops.push(`transparent ${x}px, ${fill} ${x}px, ${fill} ${x2}px, transparent ${x2}px`);
    }
    this.node.style.background = `linear-gradient(90deg, ${stops.join(",")})`;
  },

  disable() {
    this.enabled = false;
    this.visible = true;
    if (this.node) this.node.remove();
    if (this.panel) this.panel.remove();
    this.node = null;
    this.panel = null;
    window.removeEventListener("resize", this._onResize);
  },
};

SR.xray = {
  enabled: false,
  style: null,
  enable() {
    this.disable();
    this.enabled = true;
    this.style = document.createElement("style");
    this.style.id = "sr-xray-style";
    this.style.textContent = `html body *:not(screen-ruler-root):not(screen-ruler-root *){outline:1px solid rgba(96,165,250,0.35)!important;outline-offset:-1px;}`;
    document.documentElement.appendChild(this.style);
  },
  disable() {
    this.enabled = false;
    if (this.style) this.style.remove();
    this.style = null;
  },
};
