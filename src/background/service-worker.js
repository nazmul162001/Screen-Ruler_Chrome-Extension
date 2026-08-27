"use strict";

const CONTENT_SCRIPTS = [
  "src/content/namespace.js",
  "src/shared/constants.js",
  "src/shared/css-data.js",
  "src/content/lib/dom.js",
  "src/content/lib/color.js",
  "src/content/lib/css.js",
  "src/content/inspect/element.js",
  "src/content/inspect/page.js",
  "src/content/overlay/overlay.js",
  "src/content/tools/toolbar.js",
  "src/content/tools/rulers.js",
  "src/content/tools/find.js",
  "src/content/tools/dock.js",
  "src/content/tools/stage.js",
  "src/content/edit/editor.js",
  "src/content/app.js",
  "src/content/index.js",
];

const tabActive = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "sr-toggle",
      title: "Screen Ruler",
      contexts: ["page", "selection", "image", "link"],
    });
  });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "sr-toggle" && tab && tab.id) toggleOnTab(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-ruler" && tab && tab.id) toggleOnTab(tab.id);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id) toggleOnTab(tab.id);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  handle(msg, tabId).then(sendResponse).catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

async function handle(msg, senderTabId) {
  if (!msg || !msg.type) return { ok: false };
  switch (msg.type) {
    case "SR_TOGGLE":
    case "POPUP_TOGGLE": {
      const tabId = msg.tabId || senderTabId || (await activeTabId());
      if (tabId) await toggleOnTab(tabId);
      return { ok: true };
    }
    case "SR_POPUP_START": {
      const tabId = await activeTabId();
      if (tabId) await startOnTab(tabId);
      return { ok: true };
    }
    case "SR_POPUP_STOP": {
      const tabId = await activeTabId();
      if (tabId) await stopOnTab(tabId);
      return { ok: true };
    }
    case "SR_SIDE_PANEL": {
      const tabId = senderTabId || (await activeTabId());
      if (!tabId) return { ok: false };
      await chrome.tabs.sendMessage(tabId, { type: "SR_DOCK_TOGGLE" }).catch(() => {});
      return { ok: true };
    }
    case "SR_SCREENSHOT": {
      const tabId = senderTabId || (await activeTabId());
      if (!tabId) return { ok: false };
      await cropAndDownload(tabId, msg.payload);
      return { ok: true };
    }
    case "SR_RESPONSIVE": {
      const tabId = senderTabId || (await activeTabId());
      if (!tabId) return { ok: false };
      const tab = await chrome.tabs.get(tabId);
      const win = await chrome.windows.get(tab.windowId);
      const width = msg.payload.width;
      const height = msg.payload.height || win.height;
      await chrome.windows.update(tab.windowId, { width, height });
      return { ok: true };
    }
    case "SR_DOWNLOAD_ASSET": {
      if (msg.payload && msg.payload.url) {
        await chrome.downloads.download({ url: msg.payload.url, saveAs: true });
      }
      return { ok: true };
    }
    case "SR_GET_STATE": {
      const tabId = await activeTabId();
      if (!tabId) return { ok: true, active: false };
      try {
        const ping = await chrome.tabs.sendMessage(tabId, { type: "SR_PING" });
        return { ok: true, active: !!(ping && ping.active) };
      } catch (_) {
        return { ok: true, active: false };
      }
    }
    case "SR_SET_ACTIVE": {
      if (senderTabId) tabActive.set(senderTabId, !!(msg.payload && msg.payload.active));
      if (msg.payload && msg.payload.active === false && senderTabId) {
        tabActive.set(senderTabId, false);
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab && tab.id;
}

async function ensureInjected(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "SR_PING" });
    if (ping && ping.ok) return true;
  } catch (_) { /* not injected */ }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: CONTENT_SCRIPTS });
    return true;
  } catch (err) {
    console.warn("Screen Ruler: cannot inject on this page", err);
    return false;
  }
}

async function toggleOnTab(tabId) {
  const ok = await ensureInjected(tabId);
  if (!ok) return;
  let active = false;
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "SR_PING" });
    active = !!(ping && ping.active);
  } catch (_) { /* ignore */ }
  if (active) await stopOnTab(tabId);
  else await startOnTab(tabId);
}

async function startOnTab(tabId) {
  const ok = await ensureInjected(tabId);
  if (!ok) return;
  tabActive.set(tabId, true);
  await chrome.tabs.sendMessage(tabId, { type: "SR_SET_ACTIVE", payload: { active: true } });
  try {
    await chrome.action.setBadgeText({ tabId, text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563EB" });
  } catch (_) { /* ignore */ }
}

async function stopOnTab(tabId) {
  tabActive.set(tabId, false);
  try { await chrome.tabs.sendMessage(tabId, { type: "SR_SET_ACTIVE", payload: { active: false } }); } catch (_) { /* gone */ }
  try { await chrome.action.setBadgeText({ tabId, text: "" }); } catch (_) { /* ignore */ }
}

chrome.tabs.onRemoved.addListener((tabId) => tabActive.delete(tabId));

async function cropAndDownload(tabId, payload) {
  const tab = await chrome.tabs.get(tabId);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const rect = payload.rect;
  const dpr = payload.dpr || 1;
  const offscreenUrl = dataUrl;
  const response = await fetch(offscreenUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const sx = Math.max(0, Math.round(rect.left * dpr));
  const sy = Math.max(0, Math.round(rect.top * dpr));
  const sw = Math.max(1, Math.round(rect.width * dpr));
  const sh = Math.max(1, Math.round(rect.height * dpr));
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const out = await canvas.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const url = `data:image/png;base64,${btoa(binary)}`;
  const name = `screen-ruler-${(payload.selector || "element").replace(/[^\w.-]+/g, "_").slice(0, 40)}.png`;
  await chrome.downloads.download({ url, filename: name, saveAs: true });
}
