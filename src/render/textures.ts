import * as THREE from 'three';

/** Procedural celestial texture generator for realistic planetary surfaces */

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createSunTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff9900');
  grad.addColorStop(0.5, '#ffcc00');
  grad.addColorStop(1, '#ff8800');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Solar granulation & turbulent flare spots
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = Math.random() * 4 + 1;
    ctx.fillStyle = Math.random() > 0.4 ? '#ffee66' : '#e66600';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createMercuryTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#8c8882';
  ctx.fillRect(0, 0, 512, 256);

  // Basaltic maria & crater impacts
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = Math.random() * 6 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? '#68645e' : '#aba7a0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createVenusTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#e8cf99');
  grad.addColorStop(0.3, '#edd8a8');
  grad.addColorStop(0.5, '#f5e4bd');
  grad.addColorStop(0.7, '#edd8a8');
  grad.addColorStop(1, '#e8cf99');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Sulfuric acid atmospheric circulation bands
  ctx.fillStyle = 'rgba(215, 185, 125, 0.25)';
  for (let y = 10; y < 250; y += 14) {
    ctx.fillRect(0, y, 512, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createEarthTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(1024, 512);
  // Deep oceans
  ctx.fillStyle = '#10386e';
  ctx.fillRect(0, 0, 1024, 512);

  // Continents (Africa, Eurasia, Americas, Australia)
  ctx.fillStyle = '#2d5a27'; // Lush vegetation / green land
  // Eurasia / Africa block
  ctx.beginPath();
  ctx.ellipse(550, 200, 180, 100, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c49a45'; // Sahara / deserts
  ctx.beginPath();
  ctx.ellipse(520, 240, 90, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d5a27';
  ctx.beginPath();
  ctx.ellipse(540, 340, 70, 90, 0.2, 0, Math.PI * 2); // Africa south
  ctx.fill();
  // North & South America
  ctx.beginPath();
  ctx.ellipse(220, 180, 110, 80, -0.2, 0, Math.PI * 2);
  ctx.ellipse(280, 360, 75, 110, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Australia
  ctx.beginPath();
  ctx.ellipse(800, 380, 60, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Polar ice caps
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 30); // Arctic
  ctx.fillRect(0, 480, 1024, 32); // Antarctica

  // Swirling white cloud layers
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 380 + 60;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.random() * 80 + 30, Math.random() * 15 + 5, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createMarsTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  // Red iron oxide deserts
  ctx.fillStyle = '#c15128';
  ctx.fillRect(0, 0, 512, 256);

  // Dark volcanic plains (Syrtis Major, Mare Tyrrhenum)
  ctx.fillStyle = '#6b2d18';
  ctx.beginPath();
  ctx.ellipse(280, 140, 80, 40, 0.3, 0, Math.PI * 2);
  ctx.ellipse(140, 160, 70, 30, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // White polar ice caps
  ctx.fillStyle = '#f8f0ea';
  ctx.beginPath();
  ctx.ellipse(256, 12, 60, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(256, 246, 50, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createJupiterTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(1024, 512);

  // Multi-banded zones and belts
  const bands = [
    { y: 0, h: 40, c: '#b59770' }, // Polar zone
    { y: 40, h: 35, c: '#7f5636' }, // North polar belt
    { y: 75, h: 45, c: '#cfba96' }, // North temperate zone
    { y: 120, h: 50, c: '#8a4b2a' }, // North temperate belt
    { y: 170, h: 45, c: '#e3cfab' }, // North tropical zone
    { y: 215, h: 55, c: '#9c4c23' }, // North equatorial belt
    { y: 270, h: 40, c: '#e5d1b3' }, // Equatorial zone
    { y: 310, h: 55, c: '#91461f' }, // South equatorial belt
    { y: 365, h: 45, c: '#dfcba4' }, // South tropical zone
    { y: 410, h: 40, c: '#7d492c' }, // South temperate belt
    { y: 450, h: 62, c: '#a88c67' }, // South polar zone
  ];
  for (const b of bands) {
    ctx.fillStyle = b.c;
    ctx.fillRect(0, b.y, 1024, b.h);
  }

  // Atmospheric turbulence & eddy swirls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 1024, Math.random() * 512, Math.random() * 40 + 10, Math.random() * 4 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The Great Red Spot (in the South Tropical Zone)
  const spotX = 620, spotY = 345;
  ctx.fillStyle = '#bb3820';
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, 55, 32, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#db5530';
  ctx.beginPath();
  ctx.ellipse(spotX, spotY, 35, 20, 0.05, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createSaturnTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  // Golden butterscotch atmospheric bands
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#8f7b57');
  grad.addColorStop(0.2, '#c7ab77');
  grad.addColorStop(0.4, '#e5cd97');
  grad.addColorStop(0.5, '#eddcb1');
  grad.addColorStop(0.6, '#dfc488');
  grad.addColorStop(0.8, '#b89961');
  grad.addColorStop(1, '#826f4f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle cloud stripes
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  for (let y = 30; y < 220; y += 12) {
    ctx.fillRect(0, y, 512, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createSaturnRingTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 1);
  // Concentric radial ring bands: C Ring, B Ring, Cassini Division, A Ring, Encke Gap
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, 'rgba(0,0,0,0)'); // Inner space
  grad.addColorStop(0.12, 'rgba(120, 110, 95, 0.3)'); // C Ring (transparent)
  grad.addColorStop(0.28, 'rgba(215, 195, 155, 0.95)'); // B Ring (dense, bright)
  grad.addColorStop(0.58, 'rgba(205, 185, 145, 0.95)'); // B Ring outer
  grad.addColorStop(0.60, 'rgba(10, 10, 10, 0.05)'); // Cassini Division gap!
  grad.addColorStop(0.64, 'rgba(10, 10, 10, 0.05)'); // Cassini Division gap!
  grad.addColorStop(0.66, 'rgba(185, 170, 135, 0.85)'); // A Ring inner
  grad.addColorStop(0.86, 'rgba(175, 160, 125, 0.85)'); // A Ring middle
  grad.addColorStop(0.88, 'rgba(30, 30, 30, 0.1)'); // Encke Gap
  grad.addColorStop(0.92, 'rgba(165, 150, 120, 0.7)'); // A Ring outer
  grad.addColorStop(1.0, 'rgba(0,0,0,0)'); // Beyond A ring
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 1);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createUranusTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#78bcc8');
  grad.addColorStop(0.5, '#9ee5ef');
  grad.addColorStop(1, '#78bcc8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createNeptuneTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2d57b8');
  grad.addColorStop(0.4, '#4275e3');
  grad.addColorStop(0.6, '#3664d4');
  grad.addColorStop(1, '#254ba6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Great Dark Spot & methane storm clouds
  ctx.fillStyle = '#1c3882';
  ctx.beginPath();
  ctx.ellipse(320, 130, 45, 25, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(310, 160, 40, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}


export function createMoonTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#8f8e8b';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#595754';
  const maria = [
    [160, 90, 60, 45],
    [230, 80, 45, 40],
    [250, 130, 40, 30],
    [290, 110, 35, 30],
    [320, 140, 25, 25],
  ];
  for (const [x, y, rx, ry] of maria) {
    ctx.beginPath();
    ctx.ellipse(x!, y!, rx!, ry!, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = Math.random() * 4 + 1;
    ctx.fillStyle = Math.random() > 0.3 ? '#b0aeaa' : '#454340';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createIoTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#e5c43b';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = 'rgba(215, 140, 35, 0.4)';
  for (let i = 0; i < 150; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 512, Math.random() * 256, Math.random() * 30 + 10, Math.random() * 15 + 5, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512, y = Math.random() * 256;
    ctx.fillStyle = '#c93414';
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 8 + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1510';
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createEuropaTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#eaf0f8';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(165, 92, 59, 0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 256);
    ctx.bezierCurveTo(
      Math.random() * 512, Math.random() * 256,
      Math.random() * 512, Math.random() * 256,
      Math.random() * 512, Math.random() * 256
    );
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createGanymedeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#655e56';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(180, 195, 210, 0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 256);
    ctx.lineTo(Math.random() * 512, Math.random() * 256);
    ctx.stroke();
  }

  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = '#e8f0fc';
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createCallistoTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#3f3a35';
  ctx.fillRect(0, 0, 512, 256);

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = Math.random() * 3 + 1;
    ctx.fillStyle = Math.random() > 0.4 ? '#b8c4d0' : '#282420';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createTitanTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#bd6e22');
  grad.addColorStop(0.3, '#e08f32');
  grad.addColorStop(0.5, '#ea9d3e');
  grad.addColorStop(0.7, '#e08f32');
  grad.addColorStop(1, '#a85b1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = 'rgba(110, 60, 22, 0.35)';
  for (let y = 110; y < 155; y += 8) {
    ctx.fillRect(0, y, 512, 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createPlutoTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#8f5235';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#3a1f14';
  ctx.fillRect(0, 120, 512, 50);

  ctx.fillStyle = '#f6ede0';
  ctx.beginPath();
  ctx.ellipse(230, 130, 45, 55, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(275, 138, 35, 45, -0.15, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function createCharonTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas(512, 256);
  ctx.fillStyle = '#7c7a78';
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#683624';
  ctx.beginPath();
  ctx.ellipse(256, 30, 90, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export const PLANET_TEXTURE_GETTERS: Record<string, () => THREE.CanvasTexture> = {
  sun: createSunTexture,
  mercury: createMercuryTexture,
  venus: createVenusTexture,
  earth: createEarthTexture,
  mars: createMarsTexture,
  jupiter: createJupiterTexture,
  saturn: createSaturnTexture,
  uranus: createUranusTexture,
  neptune: createNeptuneTexture,
  moon: createMoonTexture,
  io: createIoTexture,
  europa: createEuropaTexture,
  ganymede: createGanymedeTexture,
  callisto: createCallistoTexture,
  titan: createTitanTexture,
  pluto: createPlutoTexture,
  charon: createCharonTexture,
};
