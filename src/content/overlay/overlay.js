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
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    tagLabel.innerHTML = `<span>${SR.dom.shortSelector(el)}</span><span class="sr-muted">${w} × ${h}</span>`;
    const labelTop = r.top - 22 < 8 ? r.bottom + 6 : r.top - 22;
    let labelLeft = r.left;
    if (labelLeft < 8) labelLeft = 8;
    Object.assign(tagLabel.style, { top: this.px(labelTop), left: this.px(labelLeft) });
    frag.appendChild(tagLabel);

    this.renderSpacingLines(el, box, frag);

    this.layer.appendChild(frag);
  },

  drawHGap(frag, x0, x1, y, value, kind) {
    if (value < 0.5) return;
    const left = Math.min(x0, x1);
    const width = Math.abs(x1 - x0);
    const midY = y;
    [left, left + width].forEach((x) => {
      const tick = this.el("div", `sr-gap-cap v ${kind}`);
      Object.assign(tick.style, { left: this.px(x), top: this.px(midY - 10), height: this.px(20) });
      frag.appendChild(tick);
    });
    const cap = this.el("div", `sr-gap-cap h ${kind}`);
    Object.assign(cap.style, { left: this.px(left), top: this.px(midY), width: this.px(Math.max(1, width)) });
    frag.appendChild(cap);
    const lab = this.el("div", `sr-gap-label ${kind}`);
    lab.textContent = SR.dom.formatPx(value);
    Object.assign(lab.style, { left: this.px(left + width / 2), top: this.px(midY) });
    frag.appendChild(lab);
  },

  drawVGap(frag, y0, y1, x, value, kind) {
    if (value < 0.5) return;
    const top = Math.min(y0, y1);
    const height = Math.abs(y1 - y0);
    const cap = this.el("div", `sr-gap-cap v ${kind}`);
    Object.assign(cap.style, { top: this.px(top), left: this.px(x), height: this.px(height) });
    frag.appendChild(cap);
    const lab = this.el("div", `sr-gap-label ${kind}`);
    lab.textContent = SR.dom.formatPx(value);
    Object.assign(lab.style, { left: this.px(x), top: this.px(top + height / 2) });
    frag.appendChild(lab);
  },

  renderLayoutGaps(el) {
    if (!this.layer || !el) return;
    const host = el;
    const area = host.getBoundingClientRect();
    const huge = area.width * area.height > window.innerWidth * window.innerHeight * 0.45;
    let slots = huge ? SR.dom.visibleBoxChildren(host) : SR.dom.visualSlots(host);
    if (slots.length < 2 && host.parentElement) {
      slots = SR.dom.visualSlots(host.parentElement);
    }
    if (slots.length > 16) slots = SR.dom.visibleBoxChildren(slots.length >= 2 ? host : host.parentElement || host);
    if (slots.length < 2) return;

    const items = slots.map((node) => ({ node, r: node.getBoundingClientRect() }))
      .filter((item) => item.r.width >= 1 && item.r.height >= 1);
    const frag = document.createDocumentFragment();

    const row = [...items].sort((a, b) => a.r.left - b.r.left);
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i];
      const b = row[i + 1];
      const overlapY = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (overlapY < 6) continue;
      const gap = SR.dom.round(b.r.left - a.r.right, 1);
      if (gap < 0.5) continue;
      const y = Math.max(a.r.top, b.r.top) + overlapY / 2;
      this.drawHGap(frag, a.r.right, b.r.left, y, gap, "sibling");
    }

    const col = [...items].sort((a, b) => a.r.top - b.r.top);
    for (let i = 0; i < col.length - 1; i++) {
      const a = col[i];
      const b = col[i + 1];
      const overlapX = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      if (overlapX < 6) continue;
      const gap = SR.dom.round(b.r.top - a.r.bottom, 1);
      if (gap < 0.5) continue;
      const x = Math.max(a.r.left, b.r.left) + overlapX / 2;
      this.drawVGap(frag, a.r.bottom, b.r.top, x, gap, "sibling");
    }

    this.layer.appendChild(frag);
  },

  renderSpacingLines(el, box, frag) {
    const r = box.rect;
    const pl = box.padding.left, pr = box.padding.right, pt = box.padding.top, pb = box.padding.bottom;
    const ml = box.margin.left, mr = box.margin.right, mt = box.margin.top, mb = box.margin.bottom;

    const innerTop = r.top + box.border.top;
    const innerBottom = r.bottom - box.border.bottom;
    const innerLeft = r.left + box.border.left;
    const innerRight = r.right - box.border.right;
    const midY = innerTop + (innerBottom - innerTop) / 2;
    const midX = innerLeft + (innerRight - innerLeft) / 2;

    this.drawHGap(frag, innerLeft, innerLeft + pl, midY, pl, "padding");
    this.drawHGap(frag, innerRight - pr, innerRight, midY, pr, "padding");
    this.drawVGap(frag, innerTop, innerTop + pt, midX, pt, "padding");
    this.drawVGap(frag, innerBottom - pb, innerBottom, midX, pb, "padding");

    this.drawHGap(frag, r.left - ml, r.left, midY, ml, "margin");
    this.drawHGap(frag, r.right, r.right + mr, midY, mr, "margin");
    this.drawVGap(frag, r.top - mt, r.top, midX, mt, "margin");
    this.drawVGap(frag, r.bottom, r.bottom + mb, midX, mb, "margin");

    const insets = SR.dom.parentInsets(el);
    const showInset = (n) => n >= 0.5 && n <= 200;
    if (pl < 0.5 && ml < 0.5 && showInset(insets.left)) this.drawHGap(frag, r.left - insets.left, r.left, r.top + r.height / 2, insets.left, "margin");
    if (pr < 0.5 && mr < 0.5 && showInset(insets.right)) this.drawHGap(frag, r.right, r.right + insets.right, r.top + r.height / 2, insets.right, "margin");
    if (pt < 0.5 && mt < 0.5 && showInset(insets.top)) this.drawVGap(frag, r.top - insets.top, r.top, r.left + r.width / 2, insets.top, "margin");
    if (pb < 0.5 && mb < 0.5 && showInset(insets.bottom)) this.drawVGap(frag, r.bottom, r.bottom + insets.bottom, r.left + r.width / 2, insets.bottom, "margin");
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
    this.renderLayoutGaps(hover || selected);
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
