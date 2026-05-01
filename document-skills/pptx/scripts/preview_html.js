#!/usr/bin/env node
/**
 * preview_html - Render HTML slides to PNG for quick visual validation.
 *
 * Usage:
 *   node scripts/preview_html.js slides/slide1.html slides/slide2.html --outdir workspace/html_previews
 */

const fs = require('fs/promises');
const path = require('path');
const { pathToFileURL } = require('url');

const { chromium } = require('playwright');

function parseArgs(argv) {
  const htmlFiles = [];
  let outDir = path.join('workspace', 'html_previews');

  for (let idx = 0; idx < argv.length; idx += 1) {
    const arg = argv[idx];
    if (arg === '--outdir') {
      idx += 1;
      outDir = argv[idx] || outDir;
      continue;
    }
    htmlFiles.push(arg);
  }

  return { htmlFiles, outDir };
}

async function getBodyViewport(page) {
  const dims = await page.evaluate(() => {
    const body = document.body;
    const style = window.getComputedStyle(body);
    return {
      width: Math.round(parseFloat(style.width)),
      height: Math.round(parseFloat(style.height)),
    };
  });

  if (!dims.width || !dims.height) {
    throw new Error('Body dimensions are missing. Ensure body has explicit width/height.');
  }

  return dims;
}

async function renderHtmlFile(browser, htmlFile, outDir) {
  const filePath = path.resolve(htmlFile);
  const outName = `${path.basename(htmlFile, path.extname(htmlFile))}.png`;
  const outPath = path.join(outDir, outName);

  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(filePath).href);
    const viewport = await getBodyViewport(page);
    await page.setViewportSize(viewport);
    await page.screenshot({ path: outPath });
  } finally {
    await page.close();
  }

  return outPath;
}

async function main() {
  const { htmlFiles, outDir } = parseArgs(process.argv.slice(2));
  if (htmlFiles.length === 0) {
    throw new Error('No HTML files provided.');
  }

  await fs.mkdir(outDir, { recursive: true });

  const launchOptions = {};
  if (process.platform === 'darwin') {
    launchOptions.channel = 'chrome';
  }
  const browser = await chromium.launch(launchOptions);
  try {
    for (const htmlFile of htmlFiles) {
      const outPath = await renderHtmlFile(browser, htmlFile, outDir);
      console.log(`Rendered ${htmlFile} -> ${outPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.message || String(err));
  process.exitCode = 1;
});
