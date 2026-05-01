#!/usr/bin/env node
/**
 * build_deck - Convert one or more HTML slide files into a PPTX.
 *
 * Why this exists:
 * - Avoids common import mistakes (html2pptx exports a function, not an object).
 * - Can validate multiple slides in one run and print all failures at once.
 *
 * Usage:
 *   node /home/user/skills/pptx/scripts/build_deck.js --out banana.pptx slides/slide1.html slides/slide2.html
 *
 * Flags:
 *   --out <file>          Output pptx (default: output.pptx)
 *   --layout <name>       PptxGenJS layout (default: LAYOUT_16x9)
 *   --debug               Save a debug screenshot on validation failures
 *   --debug-dir <dir>     Where debug screenshots are written (default: workspace/html2pptx_debug)
 *   --validate-only       Run validation only (no PPTX written)
 *   --continue-on-error   Continue validating remaining slides after a failure
 */

const fs = require('fs/promises');
const path = require('path');

const { chromium } = require('playwright');
const pptxgen = require('pptxgenjs');

const html2pptx = require('../html2pptx');

async function warnIfPlaceholders(htmlFile) {
  const content = await fs.readFile(htmlFile, { encoding: 'utf-8' });
  const matches = content.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (!matches) return;
  const unique = Array.from(new Set(matches)).slice(0, 8);
  console.warn(
    `Warning: ${htmlFile} contains unreplaced placeholders: ${unique.join(', ')}`
  );
}

function parseArgs(argv) {
  const htmlFiles = [];
  let outFile = 'output.pptx';
  let layout = 'LAYOUT_16x9';
  let debug = true;
  let debugDir = path.join(process.cwd(), 'workspace', 'html2pptx_debug');
  let validateOnly = false;
  let continueOnError = true;

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    if (arg === '--out') {
      idx += 1;
      outFile = argv[idx] || outFile;
      continue;
    }
    if (arg === '--layout') {
      idx += 1;
      layout = argv[idx] || layout;
      continue;
    }
    if (arg === '--debug') {
      debug = true;
      continue;
    }
    if (arg === '--debug-dir') {
      idx += 1;
      debugDir = argv[idx] || debugDir;
      continue;
    }
    if (arg === '--validate-only') {
      validateOnly = true;
      continue;
    }
    if (arg === '--continue-on-error') {
      continueOnError = true;
      continue;
    }
    htmlFiles.push(arg);
  }

  return {
    htmlFiles,
    outFile,
    layout,
    debug,
    debugDir,
    validateOnly,
    continueOnError,
  };
}

async function ensureParentDir(filePath) {
  const parent = path.dirname(path.resolve(filePath));
  if (!parent || parent === '.' || parent === process.cwd()) return;
  await fs.mkdir(parent, { recursive: true });
}

function formatErrors(errors) {
  const lines = ['Validation failures:'];
  for (const err of errors) {
    lines.push('');
    lines.push(`- ${err.file}`);
    lines.push(`  ${err.message.replace(/\n/g, '\n  ')}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.htmlFiles.length === 0) {
    throw new Error('No HTML files provided.');
  }

  const pptx = new pptxgen();
  pptx.layout = args.layout;

  const tmpDir = process.env.TMPDIR || '/tmp';
  const launchOptions = { env: { ...process.env, TMPDIR: tmpDir } };
  if (process.platform === 'darwin') {
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();

  const errors = [];
  try {
    for (const [index, htmlFile] of args.htmlFiles.entries()) {
      console.log(`[${index + 1}/${args.htmlFiles.length}] ${htmlFile}`);
      try {
        await warnIfPlaceholders(htmlFile);
        await html2pptx(htmlFile, pptx, {
          context,
          tmpDir,
          debug: args.debug,
          debugDir: args.debugDir,
        });
      } catch (err) {
        errors.push({ file: htmlFile, message: err?.message || String(err) });
        if (!args.continueOnError) {
          break;
        }
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (errors.length > 0) {
    console.error(formatErrors(errors));
    process.exitCode = 1;
    return;
  }

  if (args.validateOnly) {
    console.log('All slides validated successfully.');
    return;
  }

  await ensureParentDir(args.outFile);
  await pptx.writeFile({ fileName: args.outFile });
  console.log(`Wrote ${args.outFile}`);
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
