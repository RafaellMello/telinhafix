// Fundos animados "Aurora", "Estatica", "Brasas" e "Ondas" (Aparencia >
// Fundo animado). Os quatro sao Canvas 2D e seguem a cor principal; dividem
// a mesma base (createAmbient): tamanho da janela, mouse lido na janela (o
// canvas tem pointer-events:none pra deixar clicar atraves dele) e
// start/stop/dispose que o manager.js usa.
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
const sm = (t) => t * t * (3 - 2 * t);
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = sm(x - ix);
  const fy = sm(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function readAccent() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#e2231a';
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xe2231a;
  return { hex, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function createAmbient(canvas, effect) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { start() {}, stop() {}, dispose() {} };
  const s = { w: 1, h: 1, mouse: { x: 0, y: 0, active: false }, accent: readAccent(), frame: 0 };
  s.rgba = (a) => `rgba(${s.accent.r}, ${s.accent.g}, ${s.accent.b}, ${a})`;
  let rafId = null;
  let last = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, effect.maxDpr || 1.5);
    s.w = Math.max(1, canvas.clientWidth || window.innerWidth);
    s.h = Math.max(1, canvas.clientHeight || window.innerHeight);
    canvas.width = Math.max(1, Math.round(s.w * dpr));
    canvas.height = Math.max(1, Math.round(s.h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    effect.resize(s, ctx);
  }
  function step(now) {
    const dt = last ? Math.min(50, now - last) : 16;
    last = now;
    // a cor principal mudou em Aparencia? (le de vez em quando, nao todo frame)
    if (++s.frame % 30 === 0) {
      const next = readAccent();
      if (next.hex !== s.accent.hex) s.accent = next;
    }
    effect.draw(ctx, s, now, dt);
    rafId = requestAnimationFrame(step);
  }
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    s.mouse.x = e.clientX - r.left;
    s.mouse.y = e.clientY - r.top;
    s.mouse.active = true;
  }
  function onOut(e) { if (!e.relatedTarget) s.mouse.active = false; }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerout', onOut);

  effect.init(s);
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return {
    start() {
      if (rafId !== null) return;
      last = 0;
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
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
    },
  };
}

// --- Aurora: faixas de luz na cor principal ondulando devagar -----------------
// Desenhada em 1/5 da resolucao e ampliada com suavizacao - o desfoque sai de
// graca e fica leve mesmo em tela grande.
const AURORA = {
  maxDpr: 1,
  init(s) { s.off = document.createElement('canvas'); s.offCtx = s.off.getContext('2d'); },
  resize(s) { s.off.width = Math.max(1, Math.ceil(s.w / 5)); s.off.height = Math.max(1, Math.ceil(s.h / 5)); },
  draw(ctx, s, t) {
    const o = s.offCtx;
    const w = s.off.width;
    const h = s.off.height;
    o.globalCompositeOperation = 'source-over';
    o.fillStyle = '#060608';
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = 'lighter';
    const time = t * 0.00012;
    for (let k = 0; k < 4; k++) {
      const base = h * (0.28 + k * 0.13);
      o.beginPath();
      o.moveTo(0, h);
      for (let x = 0; x <= w; x += 2) {
        const n = noise(x * 0.018 + k * 9.1, time * 3 + k * 2.3);
        o.lineTo(x, base + (n - 0.5) * h * 0.55 + Math.sin(x * 0.03 + time * 8 + k) * h * 0.04);
      }
      o.lineTo(w, h);
      o.closePath();
      const g = o.createLinearGradient(0, base - h * 0.3, 0, base + h * 0.35);
      const alpha = k === 1 ? 0.42 : 0.24;
      g.addColorStop(0, s.rgba(0));
      g.addColorStop(0.35, s.rgba(alpha));
      g.addColorStop(0.55, `rgba(255, 255, 255, ${alpha * 0.18})`);
      g.addColorStop(1, s.rgba(0));
      o.fillStyle = g;
      o.fill();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s.off, 0, 0, s.w, s.h);
  },
};

// --- Estatica: chiado de TV de tubo -------------------------------------------
// Ruido em 1/3 da resolucao (pixelado de proposito), linhas de varredura, uma
// faixa de sinal descendo e, de vez em quando, o sinal "pula" de lado.
const ESTATICA = {
  maxDpr: 1,
  init(s) { s.off = document.createElement('canvas'); s.offCtx = s.off.getContext('2d'); s.glitchUntil = 0; },
  resize(s) {
    s.off.width = Math.max(1, Math.ceil(s.w / 3));
    s.off.height = Math.max(1, Math.ceil(s.h / 3));
    s.img = s.offCtx.createImageData(s.off.width, s.off.height);
    // linhas de varredura e vinheta nao mudam: desenha uma vez so
    s.overlay = document.createElement('canvas');
    s.overlay.width = Math.max(1, Math.ceil(s.w));
    s.overlay.height = Math.max(1, Math.ceil(s.h));
    const oc = s.overlay.getContext('2d');
    oc.fillStyle = 'rgba(0, 0, 0, 0.32)';
    for (let y = 0; y < s.h; y += 3) oc.fillRect(0, y, s.w, 1);
    const v = oc.createRadialGradient(s.w / 2, s.h / 2, s.h * 0.25, s.w / 2, s.h / 2, s.w * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.8)');
    oc.fillStyle = v;
    oc.fillRect(0, 0, s.w, s.h);
  },
  draw(ctx, s, t) {
    const d = s.img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 26;
    }
    s.offCtx.putImageData(s.img, 0, 0);
    ctx.fillStyle = '#060607';
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.imageSmoothingEnabled = false;
    const glitch = t < s.glitchUntil;
    if (!glitch && Math.random() < 0.004) s.glitchUntil = t + rand(80, 220);
    if (glitch) {
      const slices = 7;
      for (let k = 0; k < slices; k++) {
        const sh = s.off.height / slices;
        ctx.drawImage(s.off, 0, sh * k, s.off.width, sh, (Math.random() - 0.5) * s.w * 0.06, (s.h / slices) * k, s.w, s.h / slices);
      }
    } else {
      ctx.drawImage(s.off, 0, 0, s.w, s.h);
    }
    const by = ((t * 0.04) % (s.h + 160)) - 80;
    const band = ctx.createLinearGradient(0, by - 60, 0, by + 60);
    band.addColorStop(0, s.rgba(0));
    band.addColorStop(0.5, s.rgba(0.16));
    band.addColorStop(1, s.rgba(0));
    ctx.fillStyle = band;
    ctx.fillRect(0, by - 60, s.w, 120);
    ctx.drawImage(s.overlay, 0, 0, s.w, s.h);
  },
};

// --- Brasas: fagulhas subindo e piscando; o mouse espalha ---------------------
function makeSpark(s, anywhere) {
  return {
    x: rand(0, s.w), y: anywhere ? rand(0, s.h) : s.h + rand(0, 30),
    vx: rand(-0.02, 0.02), vy: rand(-0.09, -0.03), size: rand(3, 9),
    life: anywhere ? rand(0, 3000) : 0, max: rand(2600, 6000), flick: rand(0.004, 0.012), seed: Math.random() * 100,
  };
}
const BRASAS = {
  init(s) { s.sparks = []; s.spriteFor = ''; },
  resize(s) {
    const n = Math.round(Math.min(260, Math.max(90, (s.w * s.h) / 4500)));
    s.sparks = Array.from({ length: n }, () => makeSpark(s, true));
  },
  draw(ctx, s, t, dt) {
    if (s.spriteFor !== s.accent.hex) {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.18, s.rgba(1));
      rg.addColorStop(1, s.rgba(0));
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
      s.sprite = c;
      s.spriteFor = s.accent.hex;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6, 6, 7, 0.35)'; // rastro curto
    ctx.fillRect(0, 0, s.w, s.h);
    const glow = ctx.createLinearGradient(0, s.h, 0, s.h * 0.55);
    glow.addColorStop(0, s.rgba(0.18));
    glow.addColorStop(1, s.rgba(0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, s.h * 0.55, s.w, s.h * 0.45);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.sparks) {
      p.life += dt;
      p.vx += (noise(p.x * 0.01, t * 0.0004 + p.seed) - 0.5) * 0.08 * dt * 0.01;
      if (s.mouse.active) {
        const dx = p.x - s.mouse.x;
        const dy = p.y - s.mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 120) * 0.012 * dt;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 - 0.0009 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life > p.max || p.y < -20 || p.x < -30 || p.x > s.w + 30) Object.assign(p, makeSpark(s, false));
      const k = p.life / p.max;
      const a = Math.sin(Math.PI * Math.min(1, k)) * (0.65 + 0.35 * Math.sin(t * p.flick + p.seed * 10));
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      const size = p.size * (1 - k * 0.5);
      ctx.drawImage(s.sprite, p.x - size, p.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },
};

// --- Ondas: linhas de audio correndo; perto do mouse ficam mais fortes --------
const ONDAS = {
  init() {},
  resize() {},
  draw(ctx, s, t) {
    ctx.fillStyle = '#060607';
    ctx.fillRect(0, 0, s.w, s.h);
    const lines = 14;
    const time = t * 0.0011;
    const half = (lines - 1) / 2;
    for (let k = 0; k < lines; k++) {
      const yBase = (s.h / (lines + 1)) * (k + 1);
      const center = Math.abs(k - half) < 0.6;
      const mid = 1 - Math.abs(k - half) / half;
      ctx.beginPath();
      for (let x = 0; x <= s.w; x += 3) {
        let amp = 4 + mid * 14;
        if (s.mouse.active) {
          const dx = x - s.mouse.x;
          const dy = yBase - s.mouse.y;
          amp += Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 160) * 26;
        }
        const y = yBase
          + Math.sin(x * 0.018 + time * 3 + k * 0.7) * amp * 0.6
          + Math.sin(x * 0.051 - time * 4.2 + k) * amp * 0.3
          + Math.sin(x * 0.007 + time + k * 2) * amp * 0.4;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineWidth = center ? 2 : 1;
      ctx.strokeStyle = center ? s.rgba(0.95) : `rgba(255, 255, 255, ${0.06 + mid * 0.16})`;
      if (center) { ctx.shadowColor = s.rgba(0.8); ctx.shadowBlur = 12; }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < s.w; x += 48) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, s.h); }
    ctx.stroke();
  },
};

export const createAuroraBackground = (canvas) => createAmbient(canvas, AURORA);
export const createEstaticaBackground = (canvas) => createAmbient(canvas, ESTATICA);
export const createBrasasBackground = (canvas) => createAmbient(canvas, BRASAS);
export const createOndasBackground = (canvas) => createAmbient(canvas, ONDAS);
