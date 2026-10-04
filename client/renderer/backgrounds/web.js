// Fundo animado "Web" - rede de nos conectados por linhas finas, com pulsos
// de luz percorrendo algumas conexoes de vez em quando e os nos variando de
// intensidade bem devagar. Canvas 2D puro (nao precisa de WebGL pra esse
// efeito) - visual de "network topology"/"cybersecurity dashboard", bem
// escuro e sutil de proposito (linhas com pouca opacidade, nada de neon
// forte ou efeito "Matrix").
export function createWebBackground(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { start() {}, stop() {}, dispose() {} };

  const CONNECT_DIST = 160; // px (CSS) - distancia maxima pra desenhar uma linha entre dois nos
  const NODE_AREA_DIVISOR = 16000; // 1 no a cada ~16000px^2 de tela
  const MIN_NODES = 45;
  const MAX_NODES = 120;
  const PULSE_SPAWN_CHANCE_PER_FRAME = 0.012; // chance de um novo pulso de luz nascer a cada frame
  const PULSE_DURATION_MS = 1300;

  let nodes = [];
  let pulses = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = null;
  let lastTime = 0;
  // O cursor vira um "no" a mais da rede - puxa linha ate os nos reais
  // proximos, sem empurrar/atrair ninguem do lugar (mantém o visual sutil
  // pedido). O canvas tem pointer-events:none (deixa clicar atraves dele),
  // entao a posicao do mouse precisa ser lida na window, nao no canvas.
  const mouse = { x: 0, y: 0, active: false };
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }
  function onMouseOut(e) {
    if (!e.relatedTarget) mouse.active = false;
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseout', onMouseOut);

  function readAccentRgb() {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--red-bright').trim() || '#ff3b2f';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }

  function makeNode() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      radius: 1.2 + Math.random() * 1.3,
      pulsePhase: Math.random() * Math.PI * 2,
      // periodo bem longo e aleatorio por no - evita que todos "respirem"
      // em sincronia, o que pareceria artificial.
      pulseSpeed: 0.0004 + Math.random() * 0.0006,
      // de vez em quando um no fica bem fraco por um tempinho (o "aparece/
      // desaparece" sutil pedido) - cada no tem seu proprio relogio pra
      // isso, independente dos outros.
      dimUntil: 0,
      dimStrength: 0,
    };
  }

  function rebuildNodes() {
    const area = width * height;
    const count = Math.round(Math.min(MAX_NODES, Math.max(MIN_NODES, area / NODE_AREA_DIVISOR)));
    nodes = Array.from({ length: count }, makeNode);
    pulses = [];
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildNodes();
  }

  function maybeSpawnPulse(edges) {
    if (edges.length === 0) return;
    if (Math.random() > PULSE_SPAWN_CHANCE_PER_FRAME) return;
    const edge = edges[(Math.random() * edges.length) | 0];
    pulses.push({ a: edge.a, b: edge.b, start: performance.now() });
  }

  function step(now) {
    const dt = lastTime ? now - lastTime : 16;
    lastTime = now;
    const accentRgb = readAccentRgb();

    ctx.clearRect(0, 0, width, height);

    // move os nos (quique suave nas bordas, sem "teleportar" pro outro lado)
    for (const n of nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > height) n.vy *= -1;
      n.x = Math.min(Math.max(n.x, 0), width);
      n.y = Math.min(Math.max(n.y, 0), height);

      if (n.dimUntil && now > n.dimUntil) { n.dimUntil = 0; n.dimStrength = 0; }
      if (!n.dimUntil && Math.random() < 0.0006) {
        n.dimUntil = now + 1200 + Math.random() * 1800;
        n.dimStrength = 0.55 + Math.random() * 0.35;
      }
    }

    // conexoes entre nos proximos - linhas bem finas e discretas
    const edges = [];
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= CONNECT_DIST) continue;
        edges.push({ a, b });
        const alpha = (1 - dist / CONNECT_DIST) * 0.16;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // cursor como um no a mais da rede - linha ate cada no real proximo,
    // cor de destaque (em vez de branco) pra diferenciar "voce" da rede.
    if (mouse.active) {
      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= CONNECT_DIST) continue;
        const alpha = (1 - dist / CONNECT_DIST) * 0.22;
        ctx.strokeStyle = `rgba(${accentRgb}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(${accentRgb}, 0.8)`;
      ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // nos: ponto com leve "respiracao" de opacidade/tamanho + o flicker
    // ocasional calculado acima
    for (const n of nodes) {
      const breathe = 0.55 + 0.45 * Math.sin(now * n.pulseSpeed + n.pulsePhase);
      let alpha = 0.35 + breathe * 0.35;
      if (n.dimUntil) alpha *= 1 - n.dimStrength;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${accentRgb}, ${alpha.toFixed(3)})`;
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // pulsos de luz percorrendo algumas conexoes
    maybeSpawnPulse(edges);
    pulses = pulses.filter((p) => now - p.start < PULSE_DURATION_MS);
    for (const p of pulses) {
      const t = (now - p.start) / PULSE_DURATION_MS;
      const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
      const x = p.a.x + (p.b.x - p.a.x) * t;
      const y = p.a.y + (p.b.y - p.a.y) * t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${accentRgb}, ${(0.9 * fade).toFixed(3)})`;
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
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
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseout', onMouseOut);
    },
  };
}
