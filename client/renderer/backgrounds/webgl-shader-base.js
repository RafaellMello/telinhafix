// Base compartilhada pros fundos que sao shader puro em WebGL2 (Light Beam,
// Buraco negro) - cuida de compilar/linkar, redimensionar, perda de
// contexto e do loop de animacao, no formato de uniforms "estilo
// Shadertoy" (iResolution, iTime, iFrame, iMouse) que os dois shaders usam.
const VERT_SRC = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
void main(){
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || '';
    gl.deleteShader(sh);
    throw new Error('Falha ao compilar shader: ' + log);
  }
  return sh;
}

function link(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || '';
    gl.deleteProgram(prog);
    throw new Error('Falha ao linkar programa: ' + log);
  }
  return prog;
}

export function createShaderBackground(canvas, fragSource) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true });
  if (!gl) return { start() {}, stop() {}, dispose() {} };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = link(gl, vs, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const uResolution = gl.getUniformLocation(program, 'iResolution');
  const uTime = gl.getUniformLocation(program, 'iTime');
  const uFrame = gl.getUniformLocation(program, 'iFrame');
  const uMouse = gl.getUniformLocation(program, 'iMouse');

  const mouse = { x: 0, y: 0, l: 0, r: 0 };
  let startTime = performance.now();
  let frame = 0;
  let rafId = null;
  let resizeScheduled = false;

  function getDpr() {
    return Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  }

  function applySize() {
    resizeScheduled = false;
    const dpr = getDpr();
    const cssW = Math.max(1, canvas.clientWidth | 0);
    const cssH = Math.max(1, canvas.clientHeight | 0);
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  function scheduleSize() {
    if (resizeScheduled) return;
    resizeScheduled = true;
    requestAnimationFrame(applySize);
  }
  const ro = new ResizeObserver(scheduleSize);
  ro.observe(canvas);
  scheduleSize();

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    mouse.y = Math.max(0, Math.min(rect.height - (e.clientY - rect.top), rect.height));
  }
  canvas.addEventListener('mousemove', onMove);

  function onContextLost(ev) {
    ev.preventDefault();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }
  function onContextRestored() {
    scheduleSize();
    startTime = performance.now();
    frame = 0;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function tick(now) {
    if (gl.isContextLost()) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const t = (now - startTime) / 1000;
    frame += 1;
    gl.useProgram(program);
    if (resizeScheduled) applySize();
    const dpr = getDpr();
    if (uResolution) gl.uniform3f(uResolution, canvas.width, canvas.height, dpr);
    if (uTime) gl.uniform1f(uTime, t);
    if (uFrame) gl.uniform1i(uFrame, frame);
    if (uMouse) gl.uniform4f(uMouse, mouse.x * dpr, mouse.y * dpr, mouse.l, mouse.r);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (rafId !== null) return;
      startTime = performance.now();
      frame = 0;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
    dispose() {
      this.stop();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      ro.disconnect();
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
