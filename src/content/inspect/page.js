"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.page = {
  collect(limit) {
    const max = limit || 1800;
    const nodes = document.body ? document.body.querySelectorAll("*") : [];
    const colors = new Map();
    const fonts = new Map();
    const images = [];
    const svgs = [];
    let scanned = 0;

    const addColor = (value, usage) => {
      const parsed = SR.color.parseRgb(value);
      if (!parsed || parsed.a < 0.08) return;
      const hex = SR.color.toHex({ ...parsed, a: 1 });
      const rec = colors.get(hex) || { hex, rgba: SR.color.toCss(parsed), count: 0, usages: new Set() };
      rec.count += 1;
      rec.usages.add(usage);
      colors.set(hex, rec);
    };

    for (const el of nodes) {
      if (SR.dom.isIgnored(el)) continue;
      scanned += 1;
      if (scanned > max) break;
      const cs = getComputedStyle(el);
      addColor(cs.color, "text");
      addColor(cs.backgroundColor, "background");
      addColor(cs.borderTopColor, "border");
      const fam = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const key = `${fam}|${cs.fontSize}|${cs.fontWeight}`;
      if (fam && !fonts.has(key)) {
        fonts.set(key, {
          family: fam,
          stack: cs.fontFamily,
          size: cs.fontSize,
          weight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          style: cs.fontStyle,
          sample: SR.dom.visibleText(el, 48) || "Ag",
        });
      }
      if (el.tagName === "IMG" && el.src && images.length < 80) {
        images.push({
          src: el.currentSrc || el.src,
          alt: el.alt || "",
          width: el.naturalWidth || el.width,
          height: el.naturalHeight || el.height,
        });
      }
    }

    document.querySelectorAll("svg").forEach((svg, i) => {
      if (svgs.length >= 40) return;
      svgs.push({
        index: i,
        viewBox: svg.getAttribute("viewBox") || "",
        markup: (svg.outerHTML || "").slice(0, 4000),
      });
    });

    const assetsFromCss = [];
    const bgRe = /url\((['"]?)(.*?)\1\)/g;
    try {
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; }
        if (!rules) continue;
        for (const rule of rules) {
          if (!rule.style) continue;
          const bg = rule.style.backgroundImage || "";
          let m;
          while ((m = bgRe.exec(bg))) {
            const href = m[2];
            if (href && !href.startsWith("data:") && assetsFromCss.length < 40) {
              assetsFromCss.push({ src: new URL(href, sheet.href || location.href).href, alt: "background" });
            }
          }
        }
      }
    } catch (_) { /* ignore */ }

    const tech = [];
    const scripts = [...document.scripts].map((s) => s.src || "").join(" ");
    const links = [...document.querySelectorAll("link[href]")].map((l) => l.href).join(" ");
    const hay = `${scripts} ${links} ${document.documentElement.outerHTML.slice(0, 50000)}`.toLowerCase();
    for (const sig of SR.TECH_SIGNATURES) {
      if (tech.includes(sig.name)) continue;
      if (sig.test === "dom" && sig.sel && document.querySelector(sig.sel)) tech.push(sig.name);
      if (sig.test === "class") {
        const hit = [...document.querySelectorAll("[class]")].slice(0, 80).some((node) => {
          const cls = typeof node.className === "string" ? node.className : "";
          return /(^|\s)(flex|grid|text-(xs|sm|lg|xl)|bg-|p-[0-9]|m-[0-9]|w-|h-|rounded-|items-|justify-)/.test(cls);
        });
        if (hit) tech.push(sig.name);
      }
      if (sig.test === "win") {
        const key = (sig.key || "").toLowerCase();
        if (key && hay.includes(key)) tech.push(sig.name);
      }
    }

    const meta = (name) => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el ? el.getAttribute("content") || "" : "";
    };

    const resources = performance.getEntriesByType ? performance.getEntriesByType("resource") : [];
    const byType = {};
    let totalBytes = 0;
    for (const r of resources) {
      const type = r.initiatorType || "other";
      const size = r.transferSize || r.encodedBodySize || 0;
      byType[type] = (byType[type] || 0) + size;
      totalBytes += size;
    }

    const ogImage = meta("og:image");
    const title = document.title;
    const description = meta("description") || meta("og:description");

    const seoIssues = [];
    if (!title) seoIssues.push({ severity: "error", message: "Missing document title." });
    else if (title.length > 60) seoIssues.push({ severity: "warn", message: `Title is ${title.length} characters (recommended ≤ 60).` });
    if (!description) seoIssues.push({ severity: "warn", message: "Missing meta description." });
    else if (description.length > 160) seoIssues.push({ severity: "warn", message: `Meta description is ${description.length} characters (recommended ≤ 160).` });
    if (!document.querySelector("h1")) seoIssues.push({ severity: "warn", message: "No H1 heading on the page." });
    if (!ogImage) seoIssues.push({ severity: "info", message: "No Open Graph image." });

    return {
      url: location.href,
      title,
      description,
      canonical: (document.querySelector("link[rel='canonical']") || {}).href || "",
      meta: {
        description,
        viewport: meta("viewport"),
        robots: meta("robots"),
        themeColor: meta("theme-color"),
        ogTitle: meta("og:title") || title,
        ogDescription: meta("og:description") || description,
        ogImage,
        ogType: meta("og:type"),
        ogUrl: meta("og:url") || location.href,
        twitterCard: meta("twitter:card"),
        twitterTitle: meta("twitter:title"),
      },
      lang: document.documentElement.lang || "",
      colors: [...colors.values()]
        .map((c) => ({ hex: c.hex, rgba: c.rgba, count: c.count, usages: [...c.usages] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 48),
      fonts: [...fonts.values()].slice(0, 40),
      images: [...images, ...assetsFromCss].slice(0, 80),
      svgs,
      tech,
      breakpoints: SR.css.breakpoints(),
      weight: {
        totalBytes,
        byType,
        requests: resources.length,
      },
      seoIssues,
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].slice(0, 40).map((h) => ({
        tag: h.tagName.toLowerCase(),
        text: SR.dom.visibleText(h, 80),
      })),
    };
  },
};
