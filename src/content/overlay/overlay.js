"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.overlay = {
  host: null,
  shadow: null,
  layer: null,
  extra: null,
  cssLoaded: false,

  async mount() {
    if (this.host && document.documentElement.contains(this.host)) return this.shadow;
    this.host = document.createElement(SR.HOST_TAG.toLowerCase());
    this.host.setAttribute("data-sr-host", "1");
    Object.assign(this.host.style, {
      all: "initial",
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      pointerEvents: "none",
      display: "block",
    });
    this.shadow = this.host.attachShadow({ mode: "closed" });
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("src/content/overlay/overlay.css");
    this.shadow.appendChild(link);
    this.layer = document.createElement("div");
    this.layer.className = "sr-layer";
    this.extra = document.createElement("div");
    this.extra.className = "sr-layer";
    this.shadow.appendChild(this.layer);
    this.shadow.appendChild(this.extra);
    document.documentElement.appendChild(this.host);
    this.cssLoaded = true;
    return this.shadow;
  },

  unmount() {
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
    this.host = null;
    this.shadow = null;
    this.layer = null;
    this.extra = null;
  },

  clear() {
    if (this.layer) this.layer.innerHTML = "";
  },

  el(tag, cls, attrs) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.assign(node, attrs);
    return node;
  },

  px(n) { return `${n}px`; },

  renderElement(el, selected) {
    if (!this.layer || !el) return;
    const box = SR.dom.box(el);
    const r = box.rect;
    const frag = document.createDocumentFragment();

    const addStrip = (cls, top, left, width, height) => {
      if (width <= 0 || height <= 0) return;
      const n = this.el("div", `sr-strip ${cls}`);
      Object.assign(n.style, {
        top: this.px(top), left: this.px(left),
        width: this.px(width), height: this.px(height),
      });
      frag.appendChild(n);
    };

    const mt = box.margin.top, mr = box.margin.right, mb = box.margin.bottom, ml = box.margin.left;
    const bt = box.border.top, br = box.border.right, bb = box.border.bottom, bl = box.border.left;
    const pt = box.padding.top, pr = box.padding.right, pb = box.padding.bottom, pl = box.padding.left;

    addStrip("sr-margin", r.top - mt, r.left - ml, r.width + ml + mr, mt);
    addStrip("sr-margin", r.bottom, r.left - ml, r.width + ml + mr, mb);
    addStrip("sr-margin", r.top, r.left - ml, ml, r.height);
    addStrip("sr-margin", r.top, r.right, mr, r.height);

    addStrip("sr-border-fill", r.top, r.left, r.width, bt);
    addStrip("sr-border-fill", r.bottom - bb, r.left, r.width, bb);
    addStrip("sr-border-fill", r.top + bt, r.left, bl, r.height - bt - bb);
    addStrip("sr-border-fill", r.top + bt, r.right - br, br, r.height - bt - bb);

    addStrip("sr-padding", r.top + bt, r.left + bl, r.width - bl - br, pt);
    addStrip("sr-padding", r.bottom - bb - pb, r.left + bl, r.width - bl - br, pb);
    addStrip("sr-padding", r.top + bt + pt, r.left + bl, pl, r.height - bt - bb - pt - pb);
    addStrip("sr-padding", r.top + bt + pt, r.right - br - pr, pr, r.height - bt - bb - pt - pb);

    addStrip("sr-content", r.top + bt + pt, r.left + bl + pl, box.content.width, box.content.height);

    const outline = this.el("div", `sr-outline${selected ? " is-selected" : ""}`);
    Object.assign(outline.style, {
      top: this.px(r.top), left: this.px(r.left),
      width: this.px(r.width), height: this.px(r.height),
    });
    frag.appendChild(outline);

    if (selected) {
      [r.left, r.right].forEach((x) => {
        const g = this.el("div", "sr-guide v");
        g.style.left = this.px(x);
        frag.appendChild(g);
      });
      [r.top, r.bottom].forEach((y) => {
        const g = this.el("div", "sr-guide h");
        g.style.top = this.px(y);
        frag.appendChild(g);
      });
    }

    const tagLabel = this.el("div", "sr-label");
    tagLabel.innerHTML = `<span>${SR.dom.shortSelector(el)}</span><span class="sr-muted">${box.width} × ${box.height}</span>`;
    const labelTop = r.top - 22 < 8 ? r.bottom + 6 : r.top - 22;
    let labelLeft = r.left;
    if (labelLeft < 8) labelLeft = 8;
    Object.assign(tagLabel.style, { top: this.px(labelTop), left: this.px(labelLeft) });
    frag.appendChild(tagLabel);

    const edge = (cls, value, top, left) => {
      if (value <= 0) return;
      const n = this.el("div", `sr-edge-label ${cls}`);
      n.textContent = String(SR.dom.round(value, 1));
      Object.assign(n.style, { top: this.px(top), left: this.px(left) });
      frag.appendChild(n);
    };
    edge("margin", mt, r.top - mt - 2, r.left + r.width / 2 - 10);
    edge("margin", mb, r.bottom + 2, r.left + r.width / 2 - 10);
    edge("margin", ml, r.top + r.height / 2 - 6, r.left - ml - 2);
    edge("margin", mr, r.top + r.height / 2 - 6, r.right + 2);
    edge("padding", pt, r.top + bt + 2, r.left + r.width / 2 - 10);
    edge("padding", pb, r.bottom - bb - pb - 12, r.left + r.width / 2 - 10);

    this.layer.appendChild(frag);
  },

  renderMeasurement(selected, hover) {
    if (!this.layer || !selected || !hover || selected === hover) return;
    const gap = SR.dom.gapBetween(selected, hover);
    const A = gap.a;
    const B = gap.b;

    const hLine = (x1, x2, y, label) => {
      const left = Math.min(x1, x2);
      const width = Math.abs(x2 - x1);
      if (width < 0.5) return;
      const line = this.el("div", "sr-measure-line h");
      Object.assign(line.style, { left: this.px(left), top: this.px(y), width: this.px(width) });
      this.layer.appendChild(line);
      const lab = this.el("div", "sr-measure-label");
      lab.textContent = `${label}px`;
      Object.assign(lab.style, { left: this.px(left + width / 2), top: this.px(y) });
      this.layer.appendChild(lab);
    };
    const vLine = (y1, y2, x, label) => {
      const top = Math.min(y1, y2);
      const height = Math.abs(y2 - y1);
      if (height < 0.5) return;
      const line = this.el("div", "sr-measure-line v");
      Object.assign(line.style, { top: this.px(top), left: this.px(x), height: this.px(height) });
      this.layer.appendChild(line);
      const lab = this.el("div", "sr-measure-label");
      lab.textContent = `${label}px`;
      Object.assign(lab.style, { left: this.px(x), top: this.px(top + height / 2) });
      this.layer.appendChild(lab);
    };

    if (gap.horizontal.value > 0) {
      const y = Number.isFinite(gap.horizontal.y) && gap.horizontal.y > 0
        ? gap.horizontal.y
        : (A.top + A.height / 2);
      hLine(gap.horizontal.from, gap.horizontal.to, y, gap.horizontal.value);
    } else {
      const overlapLeft = Math.max(A.left, B.left);
      const overlapRight = Math.min(A.right, B.right);
      if (overlapRight > overlapLeft) {
        /* aligned overlap — still show left/right offsets from selected to hover */
        hLine(A.left, B.left, Math.min(A.top, B.top) - 8, SR.dom.round(B.left - A.left, 1));
        hLine(A.right, B.right, Math.min(A.top, B.top) - 8, SR.dom.round(B.right - A.right, 1));
      }
    }
    if (gap.vertical.value > 0) {
      const x = Number.isFinite(gap.vertical.x) && gap.vertical.x > 0
        ? gap.vertical.x
        : (A.left + A.width / 2);
      vLine(gap.vertical.from, gap.vertical.to, x, gap.vertical.value);
    } else {
      vLine(A.top, B.top, Math.min(A.left, B.left) - 8, SR.dom.round(B.top - A.top, 1));
      vLine(A.bottom, B.bottom, Math.min(A.left, B.left) - 8, SR.dom.round(B.bottom - A.bottom, 1));
    }
  },

  renderHoverAndSelected(hover, selected) {
    this.clear();
    if (selected) this.renderElement(selected, true);
    if (hover && hover !== selected) this.renderElement(hover, false);
    if (selected && hover && hover !== selected) this.renderMeasurement(selected, hover);
  },

  toast(message) {
    if (!this.shadow) return;
    let n = this.shadow.querySelector(".sr-toast");
    if (!n) {
      n = this.el("div", "sr-toast");
      this.shadow.appendChild(n);
    }
    n.textContent = message;
    n.classList.add("is-on");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => n.classList.remove("is-on"), 1600);
  },
};
