# Changelog

## 0.1.0 (2026-11-15)

First release.

- Editor that runs fully in the browser: template rail with live thumbnails, GitHub README preview frame (light `#FFFFFF`, dark `#0D1117`), inspector for text, fonts, light and dark colour pairs, timing and canvas.
- Eight templates: Specimen, Ticker, Blueprint, Receipt, Ramp, Terminal, Plotter and a 410 by 200 Project card with four looping illustrations.
- Timeline scrubber: the playhead drives paused CSS animations through a negative `animation-delay`; bars can be moved and stretched, with keyframe markers.
- GitHub check: no JavaScript, no external files, fonts outlined, size against 50 kB, dark variant, alt text, reduced-motion rule, cycle length, contrast.
- Export light and dark SVGs, copy the `<picture>` snippet, import and export the config as JSON, whole design kept in the URL hash.
- 16 static faces from 12 Google Fonts families (OFL), shipped in the repo and outlined with opentype.js.
- Node CLI (`bin/masthead.mjs`) that shares the renderer, plus an example GitHub Actions workflow.
