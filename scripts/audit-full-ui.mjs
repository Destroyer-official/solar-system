import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = 'C:\\Users\\shant\\.gemini\\antigravity-ide\\brain\\adf5f721-a15e-4a2c-9cc7-9e66eca840b4';

async function audit() {
  console.log('=== STARTING FULL UI AUDIT ===');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warn') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Check canvas
  const canvas = await page.$('canvas');
  if (!canvas) throw new Error('Canvas element not found!');
  console.log('✓ Canvas rendered successfully');

  // --- SOLAR SYSTEM TAB AUDIT ---
  console.log('\n2. Auditing Solar System View...');

  // Dynamics mode toggle
  const dynStatus = await page.$eval('#dynamicsStatus', (el) => el.textContent.trim());
  console.log(`  Initial Dynamics Mode: ${dynStatus}`);
  await page.click('#toggleDynamics');
  await page.waitForTimeout(300);
  const dynStatusAfter = await page.$eval('#dynamicsStatus', (el) => el.textContent.trim());
  console.log(`  Toggled Dynamics Mode: ${dynStatusAfter}`);

  // Validation table
  await page.click('#valTableBtn');
  await page.waitForTimeout(400);
  const valRows = await page.$$eval('.val-table tbody tr', (rows) =>
    rows.map((r) => Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim())),
  );
  console.log(`  Validation Table Rows: ${valRows.length} bodies evaluated`);
  for (const r of valRows.slice(0, 4)) {
    console.log(`    - ${r[0]} (${r[1]}): Δpos = ${r[3]}`);
  }
  await page.click('#closeValTable');
  await page.waitForTimeout(300);

  // Reality & Honesty Inspector
  await page.click('#toggleReality');
  await page.waitForTimeout(400);
  const realityItems = await page.$$eval('#realityInspector .reality-item', (items) =>
    items.map((it) => {
      const label = it.querySelector('span:first-child')?.textContent?.trim() || '';
      const tag = it.querySelector('.reality-tag, span:last-child')?.textContent?.trim() || '';
      return `${label} ${tag}`;
    }),
  );
  console.log(`  Reality Inspector Items (${realityItems.length}):`);
  for (const item of realityItems) {
    console.log(`    - ${item}`);
  }

  // Screenshot: Solar Ephemeris & Reality HUD
  const p1 = path.join(artifactDir, 'ui_audit_solar_ephemeris.png');
  await page.screenshot({ path: p1 });
  console.log(`  ✓ Saved: ${p1}`);

  // Presets testing
  console.log('  Testing Presets:');
  const presets = ['inner', 'jupiterMoons', 'oort', 'cosmic'];
  for (const pid of presets) {
    const btn = await page.$(`button[data-preset="${pid}"]`);
    if (btn) {
      await btn.click();
      await page.waitForTimeout(600);
      const label = await btn.textContent();
      console.log(`    ✓ Clicked preset: "${label.trim()}"`);
    }
  }

  // Screenshot: Oort Cloud view
  const p2 = path.join(artifactDir, 'ui_audit_solar_oort.png');
  await page.screenshot({ path: p2 });
  console.log(`  ✓ Saved: ${p2}`);

  // Corkscrew compression test
  console.log('  Testing Along-track Compression Slider...');
  await page.click('button[data-preset="cosmic"]');
  await page.selectOption('#frame', 'galactic-aligned');
  await page.fill('#compress', '-1.3'); // ~1:20
  await page.dispatchEvent('#compress', 'input');
  await page.waitForTimeout(800);
  const compLabel = await page.$eval('#cLabel', (el) => el.textContent.trim());
  console.log(`    Compression Label: ${compLabel}`);

  const p3 = path.join(artifactDir, 'ui_audit_solar_corkscrew.png');
  await page.screenshot({ path: p3 });
  console.log(`  ✓ Saved: ${p3}`);

  // Check readout contents
  const readoutText = await page.$eval('#readout', (el) => el.textContent.trim());
  const readoutLines = readoutText.split('\n').filter(Boolean);
  console.log(`  Live Readout Header: ${readoutLines[0]} | ${readoutLines[1]} | ${readoutLines[2]}`);
  console.log(`  Live Readout Bodies listed: ${readoutLines.length - 6}`);

  // --- GALAXY TAB AUDIT ---
  console.log('\n3. Auditing Milky Way Galaxy View...');
  await page.click('#modeGalaxy');
  await page.waitForTimeout(1000);

  // Readout in Galaxy mode
  const galReadout = await page.$eval('#galaxyReadout', (el) => el.textContent.trim());
  console.log('  Galaxy Readout:');
  for (const line of galReadout.split('\n').slice(0, 7)) {
    console.log(`    ${line}`);
  }

  // Camera Views
  console.log('  Testing Galaxy Camera Presets:');
  // Face-on
  await page.selectOption('#galCamera', 'face-on');
  await page.waitForTimeout(1000);
  const p4 = path.join(artifactDir, 'ui_audit_galaxy_face_on.png');
  await page.screenshot({ path: p4 });
  console.log(`    ✓ Face-on captured: ${p4}`);

  // Edge-on
  await page.selectOption('#galCamera', 'edge-on');
  await page.waitForTimeout(1000);
  const p5 = path.join(artifactDir, 'ui_audit_galaxy_edge_on.png');
  await page.screenshot({ path: p5 });
  console.log(`    ✓ Edge-on captured: ${p5}`);

  // Sgr A*
  await page.selectOption('#galCamera', 'sgra');
  await page.waitForTimeout(1000);
  const p6 = path.join(artifactDir, 'ui_audit_galaxy_sgra.png');
  await page.screenshot({ path: p6 });
  console.log(`    ✓ Sgr A* core captured: ${p6}`);

  // Perspective + Vertical Exaggeration
  await page.selectOption('#galCamera', 'perspective');
  await page.fill('#galZExag', '2.5');
  await page.dispatchEvent('#galZExag', 'input');
  await page.waitForTimeout(600);
  const zExagVal = await page.$eval('#galZExagVal', (el) => el.textContent.trim());
  console.log(`    ✓ Vertical Exaggeration set to: ${zExagVal}`);

  // LSR Models
  await page.selectOption('#galaxyModel', 'reid2019');
  await page.waitForTimeout(300);
  console.log('    ✓ Switched LSR model to Reid et al. 2019');

  // Return to Solar tab
  await page.click('#modeSolar');
  await page.waitForTimeout(500);
  console.log('✓ Returned to Solar System tab cleanly');

  // Check errors
  console.log('\n4. Diagnostics & Error Summary:');
  const criticalErrors = consoleErrors.filter((e) => !e.includes('favicon'));
  console.log(`  Console Errors: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    criticalErrors.forEach((e) => console.log(`    [ERROR] ${e}`));
  } else {
    console.log('  ✓ Zero runtime or DOM errors detected');
  }

  await browser.close();
  console.log('\n=== UI AUDIT COMPLETE ===');
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
