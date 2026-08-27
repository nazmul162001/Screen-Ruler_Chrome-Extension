"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.MSG = Object.freeze({
  TOGGLE: "SR_TOGGLE",
  SET_ACTIVE: "SR_SET_ACTIVE",
  GET_STATE: "SR_GET_STATE",
  STATE: "SR_STATE",
  PING: "SR_PING",
  ELEMENT_SELECTED: "SR_ELEMENT_SELECTED",
  ELEMENT_CLEARED: "SR_ELEMENT_CLEARED",
  HOVER_INFO: "SR_HOVER_INFO",
  PAGE_INSIGHTS: "SR_PAGE_INSIGHTS",
  TOOL_TOGGLE: "SR_TOOL_TOGGLE",
  TOOL_STATE: "SR_TOOL_STATE",
  SELECT_PARENT: "SR_SELECT_PARENT",
  SELECT_CHILD: "SR_SELECT_CHILD",
  SELECT_ANCESTOR: "SR_SELECT_ANCESTOR",
  SELECT_SELECTOR: "SR_SELECT_SELECTOR",
  COPY_CSS: "SR_COPY_CSS",
  COPY_SELECTOR: "SR_COPY_SELECTOR",
  EDIT_COMPUTED: "SR_EDIT_COMPUTED",
  EDIT_RULE: "SR_EDIT_RULE",
  EDIT_HTML: "SR_EDIT_HTML",
  FORCE_STATE: "SR_FORCE_STATE",
  REVERT_CHANGE: "SR_REVERT_CHANGE",
  REVERT_ALL: "SR_REVERT_ALL",
  CHANGES: "SR_CHANGES",
  SCREENSHOT: "SR_SCREENSHOT",
  SCREENSHOT_RESULT: "SR_SCREENSHOT_RESULT",
  COLOR_SAMPLED: "SR_COLOR_SAMPLED",
  FIND: "SR_FIND",
  SIDE_PANEL: "SR_SIDE_PANEL",
  HIGHLIGHT_SHADOW: "SR_HIGHLIGHT_SHADOW",
  DOWNLOAD_ASSET: "SR_DOWNLOAD_ASSET",
  RESPONSIVE: "SR_RESPONSIVE",
  PAUSE: "SR_PAUSE",
  ERROR: "SR_ERROR",
});

SR.TOOLS = Object.freeze({
  INSPECT: "inspect",
  FLOATING: "floating",
  XRAY: "xray",
  GRID: "grid",
  RULERS: "rulers",
  BREAKPOINTS: "breakpoints",
  EYEDROPPER: "eyedropper",
  FIND: "find",
  SCREENSHOT: "screenshot",
  RESPONSIVE: "responsive",
  PAUSE: "pause",
  PANEL: "panel",
});

SR.PSEUDOS = Object.freeze(["hover", "focus", "active", "visited", "focus-visible", "focus-within"]);

SR.COLORS = Object.freeze({
  accent: "#3b82f6",
  hover: "#60a5fa",
  selected: "#3b82f6",
  measure: "#f43f5e",
  margin: "rgba(251, 146, 60, 0.38)",
  padding: "rgba(52, 211, 153, 0.38)",
  border: "rgba(165, 180, 252, 0.45)",
  content: "rgba(96, 165, 250, 0.18)",
  labelBg: "#111113",
  labelFg: "#ffffff",
});
