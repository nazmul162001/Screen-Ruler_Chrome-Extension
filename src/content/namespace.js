/**
 * Isolated-world namespace for all content-script modules.
 * Files load in dependency order via chrome.scripting.executeScript.
 */
"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.VERSION = "1.0.0";
SR.HOST_TAG = "SCREEN-RULER-ROOT";
SR.ATTR_ID = "data-sr-node";
SR.STYLE_ID = "sr-page-inject";
SR.FORCE_STYLE_ID = "sr-force-state";
