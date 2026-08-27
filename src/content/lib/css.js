"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.css = {
  importantComputed(el) {
    const cs = getComputedStyle(el);
    const pick = [
      "display", "position", "top", "right", "bottom", "left",
      "width", "height", "min-width", "min-height", "max-width", "max-height",
      "margin", "padding", "border", "border-radius", "box-sizing",
      "overflow", "z-index", "opacity", "visibility", "cursor",
      "color", "background-color", "background-image", "box-shadow",
      "font-family", "font-size", "font-weight", "font-style", "line-height",
      "letter-spacing", "text-align", "text-decoration", "text-transform",
      "flex-direction", "flex-wrap", "justify-content", "align-items", "gap",
      "grid-template-columns", "grid-template-rows", "transform", "filter",
      "transition", "animation",
    ];
    const out = {};
    for (const p of pick) out[p] = cs.getPropertyValue(p);
    return out;
  },

  groupedComputed(el) {
    const cs = getComputedStyle(el);
    const groups = {};
    for (const [name, props] of Object.entries(SR.PROP_GROUPS)) {
      const items = [];
      for (const prop of props) {
        const value = cs.getPropertyValue(prop);
        if (!value) continue;
        const isDefault = SR.DEFAULT_VALUES.has(value.trim().toLowerCase());
        items.push({ prop, value, isDefault });
      }
      groups[name] = items;
    }
    return groups;
  },

  allComputed(el) {
    const cs = getComputedStyle(el);
    const items = [];
    for (let i = 0; i < cs.length; i++) {
      const prop = cs[i];
      items.push({ prop, value: cs.getPropertyValue(prop) });
    }
    items.sort((a, b) => a.prop.localeCompare(b.prop));
    return items;
  },

  walkSheets(visitor) {
    const sheets = [...document.styleSheets];
    const visit = (rules, ctx) => {
      if (!rules) return;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const type = rule.type;
        try {
          if (type === CSSRule.STYLE_RULE) {
            visitor(rule, ctx);
          } else if (type === CSSRule.MEDIA_RULE) {
            visit(rule.cssRules, { ...ctx, media: rule.conditionText, mediaActive: matchMedia(rule.conditionText).matches });
          } else if (type === CSSRule.SUPPORTS_RULE) {
            visit(rule.cssRules, { ...ctx, supports: rule.conditionText });
          } else if (type === CSSRule.IMPORT_RULE && rule.styleSheet) {
            visit(rule.styleSheet.cssRules, { ...ctx, href: rule.href || ctx.href });
          } else if (rule.cssRules) {
            const extra = {};
            if (rule.constructor && /Layer/i.test(rule.constructor.name)) extra.layer = rule.name || "";
            if (rule.constructor && /Container/i.test(rule.constructor.name)) extra.container = rule.conditionText || "";
            visit(rule.cssRules, { ...ctx, ...extra });
          }
        } catch (_) {
          /* cross-origin or unsupported rule */
        }
      }
    };
    for (const sheet of sheets) {
      let href = sheet.href || document.location.href;
      try {
        visit(sheet.cssRules, { href, media: null, mediaActive: true, sheet });
      } catch (_) {
        /* opaque stylesheet */
      }
    }
  },

  matchedRules(el) {
    const matched = [];
    this.walkSheets((rule, ctx) => {
      const selector = rule.selectorText;
      if (!selector) return;
      const parts = selector.split(",");
      let hits = false;
      const overriddenHint = [];
      for (const part of parts) {
        const raw = part.trim();
        if (!raw) continue;
        const unpseudo = raw.replace(/:(hover|focus|active|visited|focus-visible|focus-within|target)/g, "");
        try {
          if (el.matches(raw) || (unpseudo && unpseudo !== raw && el.matches(unpseudo))) {
            hits = true;
            if (unpseudo !== raw) overriddenHint.push(raw);
          }
        } catch (_) { /* invalid selector */ }
      }
      if (!hits) return;
      const decls = [];
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        decls.push({
          prop,
          value: rule.style.getPropertyValue(prop),
          important: rule.style.getPropertyPriority(prop) === "important",
        });
      }
      matched.push({
        selector,
        href: ctx.href,
        source: this.sourceLabel(ctx.href),
        media: ctx.media,
        mediaActive: ctx.mediaActive !== false,
        layer: ctx.layer || null,
        decls,
        cssText: rule.cssText,
      });
    });
    return matched;
  },

  sourceLabel(href) {
    if (!href) return "inline";
    try {
      const u = new URL(href, location.href);
      if (u.href === location.href) return "inline <style>";
      const name = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
      return name;
    } catch (_) {
      return href;
    }
  },

  breakpoints() {
    const set = new Map();
    this.walkSheets((_rule, ctx) => {
      if (!ctx.media) return;
      const re = /\((?:min|max)-width:\s*([\d.]+)(px|em|rem)\)/gi;
      let m;
      const text = ctx.media;
      while ((m = re.exec(text))) {
        let px = parseFloat(m[1]);
        if (m[2] !== "px") px *= 16;
        const key = `${Math.round(px)}`;
        if (!set.has(key)) set.set(key, { px: Math.round(px), query: text, active: matchMedia(text).matches });
      }
    });
    return [...set.values()].sort((a, b) => a.px - b.px);
  },

  parseShadows(value) {
    if (!value || value === "none") return [];
    const parts = [];
    let depth = 0;
    let current = "";
    for (const ch of value) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
      } else current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.map((part, index) => {
      const inset = /\binset\b/i.test(part);
      const nums = [...part.matchAll(/-?[\d.]+px/g)].map((n) => parseFloat(n[0]));
      const colorMatch = part.match(/(#(?:[0-9a-f]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|[a-z]+)/i);
      return {
        index,
        raw: part,
        inset,
        x: nums[0] || 0,
        y: nums[1] || 0,
        blur: nums[2] || 0,
        spread: nums[3] || 0,
        color: colorMatch ? colorMatch[0] : "currentColor",
      };
    });
  },

  parseGradients(value) {
    if (!value || value === "none") return [];
    const out = [];
    const re = /((?:repeating-)?(?:linear|radial|conic)-gradient)\(([\s\S]*?)\)(?=\s*(?:,|$))/gi;
    let m;
    while ((m = re.exec(value))) {
      const type = m[1];
      const inner = m[2];
      const stops = [];
      const bits = [];
      let depth = 0;
      let cur = "";
      for (const ch of inner) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
          bits.push(cur.trim());
          cur = "";
        } else cur += ch;
      }
      if (cur.trim()) bits.push(cur.trim());
      const first = bits[0] || "";
      const hasAngle = /deg|turn|rad|to\s+|at\s+|from\s+|circle|ellipse/i.test(first);
      const stopBits = hasAngle ? bits.slice(1) : bits;
      const angle = hasAngle ? first : "";
      stopBits.forEach((s, i) => {
        const pos = s.match(/([\d.]+%)\s*$/);
        stops.push({
          color: pos ? s.slice(0, pos.index).trim() : s,
          position: pos ? pos[1] : `${Math.round((i / Math.max(stopBits.length - 1, 1)) * 100)}%`,
        });
      });
      out.push({ type, angle, stops, raw: `${type}(${inner})` });
    }
    return out;
  },

  parseEasing(value) {
    if (!value) return [];
    const items = value.split(",").map((v) => v.trim()).filter(Boolean);
    return items.map((v) => {
      const named = SR.EASING[v];
      if (named) return { raw: v, type: "cubic", points: named };
      const cubic = v.match(/cubic-bezier\(\s*([\d.]+)\s*,\s*([-\d.]+)\s*,\s*([\d.]+)\s*,\s*([-\d.]+)\s*\)/);
      if (cubic) return { raw: v, type: "cubic", points: cubic.slice(1, 5).map(Number) };
      const steps = v.match(/steps\(\s*(\d+)\s*,\s*(start|end|jump-start|jump-end|jump-both|jump-none)?\s*\)/);
      if (steps) return { raw: v, type: "steps", count: +steps[1], position: steps[2] || "end" };
      return { raw: v, type: "unknown", points: SR.EASING.ease };
    });
  },

  animations(el) {
    const cs = getComputedStyle(el);
    const names = cs.animationName.split(",").map((s) => s.trim());
    if (names.length === 1 && (names[0] === "none" || !names[0])) return [];
    const durs = cs.animationDuration.split(",");
    const delays = cs.animationDelay.split(",");
    const counts = cs.animationIterationCount.split(",");
    const timings = cs.animationTimingFunction.split(",");
    const keyframes = this.keyframes();
    return names.map((name, i) => ({
      name,
      duration: (durs[i] || durs[0] || "").trim(),
      delay: (delays[i] || delays[0] || "").trim(),
      iterations: (counts[i] || counts[0] || "").trim(),
      timing: (timings[i] || timings[0] || "").trim(),
      easing: this.parseEasing(timings[i] || timings[0] || "")[0],
      keyframes: keyframes[name] || "",
    }));
  },

  keyframes() {
    const map = {};
    this.walkSheets((rule) => {}, {});
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            map[rule.name] = rule.cssText;
          }
        }
      }
    } catch (_) { /* ignore */ }
    return map;
  },

  transitions(el) {
    const cs = getComputedStyle(el);
    const props = cs.transitionProperty.split(",").map((s) => s.trim());
    if (props.length === 1 && (props[0] === "none" || !props[0])) return [];
    const durs = cs.transitionDuration.split(",");
    const delays = cs.transitionDelay.split(",");
    const timings = cs.transitionTimingFunction.split(",");
    const grouped = new Map();
    props.forEach((prop, i) => {
      const duration = (durs[i] || durs[0] || "").trim();
      const delay = (delays[i] || delays[0] || "").trim();
      const timing = (timings[i] || timings[0] || "").trim();
      const key = `${duration}|${delay}|${timing}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          properties: [],
          duration,
          delay,
          timing,
          easing: this.parseEasing(timing)[0],
        });
      }
      grouped.get(key).properties.push(prop);
    });
    return [...grouped.values()];
  },

  layout(el) {
    const cs = getComputedStyle(el);
    const display = cs.display;
    const info = { display, position: cs.position, gap: cs.gap, isFlex: display.includes("flex"), isGrid: display.includes("grid") };
    if (info.isFlex) {
      info.flex = {
        direction: cs.flexDirection,
        wrap: cs.flexWrap,
        justify: cs.justifyContent,
        align: cs.alignItems,
        alignContent: cs.alignContent,
        gap: cs.gap,
        itemCount: el.children.length,
      };
    }
    if (info.isGrid) {
      info.grid = {
        columns: cs.gridTemplateColumns,
        rows: cs.gridTemplateRows,
        autoFlow: cs.gridAutoFlow,
        justify: cs.justifyContent,
        align: cs.alignItems,
        gap: cs.gap,
        columnCount: cs.gridTemplateColumns.split(" ").filter(Boolean).length,
        rowCount: cs.gridTemplateRows.split(" ").filter(Boolean).length,
        itemCount: el.children.length,
      };
    }
    return info;
  },

  toTailwind(el) {
    const cs = getComputedStyle(el);
    const cls = [];
    const px = SR.dom.px;
    const space = (n) => {
      const rounded = Math.round(n);
      if (Object.prototype.hasOwnProperty.call(SR.SPACING_SCALE, rounded)) return SR.SPACING_SCALE[rounded];
      return `[${SR.dom.round(n, 2)}px]`;
    };
    const display = cs.display;
    const displayMap = {
      flex: "flex", "inline-flex": "inline-flex", grid: "grid", "inline-grid": "inline-grid",
      block: "block", inline: "inline", "inline-block": "inline-block", none: "hidden",
      contents: "contents", "list-item": "list-item",
    };
    if (displayMap[display]) cls.push(displayMap[display]);
    if (display.includes("flex")) {
      const dir = { row: "", "row-reverse": "flex-row-reverse", column: "flex-col", "column-reverse": "flex-col-reverse" };
      if (dir[cs.flexDirection]) cls.push(dir[cs.flexDirection]);
      if (cs.flexWrap === "wrap") cls.push("flex-wrap");
      const jc = {
        "flex-start": "justify-start", "flex-end": "justify-end", center: "justify-center",
        "space-between": "justify-between", "space-around": "justify-around", "space-evenly": "justify-evenly",
      };
      if (jc[cs.justifyContent]) cls.push(jc[cs.justifyContent]);
      const ai = {
        "flex-start": "items-start", "flex-end": "items-end", center: "items-center",
        stretch: "items-stretch", baseline: "items-baseline",
      };
      if (ai[cs.alignItems]) cls.push(ai[cs.alignItems]);
    }
    const pos = { relative: "relative", absolute: "absolute", fixed: "fixed", sticky: "sticky" };
    if (pos[cs.position]) cls.push(pos[cs.position]);
    const w = px(cs.width);
    const h = px(cs.height);
    if (w) cls.push(`w-${space(w)}`);
    if (h) cls.push(`h-${space(h)}`);
    const sides = [
      ["p", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
      ["m", "marginTop", "marginRight", "marginBottom", "marginLeft"],
    ];
    for (const [prefix, t, r, b, l] of sides) {
      const tv = px(cs[t]); const rv = px(cs[r]); const bv = px(cs[b]); const lv = px(cs[l]);
      if (tv === rv && rv === bv && bv === lv) {
        if (tv) cls.push(`${prefix}-${space(tv)}`);
      } else {
        if (tv === bv && lv === rv) {
          if (tv) cls.push(`${prefix}y-${space(tv)}`);
          if (lv) cls.push(`${prefix}x-${space(lv)}`);
        } else {
          if (tv) cls.push(`${prefix}t-${space(tv)}`);
          if (rv) cls.push(`${prefix}r-${space(rv)}`);
          if (bv) cls.push(`${prefix}b-${space(bv)}`);
          if (lv) cls.push(`${prefix}l-${space(lv)}`);
        }
      }
    }
    const gap = px(cs.gap);
    if (gap && (display.includes("flex") || display.includes("grid"))) cls.push(`gap-${space(gap)}`);
    const fs = px(cs.fontSize);
    cls.push(SR.FONT_SIZE_SCALE[Math.round(fs)] || `text-[${SR.dom.round(fs, 1)}px]`);
    const fw = String(Math.round(Number(cs.fontWeight) || 400));
    if (SR.FONT_WEIGHT_SCALE[fw]) cls.push(SR.FONT_WEIGHT_SCALE[fw]);
    if (cs.fontStyle === "italic") cls.push("italic");
    const lh = cs.lineHeight;
    if (lh && lh !== "normal") {
      const ratio = px(lh) / (fs || 1);
      const lead = { 1: "leading-none", 1.25: "leading-tight", 1.375: "leading-snug", 1.5: "leading-normal", 1.625: "leading-relaxed", 2: "leading-loose" };
      const hit = Object.keys(lead).find((k) => Math.abs(ratio - Number(k)) < 0.06);
      cls.push(hit ? lead[hit] : `leading-[${lh}]`);
    }
    const ta = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" };
    if (ta[cs.textAlign]) cls.push(ta[cs.textAlign]);
    const color = SR.color.parseRgb(cs.color);
    if (color && color.a > 0) cls.push(`text-[${SR.color.toHex(color)}]`);
    const bg = SR.color.parseRgb(cs.backgroundColor);
    if (bg && bg.a > 0.02) cls.push(`bg-[${SR.color.toHex(bg)}]`);
    const radius = px(cs.borderTopLeftRadius);
    if (radius >= 999) cls.push("rounded-full");
    else if (radius) cls.push(`rounded-[${SR.dom.round(radius, 1)}px]`);
    const bw = px(cs.borderTopWidth);
    if (bw && cs.borderTopStyle !== "none") {
      cls.push(bw === 1 ? "border" : `border-[${bw}px]`);
      const bc = SR.color.parseRgb(cs.borderTopColor);
      if (bc) cls.push(`border-[${SR.color.toHex(bc)}]`);
    }
    const op = Number(cs.opacity);
    if (Number.isFinite(op) && op < 1) cls.push(`opacity-${Math.round(op * 100)}`);
    if (cs.overflow === "hidden") cls.push("overflow-hidden");
    if (cs.overflow === "auto") cls.push("overflow-auto");
    if (cs.overflow === "scroll") cls.push("overflow-scroll");
    if (cs.textTransform === "uppercase") cls.push("uppercase");
    if (cs.textTransform === "lowercase") cls.push("lowercase");
    if (cs.textTransform === "capitalize") cls.push("capitalize");
    if (cs.boxShadow && cs.boxShadow !== "none") cls.push("shadow");
    return cls.filter(Boolean).join(" ");
  },
};
