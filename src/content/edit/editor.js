"use strict";

var SR = globalThis.SR || {};
globalThis.SR = SR;

SR.editor = {
  changes: [],
  originals: new WeakMap(),
  htmlSnapshots: new WeakMap(),
  undoStack: [],
  redoStack: [],
  clipboard: null,
  forcePseudo: "",

  remember(el) {
    if (!el || this.originals.has(el)) return;
    this.originals.set(el, el.getAttribute("style") || "");
    this.htmlSnapshots.set(el, el.outerHTML);
  },

  editComputed(el, prop, value) {
    if (!el) return;
    this.remember(el);
    const before = el.style.getPropertyValue(prop) || getComputedStyle(el).getPropertyValue(prop);
    el.style.setProperty(prop, value);
    this.pushChange({
      id: `${Date.now()}-${prop}`,
      type: "css",
      selector: SR.dom.uniqueSelector(el),
      prop,
      before,
      after: value,
      source: "element.style",
    });
    this.undoStack.push({ kind: "style", el, prop, before, after: value });
    this.redoStack = [];
    this.emit();
  },

  editRule(payload) {
    const { selector, prop, value, href, media } = payload;
    let edited = false;
    SR.css.walkSheets((rule, ctx) => {
      if (edited) return;
      if (rule.selectorText !== selector) return;
      if (media && ctx.media !== media) return;
      if (href && ctx.href !== href) return;
      const before = rule.style.getPropertyValue(prop);
      rule.style.setProperty(prop, value);
      edited = true;
      this.pushChange({
        id: `${Date.now()}-rule-${prop}`,
        type: "css",
        selector,
        prop,
        before,
        after: value,
        source: SR.css.sourceLabel(ctx.href),
        media: ctx.media || null,
      });
    });
    if (!edited && SR.app && SR.app.state.selected) {
      this.editComputed(SR.app.state.selected, prop, value);
      return;
    }
    this.emit();
  },

  htmlAction(action, html) {
    const el = SR.app && SR.app.state.selected;
    if (!el) return;
    this.remember(el);
    const parent = el.parentNode;
    const beforeHtml = el.outerHTML;
    let afterHtml = beforeHtml;
    if (action === "delete") {
      const next = SR.dom.firstElementChild(parent) === el ? el.nextElementSibling : el.previousElementSibling || parent;
      el.remove();
      afterHtml = "";
      if (next) SR.app.select(next);
      else SR.app.clearSelection();
    } else if (action === "duplicate") {
      const clone = el.cloneNode(true);
      clone.removeAttribute(SR.ATTR_ID);
      el.after(clone);
      afterHtml = el.outerHTML + clone.outerHTML;
      SR.app.select(clone);
    } else if (action === "copy") {
      this.clipboard = el.cloneNode(true);
      try { navigator.clipboard.writeText(el.outerHTML); } catch (_) { /* ignore */ }
      SR.overlay.toast("Copied element HTML");
      return;
    } else if (action === "cut") {
      this.clipboard = el.cloneNode(true);
      el.remove();
      afterHtml = "";
      SR.app.clearSelection();
    } else if (action === "paste") {
      if (!this.clipboard) return;
      const clone = this.clipboard.cloneNode(true);
      el.after(clone);
      SR.app.select(clone);
      afterHtml = el.outerHTML + clone.outerHTML;
    } else if (action === "set-html" && typeof html === "string") {
      el.outerHTML = html;
    } else if (action === "set-text" && typeof html === "string") {
      el.textContent = html;
      afterHtml = el.outerHTML;
    }
    this.pushChange({
      id: `${Date.now()}-html`,
      type: "html",
      selector: SR.dom.shortSelector(el),
      before: beforeHtml,
      after: afterHtml,
      action,
    });
    this.undoStack.push({ kind: "html", parent, beforeHtml, afterHtml, action });
    this.redoStack = [];
    this.emit();
  },

  undo() {
    const item = this.undoStack.pop();
    if (!item) return;
    this.redoStack.push(item);
    if (item.kind === "style" && item.el && item.el.isConnected) {
      if (item.before) item.el.style.setProperty(item.prop, item.before);
      else item.el.style.removeProperty(item.prop);
    }
    this.emit();
  },

  redo() {
    const item = this.redoStack.pop();
    if (!item) return;
    this.undoStack.push(item);
    if (item.kind === "style" && item.el && item.el.isConnected) {
      item.el.style.setProperty(item.prop, item.after);
    }
    this.emit();
  },

  revert(id) {
    const i = this.changes.findIndex((c) => c.id === id);
    if (i < 0) return;
    const c = this.changes[i];
    if (c.type === "css" && SR.app.state.selected && c.source === "element.style") {
      if (c.before) SR.app.state.selected.style.setProperty(c.prop, c.before);
      else SR.app.state.selected.style.removeProperty(c.prop);
    }
    this.changes.splice(i, 1);
    this.emit();
  },

  revertAll() {
    if (SR.app.state.selected && this.originals.has(SR.app.state.selected)) {
      const style = this.originals.get(SR.app.state.selected);
      if (style) SR.app.state.selected.setAttribute("style", style);
      else SR.app.state.selected.removeAttribute("style");
    }
    this.changes = [];
    this.emit();
  },

  pushChange(change) {
    this.changes.unshift(change);
    if (this.changes.length > 80) this.changes.pop();
  },

  emit() {
    chrome.runtime.sendMessage({ type: SR.MSG.CHANGES, payload: this.changes });
  },

  forceState(el, pseudo) {
    this.clearForce();
    this.forcePseudo = pseudo || "";
    if (!el || !pseudo) return;
    const decls = [];
    SR.css.walkSheets((rule) => {
      const sel = rule.selectorText || "";
      if (!sel.includes(`:${pseudo}`)) return;
      const parts = sel.split(",").map((s) => s.trim());
      for (const part of parts) {
        if (!part.includes(`:${pseudo}`)) continue;
        const base = part.replace(new RegExp(`:${pseudo}\\b`, "g"), "");
        try {
          if (base && el.matches(base)) decls.push(rule.style.cssText);
        } catch (_) { /* ignore */ }
      }
    });
    if (!decls.length) return;
    const style = document.createElement("style");
    style.id = SR.FORCE_STYLE_ID;
    const uniq = el.getAttribute(SR.ATTR_ID) || "sel";
    style.textContent = `[${SR.ATTR_ID}="${uniq}"] { ${decls.join(";")} }`;
    document.documentElement.appendChild(style);
  },

  clearForce() {
    this.forcePseudo = "";
    const n = document.getElementById(SR.FORCE_STYLE_ID);
    if (n) n.remove();
  },
};
