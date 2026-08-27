"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

if (!globalThis.__SR_LOADED__) {
  globalThis.__SR_LOADED__ = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === SR.MSG.PING) {
      sendResponse({ ok: true, active: !!(SR.app && SR.app.state.active) });
      return;
    }
    if (SR.app) SR.app.handleMessage(msg);
    sendResponse({ ok: true });
    return true;
  });
}
