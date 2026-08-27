# Screen Ruler

Chrome extension for measuring and inspecting anything on the page. Hover for a live box model and pixel gaps, click to lock a selection, and open the side panel for CSS, layout, and page insights.

Requires **Chrome 116+**.

## Install

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and choose this folder
4. Pin **Screen Ruler**

After you change the code, click **Reload** on the extension card, then toggle it off and on on the page.

## Turn on / off

| Action | How |
| --- | --- |
| Toggle | Click the toolbar icon |
| Toggle | `Alt+Shift+S` (`Option+Shift+S` on Mac) |
| Quit | `Esc` (clears the selection first, then closes) |

Change the toggle shortcut at `chrome://extensions/shortcuts`.

When it turns on you get the bottom bar only. **Selector mode is already active** — nothing in the bar needs to be highlighted. Hover any section, icon, or image to inspect it. Click a tool to use it; click it again to turn it off. If every tool is off, selector stays on.

## Inspect & measure

- **Hover** — box model overlay, selector + size label, padding and margin, and pixel gaps between siblings (logo → icon, icon → icon, and so on)
- **Padding** — black badges
- **Margin / gaps** — red badges
- **Click** — lock the element; dashed guides span the viewport
- **Click again**, click empty space, or `Esc` — deselect

## Toolbar

| Tool | Shortcut | What it does |
| --- | --- | --- |
| Parent / child | `Alt+↑` / `Alt+↓` | Move up or down the DOM |
| Selector | `1` | Floating CSS inspector (box model, layout, appearance, text). `Space` pins the card |
| Layout grid | `3` | Column overlay. Click to open settings: columns, max width, gutter, margin, color, opacity |
| Color picker | `6` | Eyedropper; copies the hex |
| Screenshot | `8` | Capture the selected or hovered element |
| Responsive | `9` | Multi-viewport from the page’s CSS breakpoints, with synced scroll |
| Side panel | `0` | In-page Element + Page inspector |
| Pause | — | Freeze hover inspection |
| Close | — | Turn Screen Ruler off |

## Side panel

**Element** — Document, box model, computed CSS (copy), colors (solid swatches + hex), typography, live CSS/HTML edits with revert.

**Page** — Social card, SEO, palette, typography, detected technologies, breakpoints, page weight.

Copy buttons in the panel write to the clipboard.

## Project layout

```
manifest.json          Manifest V3
popup.html             Options / shortcuts hint
icons/
src/background/        Service worker (inject, toggle, badge)
src/content/           Overlay, inspect, toolbar, dock, responsive stage
src/sidepanel/         Element + Page UI
src/shared/            Constants and CSS maps
```
