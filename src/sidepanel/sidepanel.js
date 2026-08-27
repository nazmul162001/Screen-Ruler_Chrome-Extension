"use strict";

const MSG = {
  GET_STATE: "SR_GET_STATE",
  ELEMENT_SELECTED: "SR_ELEMENT_SELECTED",
  ELEMENT_CLEARED: "SR_ELEMENT_CLEARED",
  PAGE_INSIGHTS: "SR_PAGE_INSIGHTS",
  SELECT_PARENT: "SR_SELECT_PARENT",
  SELECT_CHILD: "SR_SELECT_CHILD",
  SELECT_ANCESTOR: "SR_SELECT_ANCESTOR",
  EDIT_COMPUTED: "SR_EDIT_COMPUTED",
  EDIT_RULE: "SR_EDIT_RULE",
  EDIT_HTML: "SR_EDIT_HTML",
  FORCE_STATE: "SR_FORCE_STATE",
  REVERT_CHANGE: "SR_REVERT_CHANGE",
  REVERT_ALL: "SR_REVERT_ALL",
  CHANGES: "SR_CHANGES",
  COLOR_SAMPLED: "SR_COLOR_SAMPLED",
  HIGHLIGHT_SHADOW: "SR_HIGHLIGHT_SHADOW",
  DOWNLOAD_ASSET: "SR_DOWNLOAD_ASSET",
  STATE: "SR_STATE",
};

const state = {
  tab: "element",
  element: null,
  page: null,
  changes: [],
  cssView: "computed",
  mode: "inspect",
  cssQuery: "",
  sampled: null,
};

const $ = (sel) => document.querySelector(sel);

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-on", t === btn));
    $("#view-element").classList.toggle("is-on", state.tab === "element");
    $("#view-page").classList.toggle("is-on", state.tab === "page");
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.type) return;
  if (msg.type === MSG.ELEMENT_SELECTED) {
    state.element = msg.payload;
    renderElement();
  }
  if (msg.type === MSG.ELEMENT_CLEARED) {
    state.element = null;
    renderElement();
  }
  if (msg.type === MSG.PAGE_INSIGHTS) {
    state.page = msg.payload;
    renderPage();
  }
  if (msg.type === MSG.CHANGES) {
    state.changes = msg.payload || [];
    if (state.element) renderElement();
  }
  if (msg.type === MSG.COLOR_SAMPLED) {
    state.sampled = msg.payload;
    toast(`Sampled ${msg.payload.hex}`);
    if (state.tab === "page") renderPage();
  }
});

chrome.runtime.sendMessage({ type: MSG.GET_STATE });
sendToTab({ type: MSG.GET_STATE });

async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.id == null) return;
  try { await chrome.tabs.sendMessage(tab.id, message); } catch (_) { /* not injected */ }
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(text) {
  let n = document.querySelector(".toast");
  if (!n) {
    n = document.createElement("div");
    n.className = "toast";
    document.body.appendChild(n);
  }
  n.textContent = text;
  n.classList.add("is-on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => n.classList.remove("is-on"), 1400);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch (_) { toast("Copy failed"); }
}

function iconCopy() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/></svg>`;
}
function iconPointer() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 18 1.5-7 7-1.5L4 4z"/></svg>`;
}

function renderElement() {
  const empty = $("#empty-element");
  const root = $("#element-root");
  if (!state.element) {
    empty.hidden = false;
    root.hidden = true;
    root.innerHTML = "";
    return;
  }
  empty.hidden = true;
  root.hidden = false;
  const el = state.element;
  const box = el.box;
  const crumbs = (el.ancestry || []).map((a, i, arr) => {
    const on = i === arr.length - 1;
    return `<button class="crumb${on ? " is-on" : ""}" data-crumb="${esc(a.selector)}">${esc(a.selector)}</button>${i < arr.length - 1 ? '<span class="crumb-sep">›</span>' : ""}`;
  }).join("");

  const contrast = el.a11y && el.a11y.contrast;
  const contrastBadge = contrast
    ? `<span class="badge ${contrast.aa ? "ok" : "bad"}">${contrast.ratio}:1 ${contrast.aa ? "AA" : "Fail"}</span>`
    : "";

  root.innerHTML = `
    <div class="head">
      <div class="head-left">
        <div class="selector">${esc(el.selector)}</div>
        <div class="size">${esc(el.dimensions)}</div>
      </div>
      <div class="head-actions">
        <select id="force-state" title="Force element state">
          <option value="">state</option>
          <option value="hover">:hover</option>
          <option value="focus">:focus</option>
          <option value="active">:active</option>
          <option value="visited">:visited</option>
        </select>
        <button class="icon-btn" id="btn-parent" title="Select parent">${iconPointer()}</button>
        <button class="icon-btn" id="btn-copy-sel" title="Copy selector">${iconCopy()}</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Document</div>
      <div class="crumbs">${crumbs}</div>
    </div>

    <div class="section">
      <div class="section-title">Box model</div>
      ${renderBox(box)}
    </div>

    ${el.isCanvas && el.canvas ? `<div class="section"><div class="section-title">Canvas</div>
      <table class="kv"><tr><td class="k">bitmap</td><td class="v">${el.canvas.width} × ${el.canvas.height}</td></tr></table></div>` : ""}
    ${renderLayout(el.layout)}
    ${renderColors(el.colors)}
    ${renderType(el.typography)}
    ${renderA11y(el, contrastBadge)}
    ${renderCss(el)}
    ${renderShadows(el.shadows)}
    ${renderGradients(el.gradients)}
    ${renderMotion(el)}
    ${renderEdit(el)}
  `;

  root.querySelectorAll("[data-crumb]").forEach((b) => {
    b.addEventListener("click", () => sendToTab({ type: MSG.SELECT_ANCESTOR, payload: { selector: b.dataset.crumb } }));
  });
  $("#btn-parent")?.addEventListener("click", () => sendToTab({ type: MSG.SELECT_PARENT }));
  $("#btn-copy-sel")?.addEventListener("click", () => copy(el.uniqueSelector || el.selector));
  $("#force-state")?.addEventListener("change", (e) => sendToTab({ type: MSG.FORCE_STATE, payload: { pseudo: e.target.value } }));
  wireCss(el);
  wireEdit();
  wireShadows();
}

function renderBox(box) {
  if (!box) return "";
  const e = (n) => SRRound(n);
  return `
    <div class="box-model">
      <div class="box-margin">
        <span class="box-label">margin</span>
        <div class="edge">${e(box.margin.top)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
          <span class="edge">${e(box.margin.left)}</span>
          <div class="box-border" style="flex:1">
            <span class="box-label">border</span>
            <div class="edge">${e(box.border.top)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="edge">${e(box.border.left)}</span>
              <div class="box-padding" style="flex:1">
                <span class="box-label">padding</span>
                <div class="edge">${e(box.padding.top)}</div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span class="edge">${e(box.padding.left)}</span>
                  <div class="box-content">${e(box.width)} × ${e(box.height)}</div>
                  <span class="edge">${e(box.padding.right)}</span>
                </div>
                <div class="edge">${e(box.padding.bottom)}</div>
              </div>
              <span class="edge">${e(box.border.right)}</span>
            </div>
            <div class="edge">${e(box.border.bottom)}</div>
          </div>
          <span class="edge">${e(box.margin.right)}</span>
        </div>
        <div class="edge">${e(box.margin.bottom)}</div>
      </div>
    </div>`;
}

function SRRound(n) { return Math.round((Number(n) || 0) * 10) / 10; }

function renderLayout(layout) {
  if (!layout) return "";
  if (layout.isFlex && layout.flex) {
    const f = layout.flex;
    const items = Array.from({ length: Math.min(f.itemCount || 3, 6) }, () => `<div class="item"></div>`).join("");
    return `<div class="section"><div class="section-title">Flex layout</div>
      <div class="flex-diagram" style="flex-direction:${f.direction.includes("column") ? "column" : "row"};flex-wrap:${f.wrap};justify-content:${f.justify};align-items:${f.align};gap:6px">${items}</div>
      <table class="kv"><tr><td class="k">direction</td><td class="v">${esc(f.direction)}</td></tr>
      <tr><td class="k">justify</td><td class="v">${esc(f.justify)}</td></tr>
      <tr><td class="k">align</td><td class="v">${esc(f.align)}</td></tr>
      <tr><td class="k">gap</td><td class="v">${esc(f.gap)}</td></tr>
      <tr><td class="k">items</td><td class="v">${f.itemCount}</td></tr></table></div>`;
  }
  if (layout.isGrid && layout.grid) {
    const g = layout.grid;
    return `<div class="section"><div class="section-title">Grid layout</div>
      <table class="kv">
        <tr><td class="k">columns</td><td class="v">${esc(g.columns)}</td></tr>
        <tr><td class="k">rows</td><td class="v">${esc(g.rows)}</td></tr>
        <tr><td class="k">gap</td><td class="v">${esc(g.gap)}</td></tr>
        <tr><td class="k">items</td><td class="v">${g.itemCount}</td></tr>
      </table></div>`;
  }
  return `<div class="section"><div class="section-title">Layout</div>
    <table class="kv"><tr><td class="k">display</td><td class="v">${esc(layout.display)}</td></tr>
    <tr><td class="k">position</td><td class="v">${esc(layout.position)}</td></tr></table></div>`;
}

function renderColors(colors) {
  if (!colors) return "";
  const row = (name, val) => `<button class="swatch" data-copy="${esc(val)}"><span class="chip" style="background:${esc(val)}"></span><span class="meta"><div class="name">${name}</div><div class="val">${esc(val)}</div></span></button>`;
  return `<div class="section"><div class="section-title">Colors</div>
    ${row("color", colors.color)}${row("background", colors.background)}${row("painted bg", colors.paintedBackground)}${row("border", colors.border)}</div>`;
}

function renderType(t) {
  if (!t) return "";
  return `<div class="section"><div class="section-title">Typography</div>
    <div class="font-card"><div class="font-sample" style="font-family:${esc(t.family)};font-weight:${esc(t.weight)};font-size:${esc(t.size)};font-style:${esc(t.style)}">Ag The quick brown fox</div>
    <div class="font-meta">${esc(t.family)} · ${esc(t.size)} · ${esc(t.weight)} · lh ${esc(t.lineHeight)}</div></div></div>`;
}

function renderA11y(el, badge) {
  const issues = (el.a11y && el.a11y.issues) || [];
  return `<div class="section"><div class="section-title">Accessibility ${badge}</div>
    <table class="kv">
      <tr><td class="k">foreground</td><td class="v">${esc(el.a11y.foreground)}</td></tr>
      <tr><td class="k">background</td><td class="v">${esc(el.a11y.background)}</td></tr>
      <tr><td class="k">role</td><td class="v">${esc(el.a11y.role || "—")}</td></tr>
    </table>
    ${issues.map((i) => `<div class="issue">${esc(i.message)}</div>`).join("") || '<div class="hint" style="color:var(--dim)">No issues detected.</div>'}
  </div>`;
}

function renderCss(el) {
  return `<div class="section">
    <div class="section-title">CSS
      <select class="css-view" id="css-view">
        <option value="computed"${state.cssView === "computed" ? " selected" : ""}>Computed</option>
        <option value="source"${state.cssView === "source" ? " selected" : ""}>Source</option>
        <option value="tailwind"${state.cssView === "tailwind" ? " selected" : ""}>Tailwind</option>
      </select>
    </div>
    <div id="css-body">${cssBody(el)}</div>
  </div>`;
}

function cssBody(el) {
  if (state.cssView === "tailwind") {
    return `<div class="font-card"><code style="font-family:var(--mono);font-size:12px;word-break:break-word">${esc(el.tailwind || "")}</code></div>
      <button class="btn" id="copy-tw">Copy classes</button>`;
  }
  if (state.cssView === "source") {
    if (!el.rules || !el.rules.length) return `<p class="hint" style="color:var(--dim)">No readable stylesheet rules (cross-origin sheets are skipped).</p>`;
    return el.rules.map((r) => `
      <div class="rule${r.mediaActive === false ? " inactive" : ""}">
        <div class="rule-sel">${esc(r.selector)}</div>
        <div class="rule-src">${esc(r.source)}${r.media ? " · @" + esc(r.media) : ""}${r.mediaActive === false ? " · inactive" : ""}</div>
        ${(r.decls || []).map((d) => `<div class="prop-line"><span class="p">${esc(d.prop)}</span><span class="val">${esc(d.value)}${d.important ? " !important" : ""}</span></div>`).join("")}
      </div>`).join("");
  }
  const groups = el.grouped || {};
  const q = (state.cssQuery || "").toLowerCase();
  let html = `<input class="search" id="css-search" placeholder="Filter properties" value="${esc(state.cssQuery)}" />`;
  for (const [name, items] of Object.entries(groups)) {
    const shown = items.filter((i) => !q || i.prop.includes(q) || String(i.value).toLowerCase().includes(q));
    if (!shown.length) continue;
    html += `<div class="section-title">${esc(name)}</div>`;
    shown.forEach((i) => {
      html += `<div class="prop-line" data-copy="${esc(i.prop)}: ${esc(i.value)};"><span class="p">${esc(i.prop)}</span><span class="val">${esc(i.value)}</span></div>`;
    });
  }
  html += `<div class="toolbar-mini" style="margin-top:8px"><button class="btn" id="copy-css">Copy computed CSS</button></div>`;
  return html;
}

function wireCss(el) {
  $("#css-view")?.addEventListener("change", (e) => {
    state.cssView = e.target.value;
    const body = $("#css-body");
    if (body) body.innerHTML = cssBody(el);
    wireCss(el);
  });
  $("#css-search")?.addEventListener("input", (e) => {
    state.cssQuery = e.target.value;
    const body = $("#css-body");
    if (body) body.innerHTML = cssBody(el);
    wireCss(el);
    const input = $("#css-search");
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  });
  document.querySelectorAll(".prop-line[data-copy]").forEach((n) => n.addEventListener("click", () => copy(n.dataset.copy)));
  $("#copy-css")?.addEventListener("click", () => {
    const lines = [];
    Object.values(el.grouped || {}).forEach((items) => items.forEach((i) => lines.push(`  ${i.prop}: ${i.value};`)));
    copy(`${el.selector} {\n${lines.join("\n")}\n}`);
  });
  $("#copy-tw")?.addEventListener("click", () => copy(el.tailwind || ""));
  document.querySelectorAll(".swatch[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
}

function renderShadows(list) {
  if (!list || !list.length) return "";
  return `<div class="section"><div class="section-title">Box shadow</div>
    ${list.map((s, i) => `<button class="shadow-layer" data-shadow="${i}" style="width:100%;text-align:left">
      Layer ${i + 1}${s.inset ? " · inset" : ""} · ${s.x} ${s.y} ${s.blur} ${s.spread} · ${esc(s.color)}
    </button>`).join("")}</div>`;
}

function wireShadows() {
  document.querySelectorAll("[data-shadow]").forEach((b) => {
    b.addEventListener("mouseenter", () => sendToTab({ type: MSG.HIGHLIGHT_SHADOW, payload: { index: Number(b.dataset.shadow) } }));
    b.addEventListener("mouseleave", () => sendToTab({ type: MSG.HIGHLIGHT_SHADOW, payload: { index: -1 } }));
  });
}

function renderGradients(list) {
  if (!list || !list.length) return "";
  return `<div class="section"><div class="section-title">Gradients</div>
    ${list.map((g) => {
      const css = g.stops.map((s) => `${s.color} ${s.position}`).join(", ");
      return `<div class="grad-bar" style="background:${esc(g.type)}(${esc(g.angle ? g.angle + ", " : "")}${esc(css)})"></div>
        <div class="font-meta" style="margin-bottom:8px">${esc(g.type)} ${esc(g.angle)}</div>`;
    }).join("")}</div>`;
}

function bezierSvg(points) {
  const p = points || [0.25, 0.1, 0.25, 1];
  const x1 = 8 + p[0] * 68, y1 = 76 - p[1] * 68, x2 = 8 + p[2] * 68, y2 = 76 - p[3] * 68;
  return `<svg class="bezier" viewBox="0 0 84 84"><path d="M8 76 C ${x1} ${y1}, ${x2} ${y2}, 76 8" fill="none" stroke="#60a5fa" stroke-width="2"/><path d="M8 76 L ${x1} ${y1} M76 8 L ${x2} ${y2}" stroke="#3f3f46" fill="none"/><circle cx="8" cy="76" r="3" fill="#fff"/><circle cx="76" cy="8" r="3" fill="#fff"/></svg>`;
}

function renderMotion(el) {
  const anims = el.animations || [];
  const trans = el.transitions || [];
  if (!anims.length && !trans.length) return "";
  return `<div class="section"><div class="section-title">Motion</div>
    ${anims.map((a) => `<div class="anim"><strong>${esc(a.name)}</strong> · ${esc(a.duration)}
      ${a.easing && a.easing.points ? bezierSvg(a.easing.points) : ""}
      ${a.keyframes ? `<pre style="white-space:pre-wrap;font-size:10px;color:var(--muted)">${esc(a.keyframes)}</pre>` : ""}
    </div>`).join("")}
    ${trans.map((t) => `<div class="anim">${esc((t.properties || []).join(", "))} · ${esc(t.duration)}
      ${t.easing && t.easing.points ? bezierSvg(t.easing.points) : ""}</div>`).join("")}
  </div>`;
}

function renderEdit(el) {
  const changes = state.changes || [];
  return `<div class="section">
    <div class="section-title">Live edit</div>
    <div class="toolbar-mini">
      <button class="btn" data-html="duplicate">Duplicate</button>
      <button class="btn" data-html="copy">Copy</button>
      <button class="btn" data-html="cut">Cut</button>
      <button class="btn" data-html="paste">Paste</button>
      <button class="btn danger" data-html="delete">Delete</button>
    </div>
    <div class="row-edit" style="margin-top:10px">
      <input id="edit-prop" placeholder="property  e.g. color" />
      <input id="edit-val" placeholder="value  e.g. #fff" />
    </div>
    <button class="btn primary" id="apply-css">Apply CSS</button>
    <div class="section-title" style="margin-top:16px">Text</div>
    <textarea id="edit-text" rows="3">${esc(el.text || "")}</textarea>
    <button class="btn" id="apply-text" style="margin-top:6px">Rewrite text</button>
    <div class="section-title" style="margin-top:16px">Changes
      ${changes.length ? '<button class="btn danger" id="revert-all">Revert all</button>' : ""}
    </div>
    ${changes.map((c) => `<div class="change">
      <div>${esc(c.selector)} · ${esc(c.type)}</div>
      ${c.prop ? `<div class="del">- ${esc(c.prop)}: ${esc(c.before)}</div><div class="add">+ ${esc(c.prop)}: ${esc(c.after)}</div>` : `<div class="del">${esc((c.action || "") + " html")}</div>`}
      <div class="change-actions"><button class="btn" data-revert="${esc(c.id)}">Revert</button></div>
    </div>`).join("") || '<p style="color:var(--dim)">No edits yet.</p>'}
  </div>`;
}

function wireEdit() {
  document.querySelectorAll("[data-html]").forEach((b) => {
    b.addEventListener("click", () => sendToTab({ type: MSG.EDIT_HTML, payload: { action: b.dataset.html } }));
  });
  $("#apply-css")?.addEventListener("click", () => {
    const prop = $("#edit-prop")?.value.trim();
    const value = $("#edit-val")?.value.trim();
    if (!prop) return;
    sendToTab({ type: MSG.EDIT_COMPUTED, payload: { prop, value } });
  });
  $("#apply-text")?.addEventListener("click", () => {
    sendToTab({ type: MSG.EDIT_HTML, payload: { action: "set-text", html: $("#edit-text")?.value || "" } });
  });
  $("#revert-all")?.addEventListener("click", () => sendToTab({ type: MSG.REVERT_ALL }));
  document.querySelectorAll("[data-revert]").forEach((b) => {
    b.addEventListener("click", () => sendToTab({ type: MSG.REVERT_CHANGE, payload: { id: b.dataset.revert } }));
  });
}

function renderPage() {
  const root = $("#page-root");
  const p = state.page;
  if (!p) {
    root.innerHTML = `<div class="empty"><p>Activate Screen Ruler on a page to load insights.</p></div>`;
    return;
  }
  const bytes = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
  root.innerHTML = `
    <div class="section">
      <div class="section-title">Social card</div>
      <div class="og-card">
        ${p.meta.ogImage ? `<img src="${esc(p.meta.ogImage)}" alt="og" />` : ""}
        <div class="body">
          <div class="host">${esc(safeHost(p.url))}</div>
          <h3>${esc(p.meta.ogTitle || p.title)}</h3>
          <p>${esc(p.meta.ogDescription || p.description || "")}</p>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">SEO</div>
      <table class="kv">
        <tr><td class="k">title</td><td class="v">${esc(p.title)}</td></tr>
        <tr><td class="k">description</td><td class="v">${esc(p.description)}</td></tr>
        <tr><td class="k">canonical</td><td class="v">${esc(p.canonical)}</td></tr>
        <tr><td class="k">lang</td><td class="v">${esc(p.lang || "—")}</td></tr>
      </table>
      ${(p.seoIssues || []).map((i) => `<div class="issue">${esc(i.message)}</div>`).join("")}
    </div>
    ${state.sampled ? `<div class="section"><div class="section-title">Last sampled color</div>
      <button class="swatch" data-copy="${esc(state.sampled.hex)}"><span class="chip" style="background:${esc(state.sampled.hex)}"></span>
      <span class="meta"><div class="name">eyedropper</div><div class="val">${esc(state.sampled.hex)}</div></span></button></div>` : ""}
    <div class="section">
      <div class="section-title">Color palette</div>
      <div class="palette">
        ${(p.colors || []).map((c) => `<button title="${esc(c.hex)} · ${c.count}" data-copy="${esc(c.hex)}" style="background:${esc(c.hex)}"></button>`).join("")}
      </div>
    </div>
    <div class="section">
      <div class="section-title">Typography</div>
      ${(p.fonts || []).map((f) => `<div class="font-card">
        <div class="font-sample" style="font-family:${esc(f.stack)};font-weight:${esc(f.weight)};font-size:${esc(f.size)}">${esc(f.sample || "Ag")}</div>
        <div class="font-meta">${esc(f.family)} · ${esc(f.size)} · ${esc(f.weight)}</div>
      </div>`).join("")}
    </div>
    <div class="section">
      <div class="section-title">Technologies</div>
      <div class="tech">${(p.tech || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("") || '<span class="hint" style="color:var(--dim)">None detected</span>'}</div>
    </div>
    <div class="section">
      <div class="section-title">Breakpoints</div>
      ${(p.breakpoints || []).map((b) => `<span class="pill">${b.px}px${b.active ? " · active" : ""}</span>`).join(" ") || '<span class="hint" style="color:var(--dim)">None found</span>'}
    </div>
    <div class="section">
      <div class="section-title">Page weight</div>
      <table class="kv">
        <tr><td class="k">transfer</td><td class="v">${bytes(p.weight.totalBytes || 0)}</td></tr>
        <tr><td class="k">requests</td><td class="v">${p.weight.requests || 0}</td></tr>
        ${Object.entries(p.weight.byType || {}).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${bytes(v)}</td></tr>`).join("")}
      </table>
    </div>
    <div class="section">
      <div class="section-title">Assets</div>
      ${(p.images || []).slice(0, 24).map((img) => `<div class="asset">
        <img src="${esc(img.src)}" alt="" />
        <div class="grow"><div class="url">${esc(img.src)}</div><div class="name">${img.width || "?"}×${img.height || "?"}</div></div>
        <button class="btn" data-dl="${esc(img.src)}">Save</button>
      </div>`).join("") || '<p style="color:var(--dim)">No images found.</p>'}
    </div>
  `;
  root.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy)));
  root.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => chrome.runtime.sendMessage({ type: MSG.DOWNLOAD_ASSET, payload: { url: b.dataset.dl } })));
}

function safeHost(url) {
  try { return new URL(url).hostname; } catch (_) { return url; }
}
