import * as THREE from 'three';

export function createScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1e-6, 1e6);
  camera.position.set(0, 0, 5);

  const resize = () => {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const test = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xffcc33, wireframe: true }),
  );
  scene.add(test);

  renderer.setAnimationLoop(() => {
    test.rotation.y += 0.005;
    renderer.render(scene, camera);
  });
}
