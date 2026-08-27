"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.PROP_GROUPS = Object.freeze({
  Layout: [
    "display", "position", "top", "right", "bottom", "left", "inset",
    "width", "height", "min-width", "min-height", "max-width", "max-height",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "box-sizing", "overflow", "overflow-x", "overflow-y", "z-index",
    "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
    "justify-content", "align-items", "align-content", "align-self", "gap",
    "row-gap", "column-gap", "order",
    "grid-template-columns", "grid-template-rows", "grid-template-areas",
    "grid-auto-flow", "grid-column", "grid-row", "place-items", "place-content",
    "float", "clear", "aspect-ratio", "object-fit", "object-position",
  ],
  Appearance: [
    "color", "background", "background-color", "background-image",
    "background-size", "background-position", "background-repeat",
    "border", "border-width", "border-style", "border-color", "border-radius",
    "outline", "opacity", "box-shadow", "visibility", "cursor", "accent-color",
    "caret-color", "mix-blend-mode", "isolation",
  ],
  Text: [
    "font-family", "font-size", "font-weight", "font-style", "font-variant",
    "line-height", "letter-spacing", "word-spacing", "text-align",
    "text-decoration", "text-transform", "text-overflow", "text-indent",
    "white-space", "word-break", "overflow-wrap", "vertical-align",
    "text-shadow", "direction", "writing-mode",
  ],
  Effects: [
    "transform", "transform-origin", "transition", "animation",
    "filter", "backdrop-filter", "clip-path", "mask-image", "perspective",
    "will-change", "pointer-events", "user-select",
  ],
});

SR.DEFAULT_VALUES = new Set([
  "none", "auto", "normal", "0px", "0s", "0", "rgba(0, 0, 0, 0)",
  "transparent", "visible", "static", "content-box", "start", "baseline",
  "stretch", "row", "nowrap", "separate", "show", "inline", "ltr",
  "horizontal-tb", "ease", "running", "1", "repeat", "scroll", "padding-box",
  "border-box", "currentcolor", "0% 0%", "0px 0px",
]);

SR.SPACING_SCALE = Object.freeze({
  0: "0", 1: "1", 2: "0.5", 4: "1", 6: "1.5", 8: "2", 10: "2.5",
  12: "3", 14: "3.5", 16: "4", 20: "5", 24: "6", 28: "7", 32: "8",
  36: "9", 40: "10", 44: "11", 48: "12", 56: "14", 64: "16",
  80: "20", 96: "24", 112: "28", 128: "32", 144: "36", 160: "40",
  176: "44", 192: "48", 208: "52", 224: "56", 240: "60", 256: "64",
});

SR.FONT_SIZE_SCALE = Object.freeze({
  12: "text-xs", 14: "text-sm", 16: "text-base", 18: "text-lg",
  20: "text-xl", 24: "text-2xl", 30: "text-3xl", 36: "text-4xl",
  48: "text-5xl", 60: "text-6xl", 72: "text-7xl", 96: "text-8xl",
});

SR.FONT_WEIGHT_SCALE = Object.freeze({
  100: "font-thin", 200: "font-extralight", 300: "font-light",
  400: "font-normal", 500: "font-medium", 600: "font-semibold",
  700: "font-bold", 800: "font-extrabold", 900: "font-black",
});

SR.EASING = Object.freeze({
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
});

SR.DEVICE_PRESETS = Object.freeze([
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667 },
  { id: "iphone-14", name: "iPhone 14", width: 390, height: 844 },
  { id: "iphone-14-pro-max", name: "iPhone 14 Pro Max", width: 430, height: 932 },
  { id: "pixel-7", name: "Pixel 7", width: 412, height: 915 },
  { id: "ipad-mini", name: "iPad Mini", width: 768, height: 1024 },
  { id: "ipad-pro", name: "iPad Pro 11", width: 834, height: 1194 },
  { id: "laptop", name: "Laptop", width: 1280, height: 800 },
  { id: "desktop", name: "Desktop", width: 1440, height: 900 },
  { id: "full-hd", name: "Full HD", width: 1920, height: 1080 },
]);

SR.TECH_SIGNATURES = Object.freeze([
  { name: "React", test: "dom", sel: "[data-reactroot], [data-reactid], #__next, [data-react-helmet]" },
  { name: "Next.js", test: "dom", sel: "#__next, script#__NEXT_DATA__" },
  { name: "Vue", test: "dom", sel: "[data-v-app], #__nuxt, [data-v-]" },
  { name: "Nuxt", test: "dom", sel: "#__nuxt, #__NUXT_DATA__" },
  { name: "Angular", test: "dom", sel: "[ng-version], [_ngcontent], app-root" },
  { name: "Svelte", test: "dom", sel: "[class*='svelte-']" },
  { name: "jQuery", test: "win", key: "jQuery" },
  { name: "WordPress", test: "dom", sel: "link[href*='wp-content'], #wpadminbar, body.wordpress" },
  { name: "Shopify", test: "dom", sel: "[id*='shopify'], script[src*='cdn.shopify']" },
  { name: "Webflow", test: "dom", sel: "html[data-wf-page], [class*='w-']" },
  { name: "Bootstrap", test: "dom", sel: "[class*='container-fluid'], link[href*='bootstrap']" },
  { name: "Tailwind CSS", test: "class" },
  { name: "GSAP", test: "win", key: "gsap" },
  { name: "Three.js", test: "win", key: "THREE" },
  { name: "D3", test: "win", key: "d3" },
  { name: "Framer", test: "dom", sel: "[data-framer-component-type], [data-framer-name]" },
  { name: "Wix", test: "dom", sel: "#WIX_ADS, [data-wix-id]" },
  { name: "Squarespace", test: "dom", sel: "body.sqs-layout, .sqs-block" },
  { name: "Drupal", test: "dom", sel: "body.path-frontpage, [class*='js-drupal']" },
  { name: "Laravel Mix / Vite", test: "dom", sel: "script[src*='@vite'], script[type='module'][src*='/build/']" },
]);
