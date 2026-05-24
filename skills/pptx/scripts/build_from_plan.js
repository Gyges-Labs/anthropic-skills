#!/usr/bin/env node
/**
 * Build a PPTX from a compact JSON deck plan using the bundled templates.
 *
 * Usage:
 *   node /home/user/skills/pptx/scripts/build_from_plan.js .scratch/deck.json base/output.pptx
 *   node /home/user/skills/pptx/scripts/build_from_plan.js .scratch/deck.json base/output.pptx --expect-slides 8
 */

const fs = require('fs/promises');
const path = require('path');
const { spawnSync } = require('child_process');

function usage() {
  console.error(
    'Usage: build_from_plan.js <deck.json> <output.pptx> [--slides-dir <dir>] [--expect-slides <count>]'
  );
}

function parseArgs(argv) {
  const positionals = [];
  let slidesDir = path.join('.scratch', 'slides');
  let expectSlides = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slides-dir') {
      index += 1;
      slidesDir = argv[index] || slidesDir;
      continue;
    }
    if (arg === '--expect-slides') {
      index += 1;
      expectSlides = Number(argv[index]);
      if (!Number.isInteger(expectSlides) || expectSlides <= 0) {
        throw new Error(`Invalid --expect-slides value: ${argv[index]}`);
      }
      continue;
    }
    positionals.push(arg);
  }

  return {
    planPath: positionals[0],
    outPath: positionals[1],
    slidesDir,
    expectSlides,
  };
}

function assertSafePath(value, label) {
  if (!value || String(value).split(/[\\/]+/).includes('..')) {
    throw new Error(`Unsafe ${label}: ${value}`);
  }
  return path.resolve(value);
}

function runNode(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function listHtmlSlides(slidesDir) {
  const files = (await fs.readdir(slidesDir))
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => path.join(slidesDir, file));
  if (files.length === 0) {
    throw new Error(`No rendered HTML slides found in ${slidesDir}`);
  }
  return files;
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

function expectedSlideCount(parsed, cliExpected) {
  const candidates = [
    cliExpected,
    parsed?.expected_slide_count,
    parsed?.expectedSlideCount,
    parsed?.deck?.expected_slide_count,
    parsed?.deck?.expectedSlideCount,
  ];
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') {
      continue;
    }
    const value = Number(candidate);
    if (Number.isInteger(value) && value > 0) {
      return value;
    }
  }
  return null;
}

async function validatePlan(planPath, cliExpected) {
  const raw = await fs.readFile(planPath, 'utf8');
  const parsed = JSON.parse(raw);
  const slides = planSlides(parsed);
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error(
      'Deck plan must be a non-empty array, { "slides": [...] }, or { "deck": { "slides": [...] } }.'
    );
  }

  const expected = expectedSlideCount(parsed, cliExpected);
  if (expected != null && slides.length !== expected) {
    throw new Error(`Deck plan has ${slides.length} slides; expected ${expected}.`);
  }
  return slides.length;
}

async function main() {
  const { planPath, outPath, slidesDir, expectSlides } = parseArgs(process.argv.slice(2));
  if (!planPath || !outPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const resolvedPlanPath = assertSafePath(planPath, 'deck plan path');
  const resolvedOutPath = assertSafePath(outPath, 'output path');
  const resolvedSlidesDir = assertSafePath(slidesDir, 'slides directory');
  if (!resolvedOutPath.endsWith('.pptx')) {
    throw new Error(`Output path must end with .pptx: ${outPath}`);
  }

  const scriptDir = __dirname;
  const scratchDir = path.resolve('.scratch');
  const scratchOutPath = path.join(scratchDir, path.basename(resolvedOutPath));

  const plannedSlideCount = await validatePlan(resolvedPlanPath, expectSlides);
  await fs.mkdir(scratchDir, { recursive: true });

  runNode(path.join(scriptDir, 'render_templates.js'), [
    resolvedPlanPath,
    resolvedSlidesDir,
  ]);

  const htmlSlides = await listHtmlSlides(resolvedSlidesDir);
  if (htmlSlides.length !== plannedSlideCount) {
    throw new Error(
      `Rendered ${htmlSlides.length} HTML slides; expected ${plannedSlideCount}. Check duplicate output names.`
    );
  }
  runNode(path.join(scriptDir, 'build_deck.js'), ['--validate-only', ...htmlSlides]);
  runNode(path.join(scriptDir, 'build_deck.js'), [
    '--out',
    scratchOutPath,
    ...htmlSlides,
  ]);

  await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true });
  await fs.copyFile(scratchOutPath, resolvedOutPath);
  console.log(`Wrote ${resolvedOutPath}`);
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
