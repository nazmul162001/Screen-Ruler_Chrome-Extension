"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.app = {
  state: {
    active: false,
    paused: false,
    hover: null,
    selected: null,
    mouse: { x: 0, y: 0 },
    tools: {
      inspect: false,
      floating: false,
      xray: false,
      grid: false,
      rulers: false,
      breakpoints: false,
      find: false,
      responsive: false,
      pause: false,
      panel: false,
    },
    nodeSeq: 1,
  },

  raf: 0,
  bound: false,

  async start() {
    if (this.state.active) return;
    this.state.active = true;
    await SR.overlay.mount();
    SR.toolbar.mount(SR.overlay.shadow, (id) => this.onTool(id));
    this.state.tools.inspect = true;
    this.state.tools.panel = false;
    this.state.tools.floating = false;
    SR.toolbar.setActive("panel", false);
    SR.toolbar.setActive("inspect", false);
    this.bind(true);
    this.emitState();
    this.sendPageInsights();
  },

  stop() {
    if (!this.state.active) return;
    this.state.active = false;
    this.state.hover = null;
    this.state.selected = null;
    this.state.paused = false;
    this.bind(false);
    SR.rulers.disable();
    SR.grid.disable();
    SR.xray.disable();
    SR.find.hide();
    SR.floating.disable();
    SR.responsive.disable();
    SR.stage.disable();
    SR.dock.unmount();
    SR.editor.clearForce();
    SR.toolbar.unmount();
    SR.overlay.unmount();
    this.emitState();
    chrome.runtime.sendMessage({ type: SR.MSG.ELEMENT_CLEARED });
  },

  toggle() {
    if (this.state.active) this.stop();
    else this.start();
  },

  bind(on) {
    if (on && this.bound) return;
    if (!on && !this.bound) return;
    const fn = on ? "addEventListener" : "removeEventListener";
    document[fn]("mousemove", this._onMove, true);
    document[fn]("mousedown", this._onDown, true);
    document[fn]("click", this._onClick, true);
    document[fn]("keydown", this._onKey, true);
    document[fn]("scroll", this._onScroll, true);
    window[fn]("resize", this._onScroll, true);
    this.bound = on;
  },

  _onMove: (e) => SR.app.onMove(e),
  _onDown: (e) => SR.app.onDown(e),
  _onClick: (e) => SR.app.onClick(e),
  _onKey: (e) => SR.app.onKey(e),
  _onScroll: () => SR.app.paint(),

  tracking() {
    return this.state.active && (this.state.tools.inspect || this.state.tools.floating);
  },

  inspectable(el) {
    if (!el || el === document.documentElement || el === document.body) return null;
    return el;
  },

  onMove(e) {
    if (!this.state.active || this.state.paused || !this.tracking()) return;
    if (this.isUiEvent(e)) {
      this.state.hover = null;
      this.paint();
      SR.floating.hideFollow();
      return;
    }
    this.state.mouse = { x: e.clientX, y: e.clientY };
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const el = this.inspectable(SR.dom.deepestAt(this.state.mouse.x, this.state.mouse.y, SR.overlay.host));
      this.state.hover = el;
      this.paint();
      if (this.state.tools.floating && el) {
        SR.floating.update(el, this.state.mouse.x, this.state.mouse.y);
      } else {
        SR.floating.hideFollow();
      }
    });
  },

  onDown(e) {
    if (!this.state.active || this.state.paused || !this.state.tools.inspect) return;
    if (this.isUiEvent(e)) return;
    if (e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  },

  onClick(e) {
    if (!this.state.active || this.state.paused || !this.state.tools.inspect) return;
    if (this.isUiEvent(e)) return;
    const el = this.inspectable(SR.dom.deepestAt(e.clientX, e.clientY, SR.overlay.host));
    e.preventDefault();
    e.stopPropagation();
    if (!el) {
      this.clearSelection();
      return;
    }
    if (this.state.selected === el) {
      this.clearSelection();
      return;
    }
    this.select(el);
  },

  onKey(e) {
    if (!this.state.active) return;
    const path = e.composedPath ? e.composedPath() : [e.target];
    const typing = path.some((n) => n && (n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT" || n.isContentEditable));
    if (typing && e.key !== "Escape") return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (SR.find.open) { SR.find.hide(); SR.toolbar.setActive("find", false); return; }
      if (this.state.selected) { this.clearSelection(); return; }
      this.stop();
      return;
    }
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      this.selectParent();
      return;
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      this.selectChild();
      return;
    }
    if (e.code === "Space" && this.state.tools.floating && this.state.hover) {
      e.preventDefault();
      SR.floating.pin(this.state.hover);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map = {
      Digit1: "inspect", Digit3: "grid", Digit4: "rulers",
      Digit6: "eyedropper", Digit7: "find",
      Digit8: "screenshot", Digit9: "responsive", Digit0: "panel",
    };
    if (map[e.code]) {
      e.preventDefault();
      this.onTool(map[e.code]);
    }
  },

  isUiEvent(e) {
    const path = e.composedPath ? e.composedPath() : [];
    if (SR.overlay.host && (path.includes(SR.overlay.host) || e.target === SR.overlay.host)) {
      return true;
    }
    return false;
  },

  paint() {
    if (!this.state.active || !this.state.tools.inspect) {
      if (SR.overlay) SR.overlay.clear();
      return;
    }
    SR.overlay.renderHoverAndSelected(this.state.hover, this.state.selected);
  },

  setFloating(on) {
    this.state.tools.floating = !!on;
    SR.toolbar.setActive("inspect", this.state.tools.floating);
    if (this.state.tools.floating) {
      SR.floating.enable(SR.overlay.shadow);
      const el = this.state.selected || this.state.hover;
      if (el) SR.floating.update(el, this.state.mouse.x, this.state.mouse.y);
    } else {
      SR.floating.disable();
    }
  },

  mark(el) {
    if (!el) return;
    if (!el.getAttribute(SR.ATTR_ID)) {
      el.setAttribute(SR.ATTR_ID, String(this.state.nodeSeq++));
    }
  },

  select(el) {
    if (!el) return;
    this.mark(el);
    this.state.selected = el;
    this.paint();
    const snap = SR.inspect.snapshot(el);
    chrome.runtime.sendMessage({ type: SR.MSG.ELEMENT_SELECTED, payload: snap });
  },

  clearSelection() {
    this.state.selected = null;
    SR.editor.clearForce();
    this.paint();
    chrome.runtime.sendMessage({ type: SR.MSG.ELEMENT_CLEARED });
  },

  selectParent() {
    const el = this.state.selected || this.state.hover;
    if (!el || !el.parentElement) return;
    this.select(el.parentElement);
  },

  selectChild() {
    const el = this.state.selected || this.state.hover;
    const child = SR.dom.firstElementChild(el);
    if (child) this.select(child);
  },

  selectAncestor(selector) {
    const el = this.state.selected;
    if (!el) return;
    let node = el;
    while (node) {
      if (SR.dom.shortSelector(node) === selector) {
        this.select(node);
        return;
      }
      node = node.parentElement;
    }
  },

  onTool(id) {
    switch (id) {
      case "parent":
        this.selectParent();
        break;
      case "child":
        this.selectChild();
        break;
      case "inspect":
        this.setFloating(!this.state.tools.floating);
        break;
      case "close":
        this.stop();
        chrome.runtime.sendMessage({ type: SR.MSG.SET_ACTIVE, payload: { active: false } });
        break;
      case "pause":
        this.state.paused = !this.state.paused;
        this.state.tools.pause = this.state.paused;
        SR.toolbar.setActive("pause", this.state.paused);
        SR.overlay.toast(this.state.paused ? "Inspection paused" : "Inspection resumed");
        break;
      case "xray":
        this.state.tools.xray = !this.state.tools.xray;
        this.state.tools.xray ? SR.xray.enable() : SR.xray.disable();
        SR.toolbar.setActive("xray", this.state.tools.xray);
        break;
      case "grid":
        this.state.tools.grid = !this.state.tools.grid;
        this.state.tools.grid ? SR.grid.enable(SR.overlay.shadow) : SR.grid.disable();
        SR.toolbar.setActive("grid", this.state.tools.grid);
        break;
      case "rulers":
        this.state.tools.rulers = !this.state.tools.rulers;
        this.state.tools.rulers ? SR.rulers.enable(SR.overlay.shadow) : SR.rulers.disable();
        SR.toolbar.setActive("rulers", this.state.tools.rulers);
        break;
      case "eyedropper":
        SR.eyedropper.pick();
        break;
      case "find":
        this.state.tools.find = !SR.find.open;
        if (this.state.tools.find) SR.find.show(SR.overlay.shadow);
        else SR.find.hide();
        SR.toolbar.setActive("find", SR.find.open);
        break;
      case "screenshot":
        SR.screenshot.capture(this.state.selected || this.state.hover);
        break;
      case "responsive":
        this.state.tools.responsive = !this.state.tools.responsive;
        if (this.state.tools.responsive) {
          SR.responsive.enable(SR.overlay.shadow);
        } else {
          SR.responsive.disable();
        }
        SR.toolbar.setActive("responsive", this.state.tools.responsive);
        break;
      case "panel":
        if (!SR.dock.wrap) SR.dock.mount(SR.overlay.shadow);
        else SR.dock.toggle();
        this.state.tools.panel = SR.dock.open;
        SR.toolbar.setActive("panel", SR.dock.open);
        break;
      default:
        break;
    }
    this.emitState();
  },

  emitState() {
    chrome.runtime.sendMessage({
      type: SR.MSG.STATE,
      payload: {
        active: this.state.active,
        paused: this.state.paused,
        tools: this.state.tools,
        hasSelection: !!this.state.selected,
      },
    });
  },

  sendPageInsights() {
    try {
      const insights = SR.page.collect();
      chrome.runtime.sendMessage({ type: SR.MSG.PAGE_INSIGHTS, payload: insights });
    } catch (err) {
      chrome.runtime.sendMessage({ type: SR.MSG.ERROR, payload: String(err) });
    }
  },

  handleMessage(msg) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case SR.MSG.TOGGLE:
        this.toggle();
        break;
      case SR.MSG.SET_ACTIVE:
        if (msg.payload && msg.payload.active) this.start();
        else this.stop();
        break;
      case SR.MSG.GET_STATE:
        this.emitState();
        if (this.state.selected) {
          chrome.runtime.sendMessage({ type: SR.MSG.ELEMENT_SELECTED, payload: SR.inspect.snapshot(this.state.selected) });
        }
        this.sendPageInsights();
        break;
      case "SR_DOCK_TOGGLE":
        if (!SR.dock.wrap) SR.dock.mount(SR.overlay.shadow);
        else SR.dock.toggle();
        this.state.tools.panel = SR.dock.open;
        SR.toolbar.setActive("panel", SR.dock.open);
        break;
      case SR.MSG.SELECT_PARENT:
        this.selectParent();
        break;
      case SR.MSG.SELECT_CHILD:
        this.selectChild();
        break;
      case SR.MSG.SELECT_ANCESTOR:
        this.selectAncestor(msg.payload && msg.payload.selector);
        break;
      case SR.MSG.SELECT_SELECTOR:
        try {
          const el = document.querySelector(msg.payload.selector);
          if (el) this.select(el);
        } catch (_) { /* ignore */ }
        break;
      case SR.MSG.EDIT_COMPUTED:
        this.editorGuard();
        SR.editor.editComputed(this.state.selected, msg.payload.prop, msg.payload.value);
        if (this.state.selected) this.select(this.state.selected);
        break;
      case SR.MSG.EDIT_RULE:
        this.editorGuard();
        SR.editor.editRule(msg.payload);
        if (this.state.selected) this.select(this.state.selected);
        break;
      case SR.MSG.EDIT_HTML:
        this.editorGuard();
        SR.editor.htmlAction(msg.payload.action, msg.payload.html);
        break;
      case SR.MSG.FORCE_STATE:
        SR.editor.forceState(this.state.selected, msg.payload && msg.payload.pseudo);
        if (this.state.selected) this.select(this.state.selected);
        break;
      case SR.MSG.REVERT_CHANGE:
        SR.editor.revert(msg.payload && msg.payload.id);
        if (this.state.selected) this.select(this.state.selected);
        break;
      case SR.MSG.REVERT_ALL:
        SR.editor.revertAll();
        if (this.state.selected) this.select(this.state.selected);
        break;
      case SR.MSG.COPY_CSS:
      case SR.MSG.COPY_SELECTOR:
        break;
      case SR.MSG.HIGHLIGHT_SHADOW:
        this.previewShadow(msg.payload && msg.payload.index);
        break;
      case SR.MSG.DOWNLOAD_ASSET:
        break;
      case SR.MSG.FIND:
        if (!this.state.active) this.start();
        SR.find.show(SR.overlay.shadow);
        if (msg.payload && msg.payload.selector) SR.find.query(msg.payload.selector);
        break;
      default:
        break;
    }
  },

  editorGuard() {
    if (!this.state.active) this.start();
  },

  previewShadow(index) {
    const el = this.state.selected;
    if (!el) return;
    this.mark(el);
    if (index == null || index < 0) {
      el.style.removeProperty("box-shadow");
      this.paint();
      return;
    }
    const shadows = SR.css.parseShadows(getComputedStyle(el).boxShadow);
    const layer = shadows[index];
    if (!layer) return;
    el.style.boxShadow = layer.raw;
  },
};

SR.app._onMove = (e) => SR.app.onMove(e);
SR.app._onDown = (e) => SR.app.onDown(e);
SR.app._onClick = (e) => SR.app.onClick(e);
SR.app._onKey = (e) => SR.app.onKey(e);
SR.app._onScroll = () => SR.app.paint();
