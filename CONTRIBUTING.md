# Contributing

Thanks for helping with Masthead, a browser editor for animated SVG banners for GitHub READMEs. Issues, ideas and pull requests are all welcome.

## Getting started

You need Node 22.18 or newer.

```bash
git clone https://github.com/Murali1801/masthead.git
cd masthead
npm install
npm run dev
```

Before you open a pull request:

```bash
npm test
npm run build
```

Both run in CI on every pull request.

## Where things live

- `src/core/` is the renderer shared by the editor and the CLI: templates, text to paths, motion, the GitHub check and the README snippet. Tests are in `tests/`.
- `src/app/` is the editor UI (template rail, preview frame, inspector, timeline).
- `bin/masthead.mjs` is the Node CLI; `public/fonts/` holds the OFL fonts with their licences.

## Project rules

- Generated SVGs must pass the GitHub check: no JavaScript, no external files, under 50 kB, alt text, a reduced-motion rule.
- New fonts must be OFL (or similar) and listed in `public/fonts/LICENSES.md`.
- Keep renderer output deterministic so the snapshot tests stay meaningful.

## Good first issues

Issues labelled [good first issue](https://github.com/Murali1801/masthead/labels/good%20first%20issue) are small and self-contained. Comment on one before you start so two people don't pick the same thing.

## Pull requests

- One change per pull request, with a short description of what and why.
- Add or update tests when you change logic.
- Screenshots or a short screen recording help for anything visual.

## Code of conduct

Be kind and assume good intent. Harassment or personal attacks aren't tolerated.
