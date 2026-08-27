"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.dock = {
  open: false,
  wrap: null,

  mount(shadow) {
    this.unmount();
    this.shadow = shadow;
    const wrap = document.createElement("aside");
    wrap.className = "sr-dock";
    wrap.innerHTML = `
      <div class="sr-dock-head">
        <strong>Screen Ruler</strong>
        <span>Measure and Inspect</span>
        <button type="button" class="sr-dock-close" title="Hide panel">×</button>
      </div>
      <iframe title="Screen Ruler panel" allow="clipboard-write" src="${chrome.runtime.getURL("src/sidepanel/index.html")}"></iframe>`;
    wrap.querySelector(".sr-dock-close").addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setOpen(false);
    });
    shadow.appendChild(wrap);
    this.wrap = wrap;
    this.setOpen(true);
    SR.toolbar.setActive("panel", true);
  },

  unmount() {
    if (this.wrap) this.wrap.remove();
    this.wrap = null;
    this.open = false;
  },

  setOpen(on) {
    this.open = !!on;
    if (this.wrap) this.wrap.classList.toggle("is-hidden", !this.open);
    if (SR.toolbar) SR.toolbar.setActive("panel", this.open);
  },

  toggle() {
    if (!this.wrap) {
      if (SR.overlay && SR.overlay.shadow) this.mount(SR.overlay.shadow);
      return;
    }
    this.setOpen(!this.open);
  },
};
