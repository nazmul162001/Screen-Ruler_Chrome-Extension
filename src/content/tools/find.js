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

  makeCard(pinned) {
    const n = document.createElement("div");
    n.className = `sr-float${pinned ? " is-pinned" : ""}`;
    return n;
  },

  update(el, x, y) {
    if (!this.enabled || !this.follow || !el) return;
    const cs = getComputedStyle(el);
    const groups = SR.css.groupedComputed(el);
    let html = `<div class="sr-float-head"><strong>${SR.dom.shortSelector(el)}</strong></div>`;
    for (const [name, items] of Object.entries(groups)) {
      const shown = items.filter((i) => !i.isDefault).slice(0, 8);
      if (!shown.length) continue;
      html += `<h4>${name}</h4>`;
      shown.forEach((i) => {
        html += `<div class="sr-row"><span class="k">${i.prop}</span><span class="v" title="${i.value}">${i.value}</span></div>`;
      });
    }
    this.follow.innerHTML = html;
    const w = 280;
    const left = Math.min(window.innerWidth - w - 12, x + 16);
    const top = Math.min(window.innerHeight - 80, y + 16);
    this.follow.style.left = `${Math.max(12, left)}px`;
    this.follow.style.top = `${Math.max(12, top)}px`;
  },

  pin(el) {
    if (!this.enabled || !el) return;
    const card = this.makeCard(true);
    this.follow && (card.innerHTML = this.follow.innerHTML);
    const close = document.createElement("button");
    close.className = "sr-float-close";
    close.textContent = "×";
    close.addEventListener("click", () => {
      card.remove();
      this.pins = this.pins.filter((p) => p !== card);
    });
    const head = card.querySelector(".sr-float-head") || card;
    head.appendChild(close);
    this.shadow.appendChild(card);
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

SR.responsive = {
  enabled: false,
  bar: null,
  hud: null,

  enable(shadow) {
    this.disable();
    this.enabled = true;
    this.shadow = shadow;
    this.bar = document.createElement("div");
    this.bar.className = "sr-responsive";
    SR.DEVICE_PRESETS.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${d.name} ${d.width}`;
      b.addEventListener("click", () => {
        [...this.bar.querySelectorAll("button")].forEach((x) => x.classList.remove("is-on"));
        b.classList.add("is-on");
        chrome.runtime.sendMessage({ type: SR.MSG.RESPONSIVE, payload: { width: d.width, height: d.height } });
      });
      this.bar.appendChild(b);
    });
    this.hud = document.createElement("div");
    this.hud.className = "sr-viewport-hud";
    const paint = () => { this.hud.textContent = `${window.innerWidth} × ${window.innerHeight}`; };
    paint();
    window.addEventListener("resize", this._onResize = paint);
    shadow.appendChild(this.bar);
    shadow.appendChild(this.hud);
  },

  disable() {
    this.enabled = false;
    if (this.bar) this.bar.remove();
    if (this.hud) this.hud.remove();
    this.bar = null;
    this.hud = null;
    window.removeEventListener("resize", this._onResize);
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
