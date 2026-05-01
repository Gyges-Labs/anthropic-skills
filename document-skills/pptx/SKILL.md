---
name: pptx
description: "Presentation creation (quick), plus optional editing/analysis workflows."
license: Proprietary. LICENSE.txt has complete terms
---

# pptx (quickstart)

Create a clean, modern `.pptx` in a few steps with minimal code.

## Create a new deck

1. *(Optional)* Generate images (recommended: `aspect_ratio="16:9"`).
2. Create `slides/slide1.html`, `slides/slide2.html`, ... using the templates:
   - `/home/user/skills/pptx/templates/title_hero.html`
   - `/home/user/skills/pptx/templates/two_col.html`
3. Build:

```bash
node /home/user/skills/pptx/scripts/build_deck.js --out output.pptx slides/*.html
```

Don’t write a custom Node “runner” script unless you truly need placeholder-based charts.

## Avoid overflow (most common failure)

- Keep each slide to **≤1 short paragraph OR ≤5 bullets**.
- Don’t add `margin`/`padding` to `html`/`body`; keep content inside the `.safe` container in the templates.
- For charts/plots, prefer embedding a PNG via `<img>` (avoid placeholder + custom JS unless necessary).

## If it fails

Re-run the same command. It prints the top overflowing elements and writes debug screenshots to `workspace/html2pptx_debug/`.

## Optional visual check

```bash
python /home/user/skills/pptx/scripts/thumbnail.py output.pptx workspace/thumbnails --cols 4
```

## Reference (only if needed)

- Custom HTML rules + placeholders/charts: `html2pptx.md`
- Editing an existing `.pptx` via OOXML: `ooxml.md`

## Dependencies

Preinstalled in the Timon sandbox template; do not install unless you hit a real “module not found”.

```bash
node -e "require('pptxgenjs'); require('playwright'); require('sharp'); console.log('node deps ok')"
```
