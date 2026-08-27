"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.icons = {
  parent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 14l6-6 6 6"/></svg>',
  child: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 10l6 6 6-6"/></svg>',
  inspect: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.15 3.1L19.8 12.35l-6.9.55 3.85 7.5-2.55 1.3-3.85-7.5-4.2 6.85V3.1z"/></svg>',
  floating: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
  xray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
  rulers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V8a2 2 0 0 1 2-2h12"/><path d="M8 6v3M12 6v2M16 6v3M20 10h-3M20 14h-2M20 18h-3"/></svg>',
  eyedropper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8l8-8 4 4-8 8"/><path d="M10 10L4.5 15.5a3.5 3.5 0 1 0 5 5L15 14"/></svg>',
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/></svg>',
  responsive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="12" rx="1"/><rect x="8" y="17" width="8" height="3" rx="0.5"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

SR.toolbar = {
  root: null,

  mount(shadow, onToggle) {
    this.unmount();
    this.onToggle = onToggle;
    const bar = document.createElement("div");
    bar.className = "sr-toolbar";
    const items = [
      ["parent", "Select parent", "⌥↑"],
      ["child", "Select child", "⌥↓"],
      ["sep"],
      ["inspect", "Selector", "1"],
      ["grid", "Layout grid", "3"],
      ["rulers", "Page rulers", "4"],
      ["eyedropper", "Color picker", "6"],
      ["find", "Find selector", "7"],
      ["screenshot", "Element screenshot", "8"],
      ["responsive", "Responsive mode", "9"],
      ["panel", "Toggle side panel", "0"],
      ["sep"],
      ["pause", "Pause inspection"],
      ["close", "Turn off"],
    ];
    for (const item of items) {
      if (item[0] === "sep") {
        const sep = document.createElement("div");
        sep.className = "sr-sep";
        bar.appendChild(sep);
        continue;
      }
      const [id, label, kbd, alwaysOn] = item;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.tool = id;
      if (id === "close") btn.classList.add("is-danger");
      if (alwaysOn) btn.classList.add("is-on");
      btn.innerHTML = `${SR.icons[id === "screenshot" ? "camera" : id] || ""}<span class="sr-tip">${label}${kbd ? `<span class="sr-kbd">${kbd}</span>` : ""}</span>`;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(id);
      });
      bar.appendChild(btn);
    }
    shadow.appendChild(bar);
    this.root = bar;
    return bar;
  },

  unmount() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  },

  setActive(tool, on) {
    if (!this.root) return;
    const btn = this.root.querySelector(`[data-tool="${tool}"]`);
    if (btn) btn.classList.toggle("is-on", !!on);
  },
};
