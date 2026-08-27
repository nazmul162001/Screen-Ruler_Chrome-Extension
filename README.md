# Screen Ruler

Chrome extension for measuring, inspecting, and editing anything on the web. Hover for a live box model, click to lock a selection, and use the side panel for CSS, layout, accessibility, and page insights.

## Load unpacked

1. Open `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder
4. Pin **Screen Ruler**, then click the icon on any page (or press `Alt+Shift+S`)

Requires Chrome 116 or later (side panel + OffscreenCanvas).

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Alt+Shift+S` | Toggle Screen Ruler |
| `Alt+↑` / `Alt+↓` | Select parent / first child |
| `Esc` | Clear selection, then close |
| `1`–`9`, `0` | Control-bar tools / side panel |
| `Space` | Pin the floating inspector |

Change the toggle shortcut at `chrome://extensions/shortcuts`.

## Tools

Control bar (bottom of the page): inspect, floating inspector, X-Ray, layout grid, page rulers + guides, breakpoints, eyedropper, selector search, element screenshot, responsive presets, pause, side panel.

**Element tab:** selector, dimensions, DOM crumbs, box model, flex/grid, colors, type, WCAG contrast, computed / source / Tailwind CSS, shadows, gradients, motion, live CSS + HTML edits with revert.

**Page tab:** social card, SEO, palette, typography, technologies, breakpoints, page weight, asset download.

## Layout

```
manifest.json
icons/
src/background/service-worker.js
src/content/           overlay, inspect, tools, live edit
src/sidepanel/         Element + Page inspector
src/popup/             shortcuts / options
src/shared/            constants and CSS maps
```
