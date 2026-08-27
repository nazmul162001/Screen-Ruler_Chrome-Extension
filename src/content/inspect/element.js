"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.inspect = {
  snapshot(el) {
    if (!el || el.nodeType !== 1) return null;
    const box = SR.dom.box(el);
    const cs = getComputedStyle(el);
    const fg = SR.color.parseRgb(cs.color);
    const bgPaint = SR.color.paintedBackground(el);
    const ratio = SR.color.contrastRatio(fg, bgPaint);
    const fontPx = SR.dom.px(cs.fontSize);
    const wcag = SR.color.wcag(ratio, fontPx, cs.fontWeight);
    const issues = [];
    if (fg && !wcag.aa && SR.dom.visibleText(el, 20)) {
      issues.push({
        id: "contrast",
        severity: wcag.aaa ? "info" : "error",
        message: `Contrast ${ratio}:1 fails WCAG ${wcag.large ? "AA Large" : "AA"} (needs ${wcag.large ? "3.0" : "4.5"}:1).`,
      });
    }
    if (cs.outlineStyle === "none" && (el.tagName === "A" || el.tagName === "BUTTON" || el.tabIndex >= 0)) {
      /* not always an issue; skip noisy */
    }
    if ((el.tagName === "IMG" || el.tagName === "SVG") && el.tagName === "IMG" && !el.alt && !el.getAttribute("aria-label")) {
      issues.push({ id: "alt", severity: "warn", message: "Image is missing an alt attribute." });
    }
    if (fontPx && fontPx < 12 && SR.dom.visibleText(el, 8)) {
      issues.push({ id: "font-size", severity: "warn", message: `Font size ${fontPx}px is below 12px.` });
    }

    const colors = {
      color: fg ? SR.color.toCss(fg) : cs.color,
      background: SR.color.toCss(SR.color.parseRgb(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }),
      paintedBackground: SR.color.toCss(bgPaint),
      border: cs.borderTopColor,
    };

    return {
      selector: SR.dom.shortSelector(el),
      uniqueSelector: SR.dom.uniqueSelector(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      classes: SR.dom.classList(el),
      box,
      dimensions: `${box.width} × ${box.height}`,
      computed: SR.css.importantComputed(el),
      grouped: SR.css.groupedComputed(el),
      rules: SR.css.matchedRules(el),
      tailwind: SR.css.toTailwind(el),
      layout: SR.css.layout(el),
      shadows: SR.css.parseShadows(cs.boxShadow),
      gradients: SR.css.parseGradients(cs.backgroundImage),
      animations: SR.css.animations(el),
      transitions: SR.css.transitions(el),
      colors,
      typography: {
        family: cs.fontFamily,
        size: cs.fontSize,
        weight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        style: cs.fontStyle,
        align: cs.textAlign,
        transform: cs.textTransform,
        decoration: cs.textDecorationLine,
      },
      a11y: {
        contrast: wcag,
        foreground: colors.color,
        background: colors.paintedBackground,
        role: el.getAttribute("role") || "",
        ariaLabel: el.getAttribute("aria-label") || "",
        tabIndex: el.tabIndex,
        issues,
      },
      ancestry: SR.dom.ancestry(el),
      text: SR.dom.visibleText(el, 240),
      html: SR.dom.outerSnippet(el, 6000),
      attributes: [...el.attributes]
        .filter((a) => a.name !== SR.ATTR_ID)
        .slice(0, 40)
        .map((a) => ({ name: a.name, value: a.value })),
      isCanvas: el.tagName === "CANVAS",
      canvas: el.tagName === "CANVAS" ? { width: el.width, height: el.height } : null,
    };
  },
};
