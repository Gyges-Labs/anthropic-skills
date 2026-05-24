#!/usr/bin/env node
/**
 * Render bundled PPTX HTML templates from a JSON deck plan.
 *
 * Usage:
 *   node /home/user/skills/pptx/scripts/render_templates.js deck.json .scratch/slides
 *
 * deck.json can be an array, { "slides": [...] }, or { "deck": { "slides": [...] } }.
 * Each slide spec:
 *   {
 *     "template": "title_hero" | "section_divider" | "two_col" | "metric_grid" | "recap",
 *     "output": "01_title.html",
 *     "values": { "TITLE": "..." }
 *   }
 */

const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const TEMPLATE_FILES = {
  title_hero: 'title_hero.html',
  section_divider: 'section_divider.html',
  two_col: 'two_col.html',
  metric_grid: 'metric_grid.html',
  recap: 'recap.html',
};

const RESERVED_SLIDE_KEYS = new Set(['template', 'layout', 'type', 'output', 'values']);

function usage() {
  console.error('Usage: render_templates.js <deck.json> <output-dir>');
}

function safeOutputName(name, index) {
  const fallback = `${String(index + 1).padStart(2, '0')}.html`;
  const value = String(name || fallback);
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error(`Unsafe output filename: ${value}`);
  }
  return value.endsWith('.html') ? value : `${value}.html`;
}

function safeOutputDir(dir) {
  const raw = String(dir || '');
  if (raw.split(/[\\/]+/).includes('..')) {
    throw new Error(`Unsafe output directory: ${dir}`);
  }
  const resolved = path.resolve(raw);
  const root = path.parse(resolved).root;
  const home = os.homedir();
  const forbiddenDirs = new Set(
    [root, process.cwd(), home].filter(Boolean).map((value) => path.resolve(value))
  );

  if (forbiddenDirs.has(resolved)) {
    throw new Error(`Unsafe output directory: ${dir}`);
  }

  const depth = resolved
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean).length;
  if (depth < 2) {
    throw new Error(`Unsafe output directory: ${dir}`);
  }

  return resolved;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function placeholderKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function normalizeRecord(record) {
  const normalized = {};
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return normalized;
  }

  for (const [key, value] of Object.entries(record)) {
    if (value == null || Array.isArray(value) || typeof value === 'object') {
      continue;
    }
    normalized[placeholderKey(key)] = value;
  }

  return normalized;
}

function setIfMissing(target, key, value) {
  if (target[key] == null && value != null && value !== '') {
    target[key] = value;
  }
}

function firstField(record, fields) {
  if (!record || typeof record !== 'object') {
    return undefined;
  }
  for (const field of fields) {
    const value = record[field];
    if (value != null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function applyTextList(target, raw, names, prefix) {
  for (const name of names) {
    const values = raw?.[name];
    if (!Array.isArray(values)) {
      continue;
    }
    values.slice(0, 4).forEach((value, index) => {
      if (typeof value === 'string' && value.trim()) {
        setIfMissing(target, `${prefix}_${index + 1}`, value.trim());
      }
    });
  }
}

function applyMetricList(target, raw) {
  const values = raw?.metrics ?? raw?.cards ?? raw?.items;
  if (!Array.isArray(values)) {
    return;
  }

  values.slice(0, 4).forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return;
    }
    const position = index + 1;
    setIfMissing(
      target,
      `METRIC_${position}`,
      firstField(item, ['metric', 'value', 'number', 'kpi'])
    );
    setIfMissing(
      target,
      `METRIC_LABEL_${position}`,
      firstField(item, ['label', 'title', 'header', 'name'])
    );
    setIfMissing(
      target,
      `METRIC_TEXT_${position}`,
      firstField(item, ['text', 'body', 'description', 'detail'])
    );
  });
}

function normalizeSlideValues(slide) {
  const topLevel = {};
  for (const [key, value] of Object.entries(slide || {})) {
    if (!RESERVED_SLIDE_KEYS.has(key)) {
      topLevel[key] = value;
    }
  }

  const nested = slide?.values && typeof slide.values === 'object' ? slide.values : {};
  const normalized = {
    ...normalizeRecord(topLevel),
    ...normalizeRecord(nested),
  };

  applyTextList(
    normalized,
    slide,
    ['bullets', 'points', 'key_points', 'keyPoints'],
    'BULLET'
  );
  applyTextList(normalized, slide, ['takeaways'], 'TAKEAWAY');
  applyMetricList(normalized, slide);
  applyTextList(
    normalized,
    nested,
    ['bullets', 'points', 'key_points', 'keyPoints'],
    'BULLET'
  );
  applyTextList(normalized, nested, ['takeaways'], 'TAKEAWAY');
  applyMetricList(normalized, nested);

  return normalized;
}

function fillBulletsFromText(target, text) {
  if (!text || target.BULLET_1 != null) {
    return;
  }
  String(text)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
    .forEach((line, index) => {
      setIfMissing(target, `BULLET_${index + 1}`, line);
    });
}

function normalizeValues(templateName, values) {
  const normalized = values && typeof values === 'object' ? { ...values } : {};

  if (templateName === 'title_hero') {
    normalized.EYEBROW ??= normalized.SECTION ?? 'Presentation';
    normalized.SUBTITLE ??= normalized.DESCRIPTION ?? normalized.LEAD_IN ?? '';
    normalized.CONTEXT_NOTE ??= normalized.NOTE ?? normalized.SUBTITLE ?? '';
    normalized.FOOTER ??= '';
  }

  if (templateName === 'section_divider') {
    normalized.SECTION ??= 'Section';
    normalized.SUBTITLE ??= normalized.DESCRIPTION ?? normalized.LEAD_IN ?? '';
    normalized.FOOTER_LEFT ??= '';
    normalized.FOOTER_RIGHT ??= '';
  }

  if (templateName === 'two_col') {
    normalized.SECTION ??= normalized.CATEGORY ?? 'Focus';
    normalized.LEAD_IN ??=
      normalized.LEFT_TEXT ??
      normalized.CONTENT ??
      normalized.BODY ??
      normalized.TEXT ??
      normalized.DESCRIPTION ??
      '';
    fillBulletsFromText(normalized, normalized.RIGHT_TEXT);
    normalized.PANEL_LABEL ??= normalized.RIGHT_LABEL ?? 'Key idea';
    normalized.PANEL_TITLE ??= normalized.RIGHT_TITLE ?? normalized.CALLOUT_TITLE ?? 'Make it stick';
    normalized.PANEL_TEXT ??=
      normalized.RIGHT_TEXT ??
      normalized.CALLOUT ??
      normalized.KEY_INSIGHT ??
      normalized.SUMMARY ??
      normalized.LEAD_IN;
    normalized.METRIC ??= normalized.NUMBER ?? '01';
  }

  if (templateName === 'metric_grid') {
    normalized.SECTION ??= 'Evidence';
    normalized.LEAD_IN ??= normalized.SUBTITLE ?? normalized.DESCRIPTION ?? '';
    for (let index = 1; index <= 4; index += 1) {
      const header =
        normalized[`HEADER_${index}`] ??
        normalized[`TITLE_${index}`] ??
        normalized[`PANEL_${index}_TITLE`] ??
        normalized[`CARD_${index}_TITLE`];
      const text =
        normalized[`TEXT_${index}`] ??
        normalized[`BODY_${index}`] ??
        normalized[`PANEL_${index}_TEXT`] ??
        normalized[`CARD_${index}_TEXT`];
      if (normalized[`METRIC_${index}`] == null && header != null) {
        normalized[`METRIC_${index}`] = `0${index}`;
      }
      if (normalized[`METRIC_LABEL_${index}`] == null && header != null) {
        normalized[`METRIC_LABEL_${index}`] = header;
      }
      if (normalized[`METRIC_TEXT_${index}`] == null && text != null) {
        normalized[`METRIC_TEXT_${index}`] = text;
      }
    }
  }

  if (templateName === 'recap') {
    for (let index = 1; index <= 4; index += 1) {
      if (
        normalized[`TAKEAWAY_${index}`] == null &&
        normalized[`BULLET_${index}`] != null
      ) {
        normalized[`TAKEAWAY_${index}`] = normalized[`BULLET_${index}`];
      }
    }
    normalized.SECTION ??= 'Recap';
    normalized.LEAD_IN ??= normalized.SUBTITLE ?? '';
    normalized.LIST_TITLE ??= 'Key takeaways';
    normalized.ACTION_LABEL ??= 'Next action';
    normalized.ACTION_TEXT ??=
      normalized.ACTION ??
      normalized.NEXT_ACTION ??
      normalized.CALL_TO_ACTION ??
      'Choose one step to apply next.';
  }

  return normalized;
}

function renderTemplate(templateName, template, values) {
  const normalized = normalizeValues(templateName, values);
  const lines = template.split('\n');
  const rendered = [];

  for (const line of lines) {
    const optionalMatch = line.match(/\{\{(BULLET|TAKEAWAY)_\d+\}\}/);
    if (optionalMatch && !normalized[optionalMatch[0].slice(2, -2)]) {
      continue;
    }
    rendered.push(
      line.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => {
        const value = normalized[key];
        return value == null ? '' : escapeHtml(value);
      })
    );
  }

  return rendered.join('\n');
}

function planSlides(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.slides)) {
    return parsed.slides;
  }
  if (Array.isArray(parsed?.deck?.slides)) {
    return parsed.deck.slides;
  }
  return undefined;
}

async function main() {
  const [, , planPath, outputDir] = process.argv;
  if (!planPath || !outputDir) {
    usage();
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(planPath, 'utf8');
  const parsed = JSON.parse(raw);
  const slides = planSlides(parsed);
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error(
      'Deck plan must be a non-empty array, { "slides": [...] }, or { "deck": { "slides": [...] } }.'
    );
  }

  const templatesDir = path.resolve(__dirname, '..', 'templates');
  const safeDir = safeOutputDir(outputDir);
  const templateCache = new Map();
  await fs.rm(safeDir, { recursive: true, force: true });
  await fs.mkdir(safeDir, { recursive: true });

  for (const [index, slide] of slides.entries()) {
    const templateName = slide && (slide.template ?? slide.layout ?? slide.type);
    const templateFile = TEMPLATE_FILES[templateName];
    if (!templateFile) {
      throw new Error(`Unknown template ${JSON.stringify(templateName)}.`);
    }
    if (!templateCache.has(templateFile)) {
      templateCache.set(
        templateFile,
        await fs.readFile(path.join(templatesDir, templateFile), 'utf8')
      );
    }
    const template = templateCache.get(templateFile);
    const html = renderTemplate(templateName, template, normalizeSlideValues(slide));
    const outName = safeOutputName(slide.output, index);
    await fs.writeFile(path.join(safeDir, outName), html, 'utf8');
    console.log(`Wrote ${path.join(safeDir, outName)}`);
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
