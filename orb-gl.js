'use strict';
/* WebGL glass orb: the sphere body and its outer glow, drawn under the 2D particles of orb.js.
   A warm glass sphere with a fresnel rim, a slow domain-warped liquid of light inside, the plum
   field bent through the lens, light focused through the ball and a soft top-left glint.
   orb.js owns timing, state and the Canvas 2D fallback; this file only renders, into a small
   canvas that follows the orb. Everything is procedural (no images, no network, no inline
   style attributes). draw() depends only on its arguments, so a still frame for a given t
   always looks the same.

   window.NextStepOrbGL = {
     init() -> bool                 create #orb-gl right before #orb; false when WebGL is unavailable
     resize(vw, vh, dpr)            viewport size in CSS px and the device pixel ratio (capped at 2)
     draw({ x, y, r, form, beat, voice, energy, t }) -> bool
                                    true: drawn (skip the 2D glass); false: draw the 2D glass instead
     clear()                        nothing to show on this screen
     destroy()
   } */
(function () {
  const T0 = 37;            // phase offset: t = 0 (reduced motion still frame) is a calm, full composition
  const EXT = 1.72;         // canvas half-size in orb radii (the glow and the beat swell fit inside)
  const MAX_SIDE = 1024;    // backing store cap, device px
  const LEVELS = [2, 1.5, 1, 0.75];
  const SLOW_MS = 40;
  const STOPS = [
    [0, 255, 214, 176],
    [0.16, 255, 177, 132],   // #FFB184 peach
    [0.34, 240, 138, 120],   // #F08A78 coral
    [0.55, 196, 90, 144],    // #C45A90 magenta
    [0.78, 106, 52, 120],    // #6A3478 violet
    [1, 36, 18, 40]          // #241228 deep
  ];

  const VS = 'attribute vec2 aP;void main(){gl_Position=vec4(aP,0.0,1.0);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uN;   // 64x64 random RGBA, linear, repeat
uniform sampler2D uP;   // 256x1 body palette (the 2D gradient stops)
uniform vec3 uC;        // centre x, y and radius, device px (GL coordinates, y up)
uniform vec4 uA;        // form, energy, beat, voice
uniform vec4 uRot;      // cos/sin of two slow swirl angles
uniform vec4 uO1;       // warp offsets: layer 1 (xy), layer 2 (zw)
uniform vec4 uO2;       // layer 3 offset (xy), core drift (zw)
uniform vec2 uSh;       // shimmer phase (cos, sin)

vec4 noise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return texture2D(uN, (i + f + 0.5) * 0.015625);
}
vec4 fbm(vec2 p) {
  return noise(p) * 0.62 + noise(p * 2.0 + vec2(17.3, 9.1)) * 0.28 + noise(p * 4.0 + vec2(-5.7, 31.4)) * 0.10;
}
void main() {
  vec2 q = (gl_FragCoord.xy - uC.xy) / uC.z;
  float d2 = dot(q, q);
  float d = sqrt(d2);
  float en = uA.y;
  float beat = uA.z;
  float voice = uA.w;
  float dith = texture2D(uN, gl_FragCoord.xy * 0.015625).w - 0.5;

  float glowA = (0.13 + 0.17 * en + 0.10 * beat + 0.05 * voice) * exp(-max(d - 1.0, 0.0) * 4.2) * (1.0 - smoothstep(1.44, 1.62, d));
  vec3 glowC = mix(vec3(1.0, 0.70, 0.52), vec3(0.72, 0.30, 0.54), smoothstep(1.0, 1.42, d));
  if (d > 1.0 + 1.5 / uC.z) {
    float ga = glowA * uA.x;
    ga = clamp(ga + dith * 0.006 * step(0.004, ga), 0.0, 1.0);
    gl_FragColor = vec4(glowC * ga, ga);
    return;
  }
  float z = sqrt(max(1.0 - d2, 0.0));
  vec3 n = vec3(q, z);

  // liquid of light: domain-warped noise on a lens-shaped mapping of the sphere
  vec2 uv = q * (0.9 / (0.56 + 0.44 * z));
  vec4 w1 = fbm(mat2(uRot.x, uRot.y, -uRot.y, uRot.x) * uv + uO1.xy);
  vec4 w2 = fbm(mat2(uRot.z, uRot.w, -uRot.w, uRot.z) * uv + 1.5 * (w1.xy - 0.5) + uO1.zw);
  vec4 f = fbm(uv + 1.3 * (w2.xy - 0.5) + uO2.xy);
  float fl = f.x - 0.5;

  // body: the 2D two-point gradient (hot core up-left), bent by the liquid
  vec2 c0 = vec2(-0.22, 0.28) + uO2.zw;
  vec2 dc = vec2(0.05, -0.08) - c0;
  vec2 k = q - c0;
  float a = dot(dc, dc) - 0.9216;
  float b = dot(k, dc) + 0.0384;
  float g = max((b - sqrt(max(b * b - a * (dot(k, k) - 0.0016), 0.0))) / a, 0.0);
  float gw = g + fl * (0.07 + 0.24 * smoothstep(0.08, 0.6, g));
  gw *= 1.0 - 0.12 * en - 0.06 * beat - 0.05 * voice;
  vec3 col = texture2D(uP, vec2(clamp(gw, 0.0, 1.0), 0.5)).rgb;
  col *= 0.92 + 0.08 * en + 0.20 * (w2.z - 0.5) + 0.06 * beat;

  // inner light: a soft bloom around the hot core
  col += vec3(1.0, 0.84, 0.70) * exp(-dot(k, k) * 4.5) * (0.04 + 0.05 * en + 0.12 * beat + 0.18 * voice);

  // caustic swirl: soft veils of light along a slowly turning contour; shimmer while speaking
  float veil = 1.0 - smoothstep(0.0, 0.06, abs(w1.z - 0.5));
  float sh = 0.5 + 0.5 * (sin(f.z * 27.0) * uSh.x + cos(f.z * 27.0) * uSh.y);
  veil *= smoothstep(0.12, 0.45, g) * (1.0 - smoothstep(0.70, 0.97, d));
  col += vec3(1.0, 0.78, 0.62) * veil * (0.07 + 0.05 * en + voice * (0.03 + 0.08 * sh));

  // the plum field seen through the glass, inverted by the lens
  float shell = smoothstep(0.6, 0.99, d);
  vec3 field = mix(vec3(0.06, 0.025, 0.07), vec3(0.24, 0.12, 0.27), smoothstep(-0.9, 0.9, 0.7 * (q.x - q.y)));
  col = mix(col, max(col, field), shell * 0.35);

  // glass: fresnel rim, light focused through the ball, specular glint (same place as the 2D glint)
  float fr = pow(1.0 - z, 3.5);
  float lit = smoothstep(-0.8, 0.9, dot(q, vec2(-0.55, 0.83)) / max(d, 0.001));
  col += mix(vec3(0.60, 0.28, 0.58), vec3(1.0, 0.85, 0.75), lit) * fr * (0.34 + 0.10 * en);
  vec2 cq = q - vec2(0.40, -0.50);
  col += vec3(1.0, 0.62, 0.52) * exp(-dot(cq, cq) * 9.0) * shell * (0.10 + 0.10 * en + 0.08 * beat);
  float nh = max(dot(n, vec3(-0.30, 0.34, 0.891)), 0.0);
  col += vec3(1.0, 0.985, 0.965) * (pow(nh, 420.0) * 0.90 + pow(nh, 60.0) * 0.10);

  float body = clamp((1.0 - d) * uC.z + 0.5, 0.0, 1.0);
  col = clamp(col + dith * 0.004, 0.0, 1.0);
  float alpha = (body + glowA * (1.0 - body)) * uA.x;
  vec3 rgb = (col * body + glowC * glowA * (1.0 - body)) * uA.x;
  gl_FragColor = vec4(min(rgb, vec3(alpha)), alpha);
}`;

  let cv = null;
  let gl = null;
  let prog = null;
  let vbo = null;
  let texN = null;
  let texP = null;
  let U = null;
  let ok = false;        // initialised and usable
  let lost = false;      // context lost, waiting for a restore
  let shown = false;     // canvas visible
  let drawn = false;     // drawing buffer holds an orb
  let vw = 0;
  let vh = 0;
  let base = 1;          // device pixel ratio from resize(), capped at 2
  let level = 0;         // quality step, lowered on sustained slow frames
  let side = 0;          // backing store size, device px (square)
  let sideDpr = 1;       // pixel ratio the backing store was sized for
  let posL = NaN;
  let posT = NaN;
  let lastNow = 0;
  let slow = 0;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  function noiseData() {
    const a = new Uint8Array(64 * 64 * 4);
    let s = 0x2f6b1d3;
    for (let i = 0; i < a.length; i++) {
      s = (s + 0x6d2b79f5) | 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      a[i] = ((r ^ (r >>> 14)) >>> 24) & 255;
    }
    return a;
  }

  function rampData() {
    const a = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const u = i / 255;
      let k = 1;
      while (k < STOPS.length - 1 && u > STOPS[k][0]) k++;
      const s0 = STOPS[k - 1];
      const s1 = STOPS[k];
      const w = clamp((u - s0[0]) / (s1[0] - s0[0]), 0, 1);
      for (let c = 1; c < 4; c++) a[i * 4 + c - 1] = Math.round(s0[c] + (s1[c] - s0[c]) * w);
      a[i * 4 + 3] = 255;
    }
    return a;
  }

  function texture(unit, w, h, data, wrap) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  // Build every GPU resource. Used at init and again after a context restore.
  function setup() {
    const vs = shader(gl.VERTEX_SHADER, VS);
    const fs = shader(gl.FRAGMENT_SHADER, FS);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aP');
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return false;
    }
    prog = p;
    gl.useProgram(p);
    U = {
      C: gl.getUniformLocation(p, 'uC'),
      A: gl.getUniformLocation(p, 'uA'),
      Rot: gl.getUniformLocation(p, 'uRot'),
      O1: gl.getUniformLocation(p, 'uO1'),
      O2: gl.getUniformLocation(p, 'uO2'),
      Sh: gl.getUniformLocation(p, 'uSh')
    };
    gl.uniform1i(gl.getUniformLocation(p, 'uN'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'uP'), 1);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    texN = texture(0, 64, 64, noiseData(), gl.REPEAT);
    texP = texture(1, 256, 1, rampData(), gl.CLAMP_TO_EDGE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    side = 0;
    drawn = false;
    return !gl.isContextLost();
  }

  function hide() {
    drawn = false;
    if (shown && cv) {
      cv.style.visibility = 'hidden';
      shown = false;
    }
  }

  function blank() {
    if (drawn && gl && !gl.isContextLost()) gl.clear(gl.COLOR_BUFFER_BIT);
    hide();
  }

  function onLost(e) {
    e.preventDefault();
    lost = true;
    prog = vbo = texN = texP = U = null;
    hide();
  }

  function onRestored() {
    try {
      lost = false;
      if (!setup()) ok = false;
    } catch (err) {
      ok = false;
    }
  }

  function teardown() {
    if (cv) {
      cv.removeEventListener('webglcontextlost', onLost, false);
      cv.removeEventListener('webglcontextrestored', onRestored, false);
    }
    try {
      if (gl && !gl.isContextLost()) {
        if (prog) gl.deleteProgram(prog);
        if (vbo) gl.deleteBuffer(vbo);
        if (texN) gl.deleteTexture(texN);
        if (texP) gl.deleteTexture(texP);
        const ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      }
    } catch (err) { /* already gone */ }
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    cv = gl = prog = vbo = texN = texP = U = null;
    ok = lost = shown = drawn = false;
    side = 0;
    level = 0;
    slow = 0;
  }

  function init() {
    try {
      if (ok) return true;
      teardown();
      const stage = document.getElementById('orb');
      if (!stage || !stage.parentNode) return false;
      cv = document.createElement('canvas');
      cv.id = 'orb-gl';
      cv.setAttribute('aria-hidden', 'true');
      cv.width = 1;
      cv.height = 1;
      const st = cv.style;
      st.position = 'fixed';
      st.left = '0';
      st.top = '0';
      st.width = '1px';
      st.height = '1px';
      st.zIndex = '1';
      st.pointerEvents = 'none';
      st.visibility = 'hidden';
      st.transformOrigin = '0 0';
      st.willChange = 'transform';
      const attrs = {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true
      };
      gl = cv.getContext('webgl', attrs) || cv.getContext('experimental-webgl', attrs);
      if (!gl || !setup()) {
        teardown();
        return false;
      }
      cv.addEventListener('webglcontextlost', onLost, false);
      cv.addEventListener('webglcontextrestored', onRestored, false);
      stage.parentNode.insertBefore(cv, stage);
      ok = true;
      resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
      return true;
    } catch (err) {
      teardown();
      return false;
    }
  }

  function resize(w, h, dpr) {
    vw = num(w, 0);
    vh = num(h, 0);
    const b = clamp(num(dpr, 1), 0.5, 2);
    if (b !== base) {
      base = b;
      side = 0;
    }
  }

  // Lower the resolution after sustained slow frames (never raises it again).
  function pace() {
    const now = performance.now();
    const dt = now - lastNow;
    lastNow = now;
    if (dt <= 0 || dt > 250) return;
    if (dt > SLOW_MS) slow++;
    else if (slow > 0) slow--;
    if (slow > 60) {
      slow = 0;
      const cur = Math.min(base, LEVELS[level]);
      for (let i = level + 1; i < LEVELS.length; i++) {
        if (Math.min(base, LEVELS[i]) < cur) {
          level = i;
          break;
        }
      }
    }
  }

  function draw(o) {
    try {
      if (!ok || lost || !gl || !o || gl.isContextLost()) return false;
      const form = clamp(num(o.form, 0), 0, 1);
      const r0 = num(o.r, 0);
      const x = num(o.x, NaN);
      const y = num(o.y, NaN);
      if (form < 0.02 || r0 < 4 || x !== x || y !== y) {
        blank();
        return true;
      }
      const half = EXT * r0;
      if (vw > 0 && vh > 0 && (x + half < 0 || y + half < 0 || x - half > vw || y - half > vh)) {
        blank();
        return true;
      }
      pace();
      const t = num(o.t, 0);
      const en = clamp(num(o.energy, 1), 0, 1);
      const beat = clamp(num(o.beat, 0), 0, 1);
      const voice = clamp(num(o.voice, 0), 0, 1);

      // backing store: a square around the orb, in 16 px steps, reallocated only when it must grow,
      // shrink a lot, or the pixel ratio changes
      const span = 2 * half + 4;
      let dpr = Math.min(base, LEVELS[level]);
      if (span * dpr > MAX_SIDE) dpr = Math.max(0.25, Math.floor((MAX_SIDE / span) * 8) / 8);
      const need = Math.min(MAX_SIDE, Math.ceil((span * dpr) / 16) * 16);
      if (dpr !== sideDpr || need > side || need < side * 0.7) {
        side = need;
        sideDpr = dpr;
        cv.width = side;
        cv.height = side;
        cv.style.width = side / dpr + 'px';
        cv.style.height = side / dpr + 'px';
        gl.viewport(0, 0, side, side);
        posL = posT = NaN;
      }
      // whole device pixels for the element, the sub-pixel rest goes to the shader
      const cssSide = side / sideDpr;
      const L = Math.round((x - cssSide / 2) * sideDpr);
      const T = Math.round((y - cssSide / 2) * sideDpr);
      if (L !== posL || T !== posT) {
        posL = L;
        posT = T;
        cv.style.transform = 'translate3d(' + L / sideDpr + 'px,' + T / sideDpr + 'px,0)';
      }

      const s = form * form * (3 - 2 * form);
      const r = r0 * (1 + 0.008 * Math.sin(t * 1.7)) * (1 + 0.035 * beat) * (0.9 + 0.1 * s);
      const P = t + T0;
      const a1 = P * 0.07;
      const a2 = -P * 0.05;
      gl.uniform3f(U.C, x * sideDpr - L, side - (y * sideDpr - T), r * sideDpr);
      gl.uniform4f(U.A, form, en, beat, voice);
      gl.uniform4f(U.Rot, Math.cos(a1), Math.sin(a1), Math.cos(a2), Math.sin(a2));
      gl.uniform4f(U.O1,
        0.9 * Math.sin(P * 0.061), 0.9 * Math.cos(P * 0.047),
        0.8 * Math.cos(P * 0.053 + 1.7), 0.8 * Math.sin(P * 0.069 + 0.4));
      gl.uniform4f(U.O2,
        0.6 * Math.sin(P * 0.091 + 2.1), 0.6 * Math.cos(P * 0.077 + 0.9),
        -0.015 * Math.sin(t * 1.7), 0.012 * Math.cos(t * 1.3));
      gl.uniform2f(U.Sh, Math.cos(P * 6.5), Math.sin(P * 6.5));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawn = true;
      if (!shown) {
        cv.style.visibility = 'visible';
        shown = true;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function clear() {
    try {
      blank();
    } catch (err) { /* nothing to clear */ }
  }

  function destroy() {
    try {
      teardown();
    } catch (err) { /* already gone */ }
  }

  // Diagnostics for QA (read-only).
  function info() {
    return { ok, lost, dpr: sideDpr, side, level };
  }

  window.NextStepOrbGL = { init, resize, draw, clear, destroy, info };
})();
