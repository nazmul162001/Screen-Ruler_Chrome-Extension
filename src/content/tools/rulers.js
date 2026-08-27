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
  columns: 12,
  gutter: 24,
  maxWidth: 1200,
  node: null,

  enable(shadow, opts) {
    this.disable();
    if (opts) Object.assign(this, opts);
    this.enabled = true;
    this.node = document.createElement("div");
    this.node.className = "sr-grid";
    this.paint();
    shadow.appendChild(this.node);
    window.addEventListener("resize", this._onResize = () => this.paint());
  },

  paint() {
    if (!this.node) return;
    const vw = window.innerWidth;
    const width = Math.min(this.maxWidth, vw - 32);
    const col = (width - this.gutter * (this.columns - 1)) / this.columns;
    const offset = (vw - width) / 2;
    const stops = [];
    for (let i = 0; i < this.columns; i++) {
      const x = offset + i * (col + this.gutter);
      stops.push(`transparent ${x}px, rgba(59,130,246,0.10) ${x}px, rgba(59,130,246,0.10) ${x + col}px, transparent ${x + col}px`);
    }
    this.node.style.background = `linear-gradient(90deg, ${stops.join(",")})`;
  },

  disable() {
    this.enabled = false;
    if (this.node) this.node.remove();
    this.node = null;
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
