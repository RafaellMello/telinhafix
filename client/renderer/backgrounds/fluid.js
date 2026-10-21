// Fundo animado "Fluid Particles" - ~2000 particulas brancas bem fracas
// levadas por um campo de ruido de Perlin (parece fumaca/fluido), com rastro:
// em vez de limpar o canvas, cada frame pinta um preto semitransparente por
// cima, entao o caminho das particulas vai sumindo devagar. Canvas 2D puro.
// Adaptado do componente FluidParticlesBackground (tema escuro).
const PARTICLE_COUNT = 2000;
const NOISE_INTENSITY = 0.003;
const SIZE_MIN = 0.5;
const SIZE_MAX = 2;
const SPEED = 2; // px por frame a 60fps (corrigido pelo tempo real do frame)
const TRAIL_FILL = 'rgba(0, 0, 0, 0.12)';

// Ruido de Perlin 3D classico (mesma tabela de permutacao do original)
const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240,
  21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
  237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83,
  111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216,
  80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,
  3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
  17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193,
  238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
  195, 78, 66, 215, 61, 156, 180,
];
const P = new Uint8Array(512);
for (let i = 0; i < 512; i++) P[i] = PERMUTATION[i & 255];

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function noise3(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X] + Y;
  const AA = P[A] + Z;
  const AB = P[A + 1] + Z;
  const B = P[X + 1] + Y;
  const BA = P[B] + Z;
  const BB = P[B + 1] + Z;
  return lerp(w,
    lerp(v, lerp(u, grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z)), lerp(u, grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1)), lerp(u, grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1))));
}

export function createFluidBackground(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return { start() {}, stop() {}, dispose() {} };

  let width = 0;
  let height = 0;
  let particles = [];
  let rafId = null;
  let lastTime = 0;

  function makeParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 50,
    };
  }

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width));
    canvas.height = Math.max(1, Math.floor(height));
    if (particles.length !== PARTICLE_COUNT) particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);
    else for (const p of particles) { p.x = Math.random() * width; p.y = Math.random() * height; }
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  function step(now) {
    // frames de 144Hz andam menos por frame, de 30Hz andam mais - mesma
    // velocidade na tela em qualquer monitor (o original assumia 60fps)
    const k = lastTime ? Math.min(3, (now - lastTime) / (1000 / 60)) : 1;
    lastTime = now;
    const t = Date.now() * 0.0001;

    ctx.fillStyle = TRAIL_FILL;
    ctx.fillRect(0, 0, width, height);

    for (const p of particles) {
      p.life += k;
      if (p.life > p.maxLife) {
        p.life = 0;
        p.x = Math.random() * width;
        p.y = Math.random() * height;
      }
      const opacity = Math.sin((p.life / p.maxLife) * Math.PI) * 0.15; // aparece e some
      const angle = noise3(p.x * NOISE_INTENSITY, p.y * NOISE_INTENSITY, t) * Math.PI * 4;
      p.x += Math.cos(angle) * SPEED * k;
      p.y += Math.sin(angle) * SPEED * k;
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
      if (opacity <= 0) continue;
      ctx.fillStyle = `rgba(255, 255, 255, ${opacity.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(step);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return {
    start() {
      if (rafId !== null) return;
      lastTime = 0;
      rafId = requestAnimationFrame(step);
    },
    stop() {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
    dispose() {
      this.stop();
      ro.disconnect();
    },
  };
}
