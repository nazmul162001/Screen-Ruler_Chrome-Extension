"use strict";

const toggle = document.getElementById("toggle");

async function refresh() {
  const res = await chrome.runtime.sendMessage({ type: "SR_GET_STATE" }).catch(() => null);
  const active = !!(res && res.active);
  toggle.textContent = active ? "Deactivate" : "Activate on this page";
  toggle.classList.toggle("is-on", active);
}

toggle.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "POPUP_TOGGLE" });
  setTimeout(refresh, 250);
  setTimeout(() => window.close(), 320);
});

refresh();
