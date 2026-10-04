// Fundo animado "Buraco negro" - shader WebGL2 original (nao copiado de
// nenhuma fonte - o componente que o usuario queria copiar fica atras de
// uma API paga no 21st.dev e nunca conseguimos o codigo de verdade).
// Tecnica: raymarching simples onde a direcao do raio vai curvando conforme
// se aproxima do centro (aproximando lente gravitacional de verdade o
// suficiente pra um efeito decorativo), cruzamentos com um disco de
// acrescimo "Kepleriano" (gira, mais quente perto do centro) acumulam cor,
// e o que escapa sem cruzar nada vira estrelas de fundo proceduralmente.
import { createShaderBackground } from './webgl-shader-base.js';

const FRAG_SRC = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec3  iResolution;
uniform float iTime;

#define STEPS 110
#define HORIZON 1.0
#define DISK_INNER 1.9
#define DISK_OUTER 5.6

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 starfield(vec3 rd) {
  vec3 col = vec3(0.0);
  vec2 uv = rd.xy / (1.0 + abs(rd.z)) * 3.0 + rd.zx * 1.5;
  for (float layer = 0.0; layer < 2.0; layer += 1.0) {
    vec2 guv = uv * (8.0 + layer * 10.0);
    vec2 cell = floor(guv);
    float h = hash21(cell + layer * 17.0);
    if (h > 0.985) {
      vec2 f = fract(guv) - 0.5;
      float d = length(f);
      float star = smoothstep(0.08, 0.0, d) * (0.5 + 0.5 * sin(iTime * 2.0 + h * 50.0));
      col += star * (0.6 + 0.4 * layer);
    }
  }
  return col;
}

vec3 diskColor(float radius, float angle) {
  float t = clamp((radius - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
  // gradiente de temperatura: quase branco/amarelo por dentro, laranja/
  // vermelho por fora - igual o visual classico de disco de acrescimo.
  vec3 hot = vec3(1.0, 0.96, 0.82);
  vec3 cool = vec3(0.95, 0.35, 0.08);
  vec3 base = mix(hot, cool, t);

  // rotacao + "doppler beaming" falso: lado que gira na nossa direcao fica
  // bem mais brilhante que o outro, igual no visual de referencia.
  float swirl = angle - iTime * 0.6 - radius * 0.4;
  float doppler = 0.35 + 0.95 * pow(0.5 + 0.5 * cos(swirl), 2.0);

  float edgeFade = smoothstep(DISK_OUTER, DISK_OUTER - 0.6, radius) * smoothstep(DISK_INNER - 0.15, DISK_INNER + 0.25, radius);
  return base * doppler * edgeFade;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

  vec3 ro = vec3(0.0, 5.4, 22.0);
  vec3 forward = normalize(vec3(0.0, -0.24, -1.0));
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 rd = normalize(forward + uv.x * right + uv.y * up);

  vec3 pos = ro;
  vec3 col = vec3(0.0);
  bool hit = false;
  float prevY = pos.y;

  for (int i = 0; i < STEPS; i++) {
    float dist = length(pos);
    if (dist < HORIZON) { hit = true; col = vec3(0.0); break; }

    vec3 toCenter = -pos / max(dist, 0.0001);
    float dt = clamp(dist * 0.08, 0.02, 1.6);
    float bend = 2.8 * dt / (dist * dist);
    rd = normalize(rd + toCenter * bend);

    vec3 nextPos = pos + rd * dt;

    // cruzou o plano do disco (y=0) nesse passo?
    if ((prevY > 0.0) != (nextPos.y > 0.0)) {
      float f = prevY / (prevY - nextPos.y);
      vec3 hitPos = mix(pos, nextPos, f);
      float r = length(hitPos.xz);
      if (r > DISK_INNER - 0.3 && r < DISK_OUTER + 0.3) {
        float angle = atan(hitPos.z, hitPos.x);
        col += diskColor(r, angle);
        hit = true;
      }
    }

    prevY = nextPos.y;
    pos = nextPos;

    if (dist > 40.0) break;
  }

  if (!hit) {
    col = starfield(rd);
  }

  fragColor = vec4(col, 1.0);
}

void main(){
  mainImage(fragColor, gl_FragCoord.xy);
}
`;

export function createBlackHoleBackground(canvas) {
  return createShaderBackground(canvas, FRAG_SRC);
}
