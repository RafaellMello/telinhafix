// Fundo animado "Pixels" - grade de quadradinhos que flui num campo de ruido
// e desenha a palavra TELINHAFIX na cor principal (Aparencia > Cor
// principal); o resto da grade fica num cinza bem apagado. O mouse empurra os
// pixels por onde passa e eles voltam devagar; ao aparecer, a grade chega
// espalhada e se junta formando a palavra. Canvas 2D puro.
// Adaptado do componente PixelFlowField (tema escuro, sem React).
const TEXT = 'TELINHAFIX';
const WEIGHT = 800;
const CELL_SIZE = 8;
const GAP = 3;
const SPEED = 1;
const POINTER_RADIUS = 130;
const POINTER_STRENGTH = 1;
const FIELD_GREY = [150, 150, 150, 1];

const MAX_DPR = 2;
const TAU = Math.PI * 2;
const MIN_STEP = 3;
const MIN_COLS = 44;
const MAX_CELLS = 14000;
const MIN_DRAW = 0.35;
const TIER_COUNT = 7;
const RAMP_MID = 0.6;
const FIELD_ALPHA = 0.24;
const ACCENT_ALPHA = 0.92;
const INK_ALPHA = 1;
const MASK_LOW = 0.08;
const MASK_HIGH = 0.86;
const TEXT_HEIGHT_RATIO = 0.68;
const TEXT_WIDTH_RATIO = 0.86;
const LATTICE = 4;
const NOISE_SCALE = 0.19;
const TIME_SCALE = 0.14;
const FLOW_TURNS = 1.35;
const MAG_FLOOR = 0.35;
const MAG_RANGE = 0.65;
const NOISE_OFFSET_X = 37.2;
const NOISE_OFFSET_Y = 11.5;
const NOISE_COUNTER_FLOW = 0.8;
const DRIFT_RATIO = 0.95;
const WORD_CALM = 0.84;
const SIZE_FLOOR = 0.3;
const SIZE_MASK = 0.64;
const SIZE_FLOW = 0.2;
const REFORM_MS = 1750;
const STAGGER = 0.45;
const WORD_LEAD = 0.16;
const DELAY_X = 0.55;
const DELAY_Y = 0.3;
const DELAY_JITTER = 0.15;
const SCATTER_SIZE = 0.5;
const SCATTER_SPREAD = 1.25;
const WAKE_TAU = 0.42;
const WAKE_GAIN = 3.4;
const WAKE_CEILING = 2.4;
const MAX_SUBSTEPS = 4;
const MAX_DT = 0.05;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (v) => v * v * (3 - 2 * v);
const hash2 = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453123;
  return v - Math.floor(v);
};
const valueNoise = (x, y) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const ux = smoothstep(x - ix);
  const uy = smoothstep(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
};
const mix = (from, to, t) => Math.round(from + (to - from) * t);

// cobertura da celula -> cor: cinza apagado (fora da palavra) -> cor principal
function rampCss(coverage, colors) {
  const [field, accent, ink] = colors;
  const low = coverage <= RAMP_MID;
  const from = low ? field : accent;
  const to = low ? accent : ink;
  const t = low ? coverage / RAMP_MID : (coverage - RAMP_MID) / (1 - RAMP_MID);
  const fromAlpha = low ? FIELD_ALPHA : ACCENT_ALPHA;
  const toAlpha = low ? ACCENT_ALPHA : INK_ALPHA;
  const a = fromAlpha + (toAlpha - fromAlpha) * t;
  return `rgba(${mix(from[0], to[0], t)}, ${mix(from[1], to[1], t)}, ${mix(from[2], to[2], t)}, ${a.toFixed(3)})`;
}

function readAccent() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#e2231a';
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { key: hex, rgba: [226, 35, 26, 1] };
  const n = parseInt(m[1], 16);
  return { key: hex, rgba: [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1] };
}

export function createPixelsBackground(canvas) {
  const context = canvas.getContext('2d');
  if (!context) return { start() {}, stop() {}, dispose() {} };
  const sampler = document.createElement('canvas');
  const samplerContext = sampler.getContext('2d', { willReadFrequently: true });

  let accent = readAccent();
  let colors = [FIELD_GREY, accent.rgba, accent.rgba];
  let fontFamily = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  let width = 1;
  let height = 1;
  let cols = 1;
  let rows = 1;
  let count = 1;
  let step = CELL_SIZE + GAP;
  let cellPx = CELL_SIZE;
  let mask = new Float32Array(1);
  let ampFactor = new Float32Array(1);
  let sizeBase = new Float32Array(1);
  let homeX = new Float32Array(1);
  let homeY = new Float32Array(1);
  let scatterX = new Float32Array(1);
  let scatterY = new Float32Array(1);
  let wakeX = new Float32Array(1);
  let wakeY = new Float32Array(1);
  let delay = new Float32Array(1);
  let latticeIndex = new Int32Array(1);
  let latticeWx = new Float32Array(1);
  let latticeWy = new Float32Array(1);
  let latCols = 2;
  let latRows = 2;
  let fieldU = new Float32Array(4);
  let fieldV = new Float32Array(4);
  let tiers = [];
  let tierCss = [];
  let sampleKey = '';

  let pointerX = 0;
  let pointerY = 0;
  let prevPointerX = 0;
  let prevPointerY = 0;
  let pointerActive = false;

  const startedAt = performance.now();
  let lastFrameAt = startedAt;
  let scatterAt = startedAt;
  let hasStarted = false;
  let rafId = null;
  let frameCount = 0;

  function allocate() {
    mask = new Float32Array(count);
    ampFactor = new Float32Array(count);
    sizeBase = new Float32Array(count);
    homeX = new Float32Array(count);
    homeY = new Float32Array(count);
    scatterX = new Float32Array(count);
    scatterY = new Float32Array(count);
    wakeX = new Float32Array(count);
    wakeY = new Float32Array(count);
    delay = new Float32Array(count);
    latticeIndex = new Int32Array(count);
    latticeWx = new Float32Array(count);
    latticeWy = new Float32Array(count);
  }

  // Escreve a palavra uma vez num bitmap de 1 pixel por celula e le de volta
  // (so quando a grade muda, nunca no loop de animacao).
  function sampleSource() {
    if (!samplerContext) { mask.fill(0); return; }
    sampler.width = cols;
    sampler.height = rows;
    samplerContext.clearRect(0, 0, cols, rows);
    let fontSize = Math.max(rows * TEXT_HEIGHT_RATIO, 1);
    samplerContext.font = `${WEIGHT} ${fontSize}px ${fontFamily}`;
    const measured = samplerContext.measureText(TEXT).width;
    const maxWidth = cols * TEXT_WIDTH_RATIO;
    if (measured > maxWidth && measured > 0) {
      fontSize = Math.max((fontSize * maxWidth) / measured, 1);
      samplerContext.font = `${WEIGHT} ${fontSize}px ${fontFamily}`;
    }
    samplerContext.fillStyle = '#ffffff';
    samplerContext.textAlign = 'center';
    samplerContext.textBaseline = 'middle';
    samplerContext.fillText(TEXT, cols / 2, rows / 2);
    const pixels = samplerContext.getImageData(0, 0, cols, rows).data;
    const span = MASK_HIGH - MASK_LOW;
    for (let i = 0; i < count; i++) {
      const p = i * 4;
      const luma = (pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722) / 255;
      const coverage = (luma * pixels[p + 3]) / 255;
      mask[i] = smoothstep(clamp((coverage - MASK_LOW) / span, 0, 1));
    }
  }

  function buildDerived() {
    for (let row = 0; row < rows; row++) {
      const ny = rows > 1 ? row / (rows - 1) : 0;
      const latY = row / LATTICE;
      const iy = Math.floor(latY);
      const wy = latY - iy;
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const nx = cols > 1 ? col / (cols - 1) : 0;
        const m = mask[i];
        homeX[i] = (col + 0.5) * step;
        homeY[i] = (row + 0.5) * step;
        ampFactor[i] = 1 - m * WORD_CALM;
        sizeBase[i] = SIZE_FLOOR + SIZE_MASK * m;
        delay[i] = clamp(nx * DELAY_X + ny * DELAY_Y + hash2(col, row) * DELAY_JITTER - m * WORD_LEAD, 0, 1);
        const latX = col / LATTICE;
        const ix = Math.floor(latX);
        latticeIndex[i] = iy * latCols + ix;
        latticeWx[i] = latX - ix;
        latticeWy[i] = wy;
      }
    }
  }

  function buildScatter(seed) {
    const offset = (SCATTER_SPREAD - 1) / 2;
    for (let i = 0; i < count; i++) {
      scatterX[i] = (hash2(i + 1, seed * 1.7 + 3.1) * SCATTER_SPREAD - offset) * width;
      scatterY[i] = (hash2(seed * 2.3 + 7.7, i + 1) * SCATTER_SPREAD - offset) * height;
    }
  }

  function buildTiers() {
    const buckets = Array.from({ length: TIER_COUNT }, () => []);
    for (let i = 0; i < count; i++) buckets[Math.min(TIER_COUNT - 1, Math.floor(mask[i] * TIER_COUNT))].push(i);
    tiers = buckets.map((b) => Int32Array.from(b));
    tierCss = buckets.map((_, tier) => rampCss((tier + 0.5) / TIER_COUNT, colors));
  }

  function buildGrid() {
    step = Math.max(CELL_SIZE + GAP, MIN_STEP);
    cellPx = CELL_SIZE;
    cols = Math.max(1, Math.ceil(width / step));
    rows = Math.max(1, Math.ceil(height / step));
    const legibleStep = Math.max(width / MIN_COLS, MIN_STEP);
    if (width >= MIN_COLS && legibleStep < step) {
      cellPx *= legibleStep / step;
      step = legibleStep;
      cols = Math.max(1, Math.ceil(width / step));
      rows = Math.max(1, Math.ceil(height / step));
    }
    // tela grande: engrossa a grade em vez de passar do limite de celulas
    if (cols * rows > MAX_CELLS) {
      const scale = Math.sqrt((cols * rows) / MAX_CELLS);
      step *= scale;
      cellPx *= scale;
      cols = Math.max(1, Math.ceil(width / step));
      rows = Math.max(1, Math.ceil(height / step));
    }
    const nextCount = cols * rows;
    const resized = nextCount !== count;
    count = nextCount;
    latCols = Math.ceil(cols / LATTICE) + 2;
    latRows = Math.ceil(rows / LATTICE) + 2;
    if (resized) allocate();
    if (fieldU.length !== latCols * latRows) {
      fieldU = new Float32Array(latCols * latRows);
      fieldV = new Float32Array(latCols * latRows);
    }
    const key = `${cols}|${rows}|${fontFamily}`;
    if (key !== sampleKey || resized) {
      sampleKey = key;
      sampleSource();
    }
    buildDerived();
    buildScatter(0);
    buildTiers();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = Math.max(1, rect.width || window.innerWidth);
    height = Math.max(1, rect.height || window.innerHeight);
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildGrid();
  }

  function updateFlowField(time) {
    for (let ly = 0; ly < latRows; ly++) {
      const gy = ly * LATTICE * NOISE_SCALE;
      const base = ly * latCols;
      for (let lx = 0; lx < latCols; lx++) {
        const gx = lx * LATTICE * NOISE_SCALE;
        const swirl = valueNoise(gx, gy + time);
        const strength = valueNoise(gx + NOISE_OFFSET_X, gy - time * NOISE_COUNTER_FLOW + NOISE_OFFSET_Y);
        const angle = swirl * TAU * FLOW_TURNS;
        const magnitude = MAG_FLOOR + MAG_RANGE * strength;
        fieldU[base + lx] = Math.cos(angle) * magnitude;
        fieldV[base + lx] = Math.sin(angle) * magnitude;
      }
    }
  }

  function stampWake(px, py, dt) {
    const radius = POINTER_RADIUS;
    const limit = radius * radius;
    const ceiling = step * WAKE_CEILING;
    const firstCol = clamp(Math.floor((px - radius) / step), 0, cols - 1);
    const lastCol = clamp(Math.ceil((px + radius) / step), 0, cols - 1);
    const firstRow = clamp(Math.floor((py - radius) / step), 0, rows - 1);
    const lastRow = clamp(Math.ceil((py + radius) / step), 0, rows - 1);
    for (let row = firstRow; row <= lastRow; row++) {
      const base = row * cols;
      for (let col = firstCol; col <= lastCol; col++) {
        const i = base + col;
        const dx = homeX[i] - px;
        const dy = homeY[i] - py;
        const sq = dx * dx + dy * dy;
        if (sq >= limit || sq === 0) continue;
        const dist = Math.sqrt(sq);
        const falloff = 1 - dist / radius;
        const push = falloff * falloff * POINTER_STRENGTH * radius * WAKE_GAIN * dt;
        wakeX[i] = clamp(wakeX[i] + (dx / dist) * push, -ceiling, ceiling);
        wakeY[i] = clamp(wakeY[i] + (dy / dist) * push, -ceiling, ceiling);
      }
    }
  }

  // percorre o caminho do mouse desde o ultimo frame - um movimento rapido
  // deixa um rastro continuo em vez de pontos soltos
  function advanceWake(dt) {
    if (!pointerActive) { prevPointerX = pointerX; prevPointerY = pointerY; return; }
    const dx = pointerX - prevPointerX;
    const dy = pointerY - prevPointerY;
    const steps = clamp(Math.ceil(Math.hypot(dx, dy) / step), 1, MAX_SUBSTEPS);
    const slice = dt / steps;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      stampWake(prevPointerX + dx * t, prevPointerY + dy * t, slice);
    }
    prevPointerX = pointerX;
    prevPointerY = pointerY;
  }

  function drawFlowing(reform, decay) {
    const settled = reform >= 1;
    const rest = 1 / (1 - STAGGER);
    const drift = step * DRIFT_RATIO;
    for (let tier = 0; tier < tiers.length; tier++) {
      const bucket = tiers[tier];
      if (bucket.length === 0) continue;
      context.fillStyle = tierCss[tier];
      context.beginPath();
      for (const i of bucket) {
        const wx = wakeX[i] * decay;
        const wy = wakeY[i] * decay;
        wakeX[i] = wx;
        wakeY[i] = wy;
        const corner = latticeIndex[i];
        const tx = latticeWx[i];
        const ty = latticeWy[i];
        const below = corner + latCols;
        const uTop = fieldU[corner] + (fieldU[corner + 1] - fieldU[corner]) * tx;
        const uBottom = fieldU[below] + (fieldU[below + 1] - fieldU[below]) * tx;
        const vTop = fieldV[corner] + (fieldV[corner + 1] - fieldV[corner]) * tx;
        const vBottom = fieldV[below] + (fieldV[below + 1] - fieldV[below]) * tx;
        const u = uTop + (uBottom - uTop) * ty;
        const v = vTop + (vBottom - vTop) * ty;
        const magnitude = Math.abs(u) + Math.abs(v);
        const amplitude = drift * ampFactor[i];
        const restX = homeX[i] + u * amplitude + wx;
        const restY = homeY[i] + v * amplitude + wy;
        let x = restX;
        let y = restY;
        let scale = 1;
        if (!settled) {
          const local = clamp((reform - delay[i] * STAGGER) * rest, 0, 1);
          const inv = 1 - local;
          const eased = 1 - inv * inv * inv; // chegam desacelerando
          x = scatterX[i] + (restX - scatterX[i]) * eased;
          y = scatterY[i] + (restY - scatterY[i]) * eased;
          scale = SCATTER_SIZE + (1 - SCATTER_SIZE) * eased;
        }
        const size = cellPx * (sizeBase[i] + SIZE_FLOW * magnitude) * scale;
        if (size <= MIN_DRAW) continue;
        if (x < -size || x > width + size || y < -size || y > height + size) continue;
        const half = size / 2;
        context.rect(x - half, y - half, size, size);
      }
      context.fill();
    }
  }

  function draw() {
    // a cor principal mudou em Aparencia? recolore sem refazer a grade
    if (++frameCount % 30 === 0) {
      const next = readAccent();
      if (next.key !== accent.key) {
        accent = next;
        colors = [FIELD_GREY, accent.rgba, accent.rgba];
        tierCss = tiers.map((_, tier) => rampCss((tier + 0.5) / TIER_COUNT, colors));
      }
    }
    context.clearRect(0, 0, width, height);
    const now = performance.now();
    const dt = clamp((now - lastFrameAt) / 1000, 0, MAX_DT);
    lastFrameAt = now;
    updateFlowField(((now - startedAt) / 1000) * SPEED * TIME_SCALE);
    advanceWake(dt);
    const reform = clamp((now - scatterAt) / REFORM_MS, 0, 1);
    drawFlowing(reform, Math.exp(-dt / WAKE_TAU));
  }

  function tick() {
    draw();
    rafId = requestAnimationFrame(tick);
  }

  // o canvas tem pointer-events:none (da pra clicar atraves dele), entao o
  // mouse e lido na janela
  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (!pointerActive) { prevPointerX = x; prevPointerY = y; }
    pointerX = x;
    pointerY = y;
    pointerActive = true;
  }
  function onOut(e) {
    if (!e.relatedTarget) pointerActive = false;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerout', onOut);

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  // a fonte do app pode terminar de carregar depois - reescreve a palavra
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      fontFamily = getComputedStyle(document.body).fontFamily || fontFamily;
      sampleKey = '';
      buildGrid();
    }).catch(() => {});
  }

  return {
    start() {
      if (rafId !== null) return;
      lastFrameAt = performance.now();
      if (!hasStarted) { hasStarted = true; scatterAt = lastFrameAt; } // a "montagem" toca na 1a vez que aparece
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
    dispose() {
      this.stop();
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      sampler.width = 0;
      sampler.height = 0;
    },
  };
}
