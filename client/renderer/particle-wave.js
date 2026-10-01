// Fundo animado (onda de particulas) atras do card de login. Adaptado de um
// componente React/Three.js pro nosso HTML puro - sem bundler aqui, entao
// usamos o build ES module do three.js vendorizado em renderer/vendor (igual
// as fontes em renderer/assets/fonts) em vez de depender do node_modules,
// que o electron-builder empacotaria inteiro (23MB, pacote completo) so por
// "three" estar em "dependencies".
import * as THREE from './vendor/three.module.js';

const canvas = document.getElementById('particle-wave-canvas');
if (canvas) {
  const loginScreen = document.getElementById('login-screen');

  const particleVertex = `
    attribute float scale;
    uniform float uTime;
    void main() {
      vec3 p = position;
      float s = scale;
      p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
      p.x += (sin(p.y + uTime) * 0.5);
      s += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
      vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = s * 10.0 * (1.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;
  const particleFragment = `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 0.4);
    }
  `;

  // Cor acompanha a cor de destaque escolhida nas configuracoes (aparencia),
  // em vez de fixa - assim o fundo sempre combina com o tema da pessoa.
  function readAccentColor() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--red-bright').trim();
    return new THREE.Color(hex || '#ff3b2f');
  }

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 6, 5);

  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const gap = 0.3;
  const amountX = 200;
  const amountY = 200;
  const particleNum = amountX * amountY;
  const particlePositions = new Float32Array(particleNum * 3);
  const particleScales = new Float32Array(particleNum);

  let i = 0;
  let j = 0;
  for (let ix = 0; ix < amountX; ix++) {
    for (let iy = 0; iy < amountY; iy++) {
      particlePositions[i] = ix * gap - (amountX * gap) / 2;
      particlePositions[i + 1] = 0;
      particlePositions[i + 2] = iy * gap - (amountX * gap) / 2;
      particleScales[j] = 1;
      i += 3;
      j++;
    }
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('scale', new THREE.BufferAttribute(particleScales, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: particleVertex,
    fragmentShader: particleFragment,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: readAccentColor() },
    },
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  let animationId = null;

  function animate() {
    particleMaterial.uniforms.uTime.value += 0.05;
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  function start() {
    if (animationId !== null) return;
    particleMaterial.uniforms.uColor.value = readAccentColor();
    animate();
  }

  function stop() {
    if (animationId === null) return;
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // So anima enquanto a tela de login esta de fato visivel - parar quando a
  // pessoa entra numa sala evita gastar GPU/bateria a toa durante a chamada.
  if (loginScreen) {
    const observer = new MutationObserver(() => {
      if (loginScreen.classList.contains('hidden')) stop();
      else start();
    });
    observer.observe(loginScreen, { attributes: true, attributeFilter: ['class'] });
    if (!loginScreen.classList.contains('hidden')) start();
  } else {
    start();
  }
}
