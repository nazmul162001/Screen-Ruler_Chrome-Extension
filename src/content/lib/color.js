"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.color = {
  parseRgb(input) {
    if (!input || input === "transparent") return null;
    const str = String(input).trim();
    const hex = str.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      let h = hex[1];
      if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    const m = str.match(/rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (m) {
      const a = m[4] == null ? 1 : String(m[4]).endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return { r: +m[1], g: +m[2], b: +m[3], a: Number.isFinite(a) ? a : 1 };
    }
    return null;
  },

  toHex({ r, g, b, a }) {
    const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    const hex = `#${h(r)}${h(g)}${h(b)}`;
    if (a != null && a < 0.999) return hex + h(a * 255);
    return hex.toUpperCase();
  },

  toCss(c) {
    if (!c) return "";
    if (c.a < 0.999) return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${SR.dom.round(c.a, 3)})`;
    return this.toHex(c);
  },

  relativeLuminance({ r, g, b }) {
    const lin = (v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  },

  contrastRatio(a, b) {
    if (!a || !b) return null;
    const l1 = this.relativeLuminance(a);
    const l2 = this.relativeLuminance(b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return SR.dom.round((lighter + 0.05) / (darker + 0.05), 2);
  },

  wcag(ratio, fontPx, weight) {
    if (ratio == null) return { aa: false, aaa: false, ratio };
    const large = fontPx >= 24 || (fontPx >= 18.66 && Number(weight) >= 700);
    return {
      ratio,
      large,
      aa: large ? ratio >= 3 : ratio >= 4.5,
      aaa: large ? ratio >= 4.5 : ratio >= 7,
    };
  },

  composite(fg, bg) {
    if (!fg) return bg;
    if (fg.a >= 0.999) return fg;
    if (!bg) return fg;
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  },

  paintedBackground(el) {
    let node = el;
    let acc = null;
    while (node && node.nodeType === 1) {
      const bg = this.parseRgb(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) {
        acc = this.composite(bg, acc || { r: 255, g: 255, b: 255, a: 1 });
        if (acc.a >= 0.99) return { ...acc, a: 1 };
      }
      node = node.parentElement;
    }
    return acc || { r: 255, g: 255, b: 255, a: 1 };
  },

  isTransparent(input) {
    const c = this.parseRgb(input);
    return !c || c.a < 0.01;
  },
};
