"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.dom = {
  px(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  },

  round(n, digits) {
    const f = 10 ** (digits || 0);
    return Math.round(n * f) / f;
  },

  isIgnored(el) {
    if (!el || el.nodeType !== 1) return true;
    const tag = el.tagName;
    if (tag === SR.HOST_TAG || tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "META" || tag === "NOSCRIPT" || tag === "HEAD") {
      return true;
    }
    if (el.id === "sr-page-inject" || el.id === SR.FORCE_STYLE_ID) return true;
    return false;
  },

  deepestAt(x, y, host) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (host && (el === host || host.contains(el))) continue;
      if (this.isIgnored(el)) continue;
      return el;
    }
    return null;
  },

  cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  },

  shortSelector(el) {
    if (!el || el.nodeType !== 1) return "";
    const tag = el.tagName.toLowerCase();
    if (el.id && !/\s/.test(el.id)) return `${tag}#${this.cssEscape(el.id)}`;
    const className = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    const classes = className.trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (classes.length) {
      return `${tag}.${classes.map((c) => this.cssEscape(c)).join(".")}`;
    }
    return tag;
  },

  uniqueSelector(el) {
    if (!el || el === document.documentElement) return "html";
    if (el === document.body) return "body";
    if (el.id && !/\s/.test(el.id) && document.querySelectorAll(`#${this.cssEscape(el.id)}`).length === 1) {
      return `#${this.cssEscape(el.id)}`;
    }
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id && !/\s/.test(node.id)) {
        parts.unshift(`${part}#${this.cssEscape(node.id)}`);
        break;
      }
      const className = typeof node.className === "string" ? node.className : "";
      const cls = className.trim().split(/\s+/).filter((c) => c && !c.startsWith("sr-")).slice(0, 2);
      if (cls.length) part += "." + cls.map((c) => this.cssEscape(c)).join(".");
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      node = node.parentElement;
      if (parts.length >= 5) break;
    }
    return parts.join(" > ") || this.shortSelector(el);
  },

  ancestry(el, limit) {
    const list = [];
    let node = el;
    const max = limit || 12;
    while (node && node.nodeType === 1 && list.length < max) {
      list.push({
        selector: this.shortSelector(node),
        tag: node.tagName.toLowerCase(),
      });
      if (node === document.documentElement) break;
      node = node.parentElement;
    }
    return list.reverse();
  },

  firstElementChild(el) {
    if (!el) return null;
    for (const child of el.children) {
      if (!this.isIgnored(child)) return child;
    }
    return null;
  },

  box(el) {
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const mt = this.px(cs.marginTop);
    const mr = this.px(cs.marginRight);
    const mb = this.px(cs.marginBottom);
    const ml = this.px(cs.marginLeft);
    const bt = this.px(cs.borderTopWidth);
    const br = this.px(cs.borderRightWidth);
    const bb = this.px(cs.borderBottomWidth);
    const bl = this.px(cs.borderLeftWidth);
    const pt = this.px(cs.paddingTop);
    const pr = this.px(cs.paddingRight);
    const pb = this.px(cs.paddingBottom);
    const pl = this.px(cs.paddingLeft);
    const width = this.round(rect.width, 1);
    const height = this.round(rect.height, 1);
    return {
      rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
      margin: { top: mt, right: mr, bottom: mb, left: ml },
      border: { top: bt, right: br, bottom: bb, left: bl },
      padding: { top: pt, right: pr, bottom: pb, left: pl },
      content: {
        width: this.round(rect.width - bl - br - pl - pr, 1),
        height: this.round(rect.height - bt - bb - pt - pb, 1),
      },
      width,
      height,
      x: this.round(rect.left + window.scrollX, 1),
      y: this.round(rect.top + window.scrollY, 1),
    };
  },

  gapBetween(a, b) {
    const A = a.getBoundingClientRect();
    const B = b.getBoundingClientRect();
    const horizontal = (() => {
      if (B.left >= A.right) return { dir: "right", value: B.left - A.right, from: A.right, to: B.left, y: (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2 };
      if (A.left >= B.right) return { dir: "left", value: A.left - B.right, from: B.right, to: A.left, y: (Math.max(A.top, B.top) + Math.min(A.bottom, B.bottom)) / 2 };
      return { dir: "overlap-x", value: 0, from: Math.max(A.left, B.left), to: Math.min(A.right, B.right), y: 0 };
    })();
    const vertical = (() => {
      if (B.top >= A.bottom) return { dir: "bottom", value: B.top - A.bottom, from: A.bottom, to: B.top, x: (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2 };
      if (A.top >= B.bottom) return { dir: "top", value: A.top - B.bottom, from: B.bottom, to: A.top, x: (Math.max(A.left, B.left) + Math.min(A.right, B.right)) / 2 };
      return { dir: "overlap-y", value: 0, from: Math.max(A.top, B.top), to: Math.min(A.bottom, B.bottom), x: 0 };
    })();
    return {
      horizontal: { ...horizontal, value: this.round(Math.max(0, horizontal.value), 1) },
      vertical: { ...vertical, value: this.round(Math.max(0, vertical.value), 1) },
      a: A,
      b: B,
    };
  },

  visibleText(el, max) {
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length <= (max || 160)) return text;
    return text.slice(0, max || 160) + "…";
  },

  outerSnippet(el, max) {
    const html = el.outerHTML || "";
    if (html.length <= (max || 4000)) return html;
    return html.slice(0, max || 4000) + "\n<!-- truncated -->";
  },

  classList(el) {
    const className = typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "";
    return className.trim().split(/\s+/).filter(Boolean);
  },
};
