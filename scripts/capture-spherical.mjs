import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(__dirname, '../../../../.gemini/antigravity-ide/brain/adf5f721-a15e-4a2c-9cc7-9e66eca840b4');

async function main() {
  console.log('Launching browser to capture spherical components...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Capture Oort Cloud in Solar System view
  console.log('Selecting Oort Cloud preset...');
  const oortBtn = await page.waitForSelector('button[data-preset="oort"]');
  await oortBtn.click();
  await page.waitForTimeout(2000);

  // Open Reality Inspector to see tags
  const toggleReality = await page.waitForSelector('#toggleReality');
  await toggleReality.click();
  await page.waitForTimeout(1000);

  const oortPath = path.join(artifactDir, 'oort_cloud_spherical.png');
  await page.screenshot({ path: oortPath });
  console.log('Saved:', oortPath);

  // 2. Switch to Milky Way Galaxy mode and capture edge-on & perspective with halo & globular clusters
  console.log('Switching to Milky Way Galaxy mode...');
  const modeGalaxy = await page.waitForSelector('#modeGalaxy');
  await modeGalaxy.click();
  await page.waitForTimeout(1500);

  // Set camera to edge-on to highlight flat thin disc vs spherical globular clusters & halo
  await page.selectOption('#galCamera', 'edge-on');
  await page.waitForTimeout(2000);

  const haloEdgePath = path.join(artifactDir, 'milky_way_halo_edge_on.png');
  await page.screenshot({ path: haloEdgePath });
  console.log('Saved:', haloEdgePath);

  // Set camera to perspective
  await page.selectOption('#galCamera', 'perspective');
  await page.waitForTimeout(2000);

  const haloPerspPath = path.join(artifactDir, 'milky_way_halo_perspective.png');
  await page.screenshot({ path: haloPerspPath });
  console.log('Saved:', haloPerspPath);

  await browser.close();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
