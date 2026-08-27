"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.find = {
  open: false,
  matches: [],
  index: 0,
  pop: null,
  hits: null,

  show(shadow) {
    this.hide();
    this.open = true;
    this.shadow = shadow;
    const pop = document.createElement("div");
    pop.className = "sr-popover";
    pop.innerHTML = `
      <input type="text" placeholder="CSS selector — e.g. a.hero__cta, [data-testid]" spellcheck="false" />
      <div class="sr-find-meta">
        <span data-count>0 matches</span>
        <span>
          <button type="button" data-prev>Prev</button>
          <button type="button" data-next>Next</button>
        </span>
      </div>`;
    shadow.appendChild(pop);
    this.pop = pop;
    this.hits = document.createElement("div");
    this.hits.className = "sr-layer sr-find-hits";
    shadow.appendChild(this.hits);
    const input = pop.querySelector("input");
    input.addEventListener("input", () => this.query(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.cycle(e.shiftKey ? -1 : 1); }
      if (e.key === "Escape") this.hide();
      e.stopPropagation();
    });
    pop.querySelector("[data-prev]").addEventListener("click", () => this.cycle(-1));
    pop.querySelector("[data-next]").addEventListener("click", () => this.cycle(1));
    setTimeout(() => input.focus(), 30);
  },

  query(selector) {
    this.matches = [];
    this.index = 0;
    if (selector && selector.trim()) {
      try { this.matches = [...document.querySelectorAll(selector)].filter((el) => !SR.dom.isIgnored(el)); }
      catch (_) { this.matches = []; }
    }
    this.paint();
    if (this.matches[0]) this.matches[0].scrollIntoView({ block: "center", behavior: "smooth" });
  },

  paint() {
    if (!this.hits) return;
    this.hits.innerHTML = "";
    this.matches.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const n = document.createElement("div");
      n.className = `sr-find-hit${i === this.index ? " is-current" : ""}`;
      Object.assign(n.style, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
      this.hits.appendChild(n);
    });
    const count = this.pop && this.pop.querySelector("[data-count]");
    if (count) {
      count.textContent = this.matches.length
        ? `${this.index + 1} of ${this.matches.length}`
        : "0 matches";
    }
  },

  cycle(dir) {
    if (!this.matches.length) return;
    this.index = (this.index + dir + this.matches.length) % this.matches.length;
    this.matches[this.index].scrollIntoView({ block: "center", behavior: "smooth" });
    this.paint();
    if (SR.app && SR.app.select) SR.app.select(this.matches[this.index]);
  },

  hide() {
    this.open = false;
    if (this.pop) this.pop.remove();
    if (this.hits) this.hits.remove();
    this.pop = null;
    this.hits = null;
    this.matches = [];
  },
};

SR.eyedropper = {
  async pick() {
    if (!window.EyeDropper) {
      SR.overlay.toast("Eyedropper API is not available in this browser");
      return null;
    }
    try {
      const dropper = new EyeDropper();
      const result = await dropper.open();
      const parsed = SR.color.parseRgb(result.sRGBHex);
      const sample = {
        hex: result.sRGBHex.toUpperCase(),
        rgba: parsed ? SR.color.toCss(parsed) : result.sRGBHex,
      };
      try { await navigator.clipboard.writeText(sample.hex); } catch (_) { /* ignore */ }
      SR.overlay.toast(`Copied ${sample.hex}`);
      chrome.runtime.sendMessage({ type: SR.MSG.COLOR_SAMPLED, payload: sample });
      return sample;
    } catch (_) {
      return null;
    }
  },
};

SR.floating = {
  enabled: false,
  follow: null,
  pins: [],

  enable(shadow) {
    this.shadow = shadow;
    this.enabled = true;
    if (!this.follow) {
      this.follow = this.makeCard(false);
      shadow.appendChild(this.follow);
    }
  },

  disable() {
    this.enabled = false;
    if (this.follow) this.follow.remove();
    this.follow = null;
    this.pins.forEach((p) => p.remove());
    this.pins = [];
  },

  hideFollow() {
    if (this.follow && !this.follow.classList.contains("is-pinned")) {
      this.follow.style.display = "none";
    }
  },

  makeCard(pinned) {
    const n = document.createElement("div");
    n.className = `sr-float${pinned ? " is-pinned" : ""}`;
    return n;
  },

  kw: new Set([
    "flex", "inline-flex", "block", "inline", "inline-block", "none", "grid", "inline-grid",
    "border-box", "content-box", "absolute", "relative", "fixed", "sticky", "static",
    "hidden", "auto", "scroll", "visible", "wrap", "nowrap", "row", "column",
  ]),

  token(prop, value) {
    const v = String(value).trim();
    if (prop === "font-family") return "str";
    if (prop === "font-weight" || prop === "display" || prop === "box-sizing" || prop === "position") return "kw";
    if (this.kw.has(v)) return "kw";
    if (/^#|^rgb|^hsl|^oklch|^oklab/i.test(v)) return "hex";
    if (/[\d.]+(px|%|em|rem|vh|vw|s|ms)?\b/.test(v)) return "num";
    return "val";
  },

  shorthand(t, r, b, l) {
    const a = [SR.dom.formatPx(t), SR.dom.formatPx(r), SR.dom.formatPx(b), SR.dom.formatPx(l)].map((n) => `${n}px`);
    if (a[0] === a[1] && a[1] === a[2] && a[2] === a[3]) return a[0];
    if (a[0] === a[2] && a[1] === a[3]) return `${a[0]} ${a[1]}`;
    if (a[1] === a[3]) return `${a[0]} ${a[1]} ${a[2]}`;
    return a.join(" ");
  },

  firstFont(stack) {
    return String(stack || "").split(",")[0].replace(/["']/g, "").trim();
  },

  isGradient(value) {
    return /gradient\(/i.test(String(value || ""));
  },

  solidHex(value) {
    const parsed = SR.color.parseRgb(value);
    if (!parsed) return null;
    return SR.color.toHex({ ...parsed, a: 1 });
  },

  fileSize(el) {
    const src = el.currentSrc || el.src;
    if (!src) return "—";
    const hit = (performance.getEntriesByName(src) || [])[0];
    const n = hit && (hit.transferSize || hit.encodedBodySize);
    if (!n) return "—";
    return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
  },

  row(prop, value, extra) {
    if (this.isGradient(value)) return "";
    const kind = extra || this.token(prop, value);
    const colorProps = /^(color|background-color|border-color|outline-color|caret-color|accent-color|fill|stroke)$/;
    const hex = colorProps.test(prop) ? this.solidHex(value) : (kind === "hex" ? this.solidHex(value) : null);
    let val;
    if (hex) {
      val = `<span class="v hex"><i class="sw" style="background:${hex}"></i>${hex}</span>`;
    } else {
      val = `<span class="v ${kind}">${value}</span>`;
    }
    return `<div class="sr-row"><span class="k">${prop}</span>${val}</div>`;
  },

  section(title, rows) {
    if (!rows.length) return "";
    return `<div class="sr-sec"><div class="sr-sec-h">${title}</div>${rows.join("")}</div>`;
  },

  update(el, x, y) {
    if (!this.enabled || !this.follow || !el) return;
    this.follow.style.display = "";
    const cs = getComputedStyle(el);
    const box = SR.dom.box(el);
    const pad = this.shorthand(box.padding.top, box.padding.right, box.padding.bottom, box.padding.left);
    const mar = this.shorthand(box.margin.top, box.margin.right, box.margin.bottom, box.margin.left);
    const grouped = SR.css.groupedComputed(el);
    const always = new Set(["width", "height", "display", "position", "box-sizing", "color", "font-size", "font-family"]);
    const inBox = new Set([
      "width", "height", "display", "position", "box-sizing",
      "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
      "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    ]);

    const skipAppear = new Set(["background", "background-image", "background-size", "background-position", "background-repeat"]);

    const rowsFrom = (items) => {
      const rows = [];
      for (const item of items) {
        if (skipAppear.has(item.prop)) continue;
        if (this.isGradient(item.value)) continue;
        if (item.isDefault && !always.has(item.prop)) continue;
        const v = String(item.value).trim().toLowerCase();
        if ((v === "none" || v === "normal" || v === "auto") && !always.has(item.prop)) continue;
        const row = this.row(item.prop, item.value);
        if (row) rows.push(row);
      }
      return rows;
    };

    const boxRows = [
      this.row("width", `${box.width}px`, "num"),
      this.row("height", `${box.height}px`, "num"),
      this.row("display", cs.display, "kw"),
      this.row("position", cs.position, "kw"),
    ];
    if (mar !== "0px") boxRows.push(this.row("margin", mar, "num"));
    if (pad !== "0px") boxRows.push(this.row("padding", pad, "num"));
    boxRows.push(this.row("box-sizing", cs.boxSizing, "kw"));

    let html = `<div class="sr-float-sel">${SR.dom.shortSelector(el)}</div>`;
    html += this.section("Box Model", boxRows);
    html += this.section("Layout", rowsFrom((grouped.Layout || []).filter((item) => !inBox.has(item.prop))));
    html += this.section("Appearance", [
      this.row("color", cs.color, "hex"),
      ...(this.solidHex(cs.backgroundColor) && SR.color.parseRgb(cs.backgroundColor)?.a > 0.02
        ? [this.row("background-color", cs.backgroundColor, "hex")]
        : []),
      ...rowsFrom((grouped.Appearance || []).filter((item) => item.prop !== "color" && item.prop !== "background-color")),
    ].filter(Boolean));
    html += this.section("Text", rowsFrom(grouped.Text || []));
    html += this.section("Effects", rowsFrom(grouped.Effects || []));
    if (el.tagName === "IMG") {
      html += this.section("Image", [
        this.row("natural", `${el.naturalWidth} × ${el.naturalHeight}`, "num"),
        this.row("File size", this.fileSize(el), "num"),
      ]);
    }
    html += `<div class="sr-float-foot"><span class="i">i</span> Press Space to pin</div>`;
    this.follow.innerHTML = html;

    const w = 268;
    const h = Math.min(this.follow.offsetHeight || 240, window.innerHeight - 24);
    let left = x + 18;
    let top = y + 18;
    if (left + w > window.innerWidth - 12) left = x - w - 12;
    if (top + h > window.innerHeight - 12) top = y - h - 12;
    this.follow.style.left = `${Math.max(8, left)}px`;
    this.follow.style.top = `${Math.max(8, top)}px`;
  },

  pin(el) {
    if (!this.enabled || !el) return;
    const card = this.makeCard(true);
    if (this.follow) card.innerHTML = this.follow.innerHTML;
    const foot = card.querySelector(".sr-float-foot");
    if (foot) {
      foot.innerHTML = `<span class="i">i</span> Pinned<button type="button" class="sr-float-close">×</button>`;
      foot.querySelector(".sr-float-close").addEventListener("click", () => {
        card.remove();
        this.pins = this.pins.filter((p) => p !== card);
      });
    }
    this.shadow.appendChild(card);
    card.style.left = this.follow.style.left;
    card.style.top = this.follow.style.top;
    this.pins.push(card);
    this.drag(card);
  },

  drag(card) {
    let sx, sy, ox, oy, down = false;
    card.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      down = true;
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(card.style.left) || 0;
      oy = parseFloat(card.style.top) || 0;
    });
    window.addEventListener("mousemove", (e) => {
      if (!down) return;
      card.style.left = `${ox + e.clientX - sx}px`;
      card.style.top = `${oy + e.clientY - sy}px`;
    });
    window.addEventListener("mouseup", () => { down = false; });
  },
};

SR.screenshot = {
  async capture(el) {
    if (!el) {
      SR.overlay.toast("Select an element first");
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rect = el.getBoundingClientRect();
    chrome.runtime.sendMessage({
      type: SR.MSG.SCREENSHOT,
      payload: {
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        dpr: window.devicePixelRatio || 1,
        selector: SR.dom.shortSelector(el),
      },
    });
  },
};
