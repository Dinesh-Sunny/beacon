"use client";

// Beams of light behind the hero, after Raycast's hero: a WebGL shader draws diagonal ribbons of
// beacon amber that open out from the middle on load, then keep a slow light rolling along them,
// with fine film grain. No library: one full-screen triangle and a fragment shader. It pauses when
// off screen or in a background tab, renders a single still frame for reduced motion or Calmer,
// and falls back to plain CSS beams where WebGL is missing. Decorative only.

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./useInView";

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

// u: resolution, t: seconds, r: reveal 0..1, dark: 1 in dark mode.
const FRAG = `#version 300 es
precision highp float;
uniform vec2 u;
uniform float t;
uniform float r;
uniform float dark;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * u) / u.y;            // centred, height = 1
  vec2 c = vec2(0.12, 0.08);                   // where the light gathers (a little right of centre)
  float a = radians(-38.0);
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = rot * (uv - c);                     // q.x across the ribbons, q.y along them

  // Ribbons of uneven width: stretch q.x by a slow wave so bands differ.
  float x = q.x * 3.1 + 0.3 * sin(q.x * 1.9 + 1.3);
  float id = floor(x);
  float f = fract(x);
  float seed = hash(vec2(id, 7.0));
  float width = mix(0.35, 0.92, seed);
  float edge = 0.025;
  float band = smoothstep(0.0, edge, f) * smoothstep(width, width - edge, f);
  // Rounded, glossy cross-section, like a lit glass ribbon.
  float gloss = pow(sin(3.14159 * clamp(f / width, 0.0, 1.0)), 0.9);

  // Light rolling along each ribbon at its own pace.
  float flow = 0.45 + 0.55 * sin(q.y * 2.2 - t * (0.45 + 0.3 * seed) + seed * 6.28);
  // Each ribbon starts and ends at its own place, so they read as separate shafts of light.
  float s0 = mix(-1.4, -0.5, hash(vec2(id, 3.0)));
  float s1 = mix(0.3, 1.5, hash(vec2(id, 5.0)));
  float along = smoothstep(s0, s0 + 0.5, q.y) * smoothstep(s1, s1 - 0.6, q.y);

  // Opens out from the middle on load.
  float d = length(uv - c);
  float reveal = smoothstep(r * 1.5, r * 1.5 - 0.45, d);
  // Fades towards the panel edges.
  float vignette = smoothstep(1.15, 0.2, length((uv - c) * vec2(0.75, 1.1)));

  float light = band * gloss * flow * along * reveal * vignette * (0.55 + 0.45 * seed);

  vec3 bg = dark > 0.5 ? vec3(0.055, 0.047, 0.04) : vec3(0.992, 0.976, 0.95);
  vec3 deep = vec3(0.93, 0.36, 0.07);          // ember
  vec3 amber = vec3(0.961, 0.647, 0.141);      // beacon amber #f5a524
  vec3 glow = vec3(1.0, 0.9, 0.66);            // hot core
  vec3 col = mix(deep, amber, pow(gloss, 0.7) * flow);
  col = mix(col, glow, pow(gloss * flow, 4.0) * 0.9);
  vec3 outc = dark > 0.5
    ? bg + col * (1.0 - exp(-light * 2.2)) * 0.95 // light adds on a dark sky, tone-mapped so it never blows out
    : mix(bg, col, clamp(light * 1.15, 0.0, 1.0));

  // Film grain.
  float g = hash(frag + fract(t) * 91.0) - 0.5;
  outc += g * (dark > 0.5 ? 0.06 : 0.045);
  o = vec4(outc, 1.0);
}`;

export function HeroBeams() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gl, setGl] = useState(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!ctx) {
      setGl(false);
      return;
    }
    const shader = (type: number, src: string) => {
      const s = ctx.createShader(type);
      if (!s) return null;
      ctx.shaderSource(s, src);
      ctx.compileShader(s);
      return ctx.getShaderParameter(s, ctx.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(ctx.VERTEX_SHADER, VERT);
    const fs = shader(ctx.FRAGMENT_SHADER, FRAG);
    const prog = ctx.createProgram();
    if (!vs || !fs || !prog) {
      setGl(false);
      return;
    }
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
      setGl(false);
      return;
    }
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
    ctx.useProgram(prog);
    // One triangle that covers the screen.
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(
      ctx.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      ctx.STATIC_DRAW,
    );
    const loc = ctx.getAttribLocation(prog, "p");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const uRes = ctx.getUniformLocation(prog, "u");
    const uT = ctx.getUniformLocation(prog, "t");
    const uR = ctx.getUniformLocation(prog, "r");
    const uDark = ctx.getUniformLocation(prog, "dark");

    const still = prefersReducedMotion();
    // The hero panel is a night sky in both themes: a beacon shows best in the dark.
    const dark = () => 1;
    const resize = () => {
      // Soft light needs few pixels: cap the density to keep it light on the GPU.
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.viewport(0, 0, w, h);
      }
    };
    const draw = (sec: number, reveal: number) => {
      resize();
      ctx.uniform2f(uRes, canvas.width, canvas.height);
      ctx.uniform1f(uT, sec);
      ctx.uniform1f(uR, reveal);
      ctx.uniform1f(uDark, dark());
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    };

    if (still) {
      draw(4, 1);
      const ro = new ResizeObserver(() => draw(4, 1));
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    let frame = 0;
    let visible = true;
    const start = performance.now();
    const loop = (now: number) => {
      const sec = (now - start) / 1000;
      // Ease the reveal over the first 1.2 seconds.
      const k = Math.min(sec / 1.2, 1);
      draw(sec, 1 - (1 - k) ** 3);
      frame = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
    };
    const wake = () => {
      if (!frame && visible && !document.hidden)
        frame = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      wake();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", wake);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, []);

  return (
    <div className="hb" aria-hidden="true">
      {gl ? (
        <canvas ref={ref} className="hb-canvas" />
      ) : (
        <div className="hb-rot">
          {[6, 20, 37, 49, 66, 76, 90].map((x, i) => (
            <i
              key={x}
              style={{ left: `${x}%`, width: 60 + ((i * 53) % 170) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
