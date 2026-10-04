// Fundo animado "Feixe de luz" - shader WebGL2 raymarched (shadertoy-style),
// adaptado do componente React que o usuario mandou pra vanilla JS + nossa
// base compartilhada (webgl-shader-base.js).
import { createShaderBackground } from './webgl-shader-base.js';

const FRAG_SRC = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec3  iResolution;
uniform float iTime;
uniform int   iFrame;
uniform vec4  iMouse;

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2  r  = iResolution.xy;
    float t  = iTime;
    vec3  FC = vec3(fragCoord, t);
    vec4  o  = vec4(0.0);

    for (float i, z, d, f; i++ < 1e2; o += vec4(3., 1., d, z / f) / z) {
        vec3 v = vec3(0., -2., 7.);
        vec3 p = z * normalize(FC.rgb * 2. - r.xyx) + v;
        vec3 a = p;
        a.y *= .3;
        for (d = 1.; d++ < 9.; )
            a -= .1 * sin((a.zxy + t * v + d) * d) * p.y / d;

        z += d = min(
                max(-p.y, length(a) - 2.),
                f = .2 + abs(length(a.xz - cos(a.zx * 6.)) + max(p.y / .1, - .6))
            ) / 8.;
    }
    o = tanh(o * o.a / 1e3);

    fragColor = vec4(o.rgb, 1.0);
}

void main(){
  mainImage(fragColor, gl_FragCoord.xy);
}
`;

export function createLightBeamBackground(canvas) {
  return createShaderBackground(canvas, FRAG_SRC);
}
