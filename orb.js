'use strict';
/* Canvas 2D liquid-light orb. No WebGL, no video.
   Glass sphere over a quiet aurora, with wind-blown molecules that
   spiral back together, a soft glint, and a tap ripple.
   Pauses while the tab is hidden. prefers-reduced-motion draws one still frame.
   window.NextStepOrb = { celebrate(), level(v) }:
     celebrate()  a short burst of light and two rings once the orb has formed (queued while it travels).
     level(v)     an outside voice level 0..1 (read-aloud word boundaries, a microphone) the orb glows and
                  rings with; call it every frame to hold it, it fades on its own. It replaces the
                  simulated syllables of [data-say] while it is active.
   Both are no-ops under prefers-reduced-motion or while the page is hidden. */
(function () {
  window.NextStepOrb = window.NextStepOrb || { celebrate() {}, level() {} };
  const aurora = document.getElementById('aurora');
  const stage = document.getElementById('orb');
  if (!aurora || !stage) return;
  const ag = aurora.getContext('2d', { alpha: true, desynchronized: true });
  const cg = stage.getContext('2d', { alpha: true, desynchronized: true });
  if (!ag || !cg) return;
  const appRoot = document.getElementById('app');
  const pick = (sel) => (appRoot && appRoot.querySelector(sel)) || document.querySelector(sel);

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const N = 440;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (u) => u * u * (3 - 2 * u);
  const sm = (a, b, x) => {
    const u = clamp((x - a) / (b - a || 1), 0, 1);
    return ss(u);
  };
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const a = GOLDEN * i;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const rnd = [hash(i + 1.3), hash(i + 8.1), hash(i + 4.7), hash(i + 2.2)];
    const wind = clamp((x * 0.83 + y * 0.45 + z * 0.33) * 0.5 + 0.5, 0, 1);
    const n = hash(x * 12.3 + y * 4.1 + z * 8.7 + 3);
    pts.push({
      x, y, z, rnd,
      e: 0.06 + 0.88 * clamp(n * 0.5 + wind * 0.5, 0, 1),
      hue: hash(i * 7.31),
      spark: rnd[3] > 0.965
    });
  }

  function sprite(rgb) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const rad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    rad.addColorStop(0, 'rgba(' + rgb + ',1)');
    rad.addColorStop(0.45, 'rgba(' + rgb + ',.45)');
    rad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, 32, 32);
    return c;
  }
  const sprites = [
    sprite('255,196,150'),
    sprite('255,236,224'),
    sprite('255,140,176'),
    sprite('196,150,255')
  ];
  const motes = [];
  for (let i = 0; i < 36; i++) {
    motes.push({
      x: Math.random() * 390,
      y: Math.random() * 844,
      z: 0.35 + Math.random() * 0.65,
      p: Math.random() * 6.28
    });
  }

  let dprCap = Math.min(window.devicePixelRatio || 1, 2);
  let vw = 0;
  let vh = 0;
  let reduced = mq.matches;
  let hidden = document.hidden;
  let raf = 0;
  let last = performance.now();
  let slow = 0;
  let t = 0;
  let st = 'off';
  let D = 2;
  let mode = 1;
  let tau = 0;
  let w = 0;
  let hold = 0;
  let beat = 0;
  let bt = 99;
  let rate = 1 / 3;
  let envA = 0;
  let envT = 0;
  let energy = 1;
  let eA = 1;
  let voice = false;
  let holdDur = 9.5;
  let anchor = null;
  let cx = 0;
  let cy = 0;
  let R = 74;
  let tx = 0;
  let ty = 0;
  let ptr = null;
  let tap = null;
  const pulses = [-1, -1];
  let syl = null;
  let vt = 0;
  let vEnd = 0;
  let vRaw = 0;
  let vA = 0;
  let vB = 0;
  let vRing = 9;
  let bgStill = false;
  let ext = 0;
  let extAt = -1e9;
  let extRing = 9;
  let cheerAt = 0;
  let burst = [];
  let ring2 = -1;

  function resize() {
    const s = reduced ? 1 : dprCap;
    vw = window.innerWidth;
    vh = window.innerHeight;
    for (const cv of [aurora, stage]) {
      cv.width = Math.max(1, Math.round(vw * s));
      cv.height = Math.max(1, Math.round(vh * s));
      cv.style.width = vw + 'px';
      cv.style.height = vh + 'px';
    }
    ag.setTransform(s, 0, 0, s, 0, 0);
    cg.setTransform(s, 0, 0, s, 0, 0);
    bgStill = false;
    if (reduced) draw(true);
  }

  function pulse() {
    if (pulses[0] < 0 || (pulses[1] >= 0 && pulses[0] > pulses[1])) pulses[0] = 0;
    else pulses[1] = 0;
    bt = 0;
  }

  function read(el) {
    const d = el.dataset;
    const up = (d.up || '166,102').split(',');
    const dn = (d.down || '101,280').split(',');
    envT = +(d.env || 1);
    energy = +(d.energy || 1);
    voice = d.voice === '1';
    const scale = +(d.s || 1);
    holdDur = voice ? 1e9 : scale >= 1 ? 9.5 : 15;
    el._band = { up0: +up[0], up1: +up[1], dn1: +dn[0], dn0: +dn[1] };
  }

  function startSay() {
    if (performance.now() - extAt < 600) { syl = null; return; }
    const q = pick('[data-say]');
    if (!q) { syl = null; return; }
    const text = q.textContent.trim();
    const next = [];
    let time = 0.3;
    let k = 0;
    text.split(/\s+/).forEach((word) => {
      const n = Math.max(1, (word.toLowerCase().replace(/e\b/, '').match(/[aeiouy]+/g) || []).length);
      for (let i = 0; i < n; i++) {
        next.push({ t: time, amp: 0.62 + 0.38 * Math.abs(Math.sin(++k * 2.7)), first: i === 0, fired: false });
        time += 0.17;
      }
      time += /[.?!]$/.test(word) ? 0.5 : /[,;:]$/.test(word) ? 0.26 : 0.04;
    });
    syl = next;
    vt = 0;
    vEnd = time + 0.2;
    vRing = 9;
    vRaw = 0;
  }

  function stepVoice(dt) {
    vRaw = 0;
    if (!syl) return;
    vt += dt;
    vRing += dt;
    let a = 0;
    for (const s of syl) {
      const x = vt - s.t;
      if (x <= 0 || x > 0.5) continue;
      a = Math.max(a, s.amp * Math.min(1, x / 0.03) * Math.exp(-Math.max(0, x - 0.03) / 0.085));
      if (s.first && !s.fired) {
        s.fired = true;
        if (vRing > 1.2) { vRing = 0; pulse(); }
      }
    }
    vRaw = a;
    if (vt > vEnd) syl = null;
  }

  /* Outside voice level (0..1): a quick rise, a soft fall, a ring on a strong onset. */
  function level(v) {
    if (reduced || hidden) return;
    const x = clamp(Number(v) || 0, 0, 1);
    if (x - ext > 0.35 && extRing > 1.2 && st === 'hold') { extRing = 0; pulse(); }
    ext = Math.max(ext, x);
    extAt = performance.now();
    syl = null;
  }

  function celebrate() {
    if (reduced || hidden) return;
    cheerAt = performance.now();
    start();
  }

  function fireBurst() {
    burst = [];
    for (let i = 0; i < 72; i++) {
      const a = Math.random() * Math.PI * 2;
      burst.push({
        a,
        sp: 1.1 + Math.random() * 2.1,
        life: 1.1 + Math.random() * 0.9,
        age: -Math.random() * 0.12,
        sz: 2 + Math.random() * 3.2,
        lift: 0.15 + Math.random() * 0.35,
        img: sprites[i % 4 === 0 ? 1 : i % 3 === 0 ? 2 : 0]
      });
    }
    pulse();
    ring2 = 0.32;
  }

  function stepCheer(dt) {
    if (cheerAt) {
      if (anchor && anchor.isConnected && st === 'hold') { cheerAt = 0; fireBurst(); }
      else if (performance.now() - cheerAt > 7000) cheerAt = 0;
    }
    if (ring2 >= 0 && (ring2 -= dt) < 0) { ring2 = -1; pulse(); }
    if (burst.length) {
      let alive = 0;
      for (const b of burst) if ((b.age += dt) < b.life) alive++;
      if (!alive) burst = [];
    }
  }

  function step(dt) {
    t += dt;
    const el = pick('[data-orb]');
    if (pulses[0] >= 0 && (pulses[0] += dt) > 2.4) pulses[0] = -1;
    if (pulses[1] >= 0 && (pulses[1] += dt) > 2.4) pulses[1] = -1;
    bt += dt;

    if (el !== anchor && st !== 'swap') {
      st = 'swap';
      envT = 0;
      if (D < 0.001) mode = 1;
      syl = null;
    }
    if (st === 'swap') {
      D = Math.min(2, D + dt * 4);
      if (D >= 2 && envA < 0.04) {
        anchor = el;
        mode = 1;
        if (el) { read(el); st = 'wait'; w = 0; }
        else st = 'off';
      }
    } else if (st === 'wait') {
      if ((w += dt) > 0.15) { st = 'in'; tau = 0; mode = 1; }
    } else if (st === 'in') {
      tau = Math.min(1, tau + dt / 2.6);
      D = 2 * (1 - ss(tau));
      if (tau >= 1) {
        D = 0;
        st = 'hold';
        hold = 0;
        beat = 0;
        if (voice) startSay();
        else pulse();
      }
    } else if (st === 'hold') {
      hold += dt;
      if (voice) stepVoice(dt);
      else if ((beat += dt) > 4.6) { beat = 0; pulse(); }
      if (hold > holdDur) { st = 'out'; tau = 0; mode = 0; rate = 1 / 3; }
    } else if (st === 'out') {
      tau = Math.min(1, tau + dt * rate);
      D = 2 * ss(tau);
      if (tau >= 1) { st = 'gap'; w = 0; }
    } else if (st === 'gap') {
      if ((w += dt) > 0.18) { st = 'in'; tau = 0; mode = 1; }
    }

    envA += (envT - envA) * (1 - Math.exp(-dt * 7));
    eA += (energy - eA) * (1 - Math.exp(-dt * 3));
    extRing += dt;
    ext *= Math.exp(-dt / 0.14);
    const extOn = performance.now() - extAt < 500;
    const vOn = st === 'hold' && voice && syl;
    vA += ((extOn ? ext : vOn ? vRaw : 0) - vA) * (1 - Math.exp(-dt * 22));
    vB += ((extOn || vOn ? 1 : 0) - vB) * (1 - Math.exp(-dt * 4));
    stepCheer(dt);

    if (anchor && anchor.isConnected) {
      const r = anchor.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      R = Math.max(8, r.width / 2);
    }

    let ttx = 0;
    let tty = 0;
    if (ptr && anchor && performance.now() - ptr.t < 3500) {
      const dx = ptr.x - cx;
      const dy = ptr.y - cy;
      if (Math.hypot(dx, dy) < 520) {
        ttx = clamp(dx / (R * 3), -1, 1);
        tty = clamp(dy / (R * 3), -1, 1);
      }
    }
    const kt = 1 - Math.exp(-dt * 4);
    tx += (ttx - tx) * kt;
    ty += (tty - ty) * kt;

    if (tap && anchor && st === 'hold') {
      const dd = Math.hypot(tap.x - cx, tap.y - cy);
      if (voice) {
        if (dd < R * 1.8) startSay();
      } else if (dd < R * 1.15) {
        st = 'out';
        tau = 0;
        mode = 0;
        rate = 1 / 1.9;
      } else if (dd < R * 3.4) {
        beat = 0;
        pulse();
      }
    }
    tap = null;
  }

  function drawAurora(still) {
    ag.clearRect(0, 0, vw, vh);
    const time = still ? 2.4 : t;
    const driftX = still ? 0 : Math.sin(time / 6.5) * 28;
    const driftY = still ? 0 : Math.cos(time / 8.3) * 22;
    const breathe = still ? 1 : 0.9 + 0.1 * Math.sin(time / 4.1);
    const blobs = [
      { x: vw * 0.18 + driftX, y: vh * 0.16 + driftY, r: vw * 0.72, c: '150, 92, 148', a: 0.22 },
      { x: vw * 0.72 - driftX * 0.6, y: vh * 0.28, r: vw * 0.5, c: '196, 120, 150', a: 0.08 },
      { x: vw * 0.4, y: vh * 0.55 + driftY, r: vw * 0.62, c: '92, 48, 120', a: 0.1 }
    ];
    for (const b of blobs) {
      const g = ag.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(' + b.c + ',' + (b.a * breathe) + ')');
      g.addColorStop(1, 'rgba(' + b.c + ',0)');
      ag.fillStyle = g;
      ag.fillRect(0, 0, vw, vh);
    }
    if (still) { bgStill = true; return; }
    bgStill = false;
    const sw = (time / 15) % 1;
    const pos = -vw * 0.4 + sw * (vw * 1.8);
    const pk = 0.045 * Math.sin(Math.PI * sw);
    ag.save();
    ag.translate(vw / 2, vh / 2);
    ag.rotate(Math.PI / 4);
    const lg = ag.createLinearGradient(pos - 140, 0, pos + 140, 0);
    lg.addColorStop(0, 'rgba(255,225,235,0)');
    lg.addColorStop(0.5, 'rgba(255,225,235,' + pk + ')');
    lg.addColorStop(1, 'rgba(255,225,235,0)');
    ag.fillStyle = lg;
    ag.fillRect(-vh, -vh, vh * 2, vh * 2);
    ag.restore();
    const scaleX = vw / 390;
    const scaleY = vh / 844;
    for (const m of motes) {
      m.x += (3 + 8 * m.z) * (1 / 60);
      m.y += (5 + 11 * m.z) * (1 / 60);
      if (m.x > 400) m.x = -10;
      if (m.y > 854) { m.y = -10; m.x = Math.random() * 390; }
      const fall = Math.max(0, 1 - Math.hypot(m.x, m.y) / 760);
      const al = fall * fall * (0.25 + 0.4 * m.z) * (0.55 + 0.45 * Math.sin(time * 0.7 + m.p));
      if (al < 0.02) continue;
      ag.fillStyle = 'rgba(255,232,224,' + al.toFixed(3) + ')';
      ag.beginPath();
      ag.arc(m.x * scaleX, m.y * scaleY, (0.6 + 1.1 * m.z) * Math.min(scaleX, 1.4), 0, 6.2832);
      ag.fill();
    }
  }

  function drawGlass(x, y, radius, form, beatAmt, voiceAmt) {
    if (form < 0.02 || radius < 4) return;
    const breathe = reduced ? 0 : Math.sin(t * 1.7) * 0.008 * radius;
    const r = radius + breathe;
    const glowA = (0.22 + 0.35 * eA) * form;
    cg.save();
    const glow = cg.createRadialGradient(x, y, r * 0.72, x, y, r * 1.45);
    glow.addColorStop(0, 'rgba(255,176,130,' + (0.28 * glowA) + ')');
    glow.addColorStop(0.55, 'rgba(180,70,130,' + (0.1 * glowA) + ')');
    glow.addColorStop(1, 'rgba(80,20,70,0)');
    cg.fillStyle = glow;
    cg.beginPath();
    cg.arc(x, y, r * 1.45, 0, Math.PI * 2);
    cg.fill();

    cg.beginPath();
    cg.arc(x, y, r, 0, Math.PI * 2);
    cg.clip();
    cg.globalAlpha = form;

    const coreShift = reduced ? 0 : Math.sin(t * 1.7) * 0.015;
    const body = cg.createRadialGradient(x - r * (0.22 + coreShift), y - r * 0.28, r * 0.04, x + r * 0.05, y + r * 0.08, r);
    const peach = clamp(0.82 + 0.12 * eA + beatAmt * 0.25 + voiceAmt * 0.45, 0, 1);
    body.addColorStop(0, 'rgba(255,214,176,' + peach + ')');
    body.addColorStop(0.16, '#FFB184');
    body.addColorStop(0.34, '#F08A78');
    body.addColorStop(0.55, '#C45A90');
    body.addColorStop(0.78, '#6A3478');
    body.addColorStop(1, '#241228');
    cg.fillStyle = body;
    cg.fillRect(x - r, y - r, r * 2, r * 2);

    const spin = reduced ? 0.4 : t * 1.15;
    const cx1 = x + Math.cos(spin) * r * 0.16;
    const cy1 = y + Math.sin(spin * 1.2) * r * 0.12;
    const caustic = cg.createRadialGradient(cx1, cy1, 0, cx1, cy1, r * 0.42);
    caustic.addColorStop(0, 'rgba(255,186,140,0.22)');
    caustic.addColorStop(1, 'rgba(255,186,140,0)');
    cg.fillStyle = caustic;
    cg.beginPath();
    cg.arc(cx1, cy1, r * 0.42, 0, Math.PI * 2);
    cg.fill();

    const hx = x - r * 0.30;
    const hy = y - r * 0.34;
    const glint = cg.createRadialGradient(hx, hy, 0, hx, hy, r * 0.16);
    glint.addColorStop(0, 'rgba(255,252,248,' + (0.85 * form) + ')');
    glint.addColorStop(0.45, 'rgba(255,228,206,' + (0.28 * form) + ')');
    glint.addColorStop(1, 'rgba(255,228,206,0)');
    cg.fillStyle = glint;
    cg.beginPath();
    cg.arc(hx, hy, r * 0.16, 0, Math.PI * 2);
    cg.fill();

    const rim = cg.createRadialGradient(x, y, r * 0.72, x, y, r);
    rim.addColorStop(0, 'rgba(255,210,180,0)');
    rim.addColorStop(1, 'rgba(255,196,170,0.22)');
    cg.fillStyle = rim;
    cg.fillRect(x - r, y - r, r * 2, r * 2);
    cg.restore();
  }

  function drawParticles(x, y, radius) {
    const k = radius / 74;
    cg.save();
    cg.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const u = clamp(D - p.e, 0, 1);
      const s = ss(u);
      let px, py, pz, al, sz;
      if (p.spark && D > 0.08 && D < 1.15) {
        const ro = 1.18 + 0.55 * p.rnd[1];
        const th = p.rnd[0] * 6.2832 + (reduced ? 0 : t * 0.45) / Math.pow(ro, 1.2);
        const bx = p.x;
        const by = p.y;
        const bz = p.z;
        const bl = Math.hypot(bx, by, bz) || 1;
        px = (bx / bl) * ro * Math.cos(th) * 0.15 + Math.cos(th) * ro * 0.92;
        py = (by / bl) * ro * 0.35 + Math.sin(th * 0.5) * 0.15;
        pz = Math.sin(th) * ro * 0.55;
        al = (0.35 + 0.5 * (0.5 + 0.5 * Math.sin((reduced ? 1 : t) * 1.3 + p.rnd[0] * 40))) * (1 - sm(0.15, 0.4, D));
        sz = (1.5 + 1.8 * p.rnd[2]) * k;
      } else if (mode > 0.5) {
        const fl = Math.hypot(p.x, p.y * 0.16, p.z) || 1;
        const rad = 1.35 + 2.1 * p.rnd[1] * p.rnd[1];
        const an = s * (2.2 + 1.6 * p.rnd[0]) + (reduced ? 0 : t * 0.12 * s);
        const ca = Math.cos(an);
        const sa = Math.sin(an);
        let qx = p.x + (p.x / fl * rad - p.x) * s;
        let qy = p.y + (p.y * 0.16 / fl * rad - p.y) * s;
        let qz = p.z + (p.z / fl * rad - p.z) * s;
        const rx = ca * qx + sa * qz;
        qz = -sa * qx + ca * qz;
        qx = rx;
        px = qx; py = qy; pz = qz;
        al = Math.sin(clamp(u, 0, 1) * Math.PI) * (0.55 + 0.45 * p.rnd[2]);
        sz = (1.4 + 2.4 * p.rnd[2]) * k;
      } else {
        const wob = reduced ? 0 : 1;
        px = p.x * (1 + 0.22 * s) + 0.55 * (0.35 + 1.15 * p.rnd[1]) * s * s + Math.sin(p.y * 3.7 + t * 1.4) * 0.22 * s * wob;
        py = p.y * (1 + 0.18 * s) + 0.35 * s * s + Math.cos(p.z * 3.1 + t * 0.7) * 0.14 * s * wob;
        pz = p.z * (1 + 0.2 * s) + 0.25 * s * s;
        al = sm(0, 0.05, u) * (1 - sm(0.9, 1, u)) * (0.55 + 0.45 * p.rnd[2]);
        sz = (1.3 + 2.2 * p.rnd[2]) * (1 - 0.35 * u) * k;
      }
      if (al < 0.04) continue;
      if (pz < -0.15 && D < 0.25 && !p.spark) continue;
      const ps = 1 + pz * 0.08;
      const sx = x + px * radius * ps;
      const sy = y - py * radius * ps;
      const size = clamp(sz * ps * (0.7 + 0.5 * Math.min(radius / 74, 1.4)), 1.5, 18);
      const spriteIdx = p.hue < 0.34 ? 0 : p.hue < 0.58 ? 1 : p.hue < 0.8 ? 2 : 3;
      cg.globalAlpha = clamp(al, 0, 0.9);
      cg.drawImage(sprites[spriteIdx], sx - size, sy - size, size * 2, size * 2);
    }
    cg.restore();
  }

  function drawBridge(x, y, radius) {
    if (D < 1.05) return;
    cg.save();
    cg.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 56; i++) {
      const speed = 2.2 + (i % 5) * 0.7;
      const a = t * speed + i * 0.67;
      const rad = radius * (0.18 + (i % 8) * 0.14);
      const sx = x + Math.cos(a) * rad;
      const sy = y + Math.sin(a * 1.13 + i * 0.35) * rad;
      const s = 2.4 + (i % 4) * 0.9;
      cg.globalAlpha = 0.5 + 0.35 * Math.sin(t * 5 + i);
      cg.drawImage(sprites[i % 4], sx - s, sy - s, s * 2, s * 2);
    }
    cg.restore();
  }

  function drawRings(x, y, radius) {
    for (let i = 0; i < 2; i++) {
      const age = pulses[i];
      if (age < 0) continue;
      const u = age / 2.4;
      if (u >= 1) continue;
      const ez = 1 - Math.pow(1 - u, 3);
      const rr = radius * (0.35 + 2.8 * ez);
      const fd = (1 - u) * (1 - u);
      cg.beginPath();
      cg.arc(x, y, rr, 0, Math.PI * 2);
      cg.strokeStyle = 'rgba(255,214,186,' + (0.45 * fd) + ')';
      cg.lineWidth = 1.6;
      cg.stroke();
      cg.beginPath();
      cg.arc(x, y, rr, 0, Math.PI * 2);
      cg.strokeStyle = 'rgba(255,186,150,' + (0.12 * fd) + ')';
      cg.lineWidth = 8;
      cg.stroke();
    }
  }

  function drawBurst(x, y, radius) {
    if (!burst.length) return;
    cg.save();
    cg.globalCompositeOperation = 'lighter';
    const k = radius / 74;
    for (const b of burst) {
      if (b.age <= 0 || b.age >= b.life) continue;
      const u = b.age / b.life;
      const out = 1 - Math.exp(-b.age * 2.4);
      const dist = radius * (0.9 + b.sp * out);
      const sx = x + Math.cos(b.a) * dist;
      const sy = y + Math.sin(b.a) * dist - radius * b.lift * out + radius * 0.22 * b.age * b.age;
      const size = clamp(b.sz * k * (1.6 - 0.8 * u), 1.2, 10);
      cg.globalAlpha = clamp((1 - u) * (1 - u) * Math.min(1, b.age / 0.08), 0, 0.95);
      cg.drawImage(b.img, sx - size, sy - size, size * 2, size * 2);
    }
    cg.restore();
  }

  function draw(still) {
    if (!still) drawAurora(false);
    else if (!bgStill) drawAurora(true);
    cg.clearRect(0, 0, vw, vh);
    if (!anchor || !anchor.isConnected || R < 4) return;
    const bobX = still ? 0 : Math.sin(t * 0.37 + 1.3) * 2.2 * Math.min(1, R / 74);
    const bobY = still ? 0 : Math.sin(t * 0.55) * 3.6 * Math.min(1, R / 74);
    const x = cx + bobX + tx * R * 0.06;
    const y = cy + bobY + ty * R * 0.05;
    const form = 1 - sm(0.45, 1.75, D);
    const beatAmt = bt < 4 ? Math.min(1, bt / 0.14) * Math.exp(-bt * 2.4) : 0;
    const voiceAmt = clamp(vA * 0.9 + vB * 0.08, 0, 1) * form;
    drawGlass(x, y, R, Math.max(form, still ? 1 : form), still ? 0 : beatAmt, still ? 0 : voiceAmt);
    if (!still) {
      drawParticles(x, y, R);
      drawBridge(x, y, R);
      drawRings(x, y, R);
      drawBurst(x, y, R);
    }
  }

  function frame(now) {
    if (hidden || reduced) { raf = 0; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (dt > 0.034) slow += 1;
    else slow = Math.max(0, slow - 1);
    if (slow > 50 && dprCap > 1) {
      dprCap = 1;
      slow = 0;
      resize();
    }
    step(dt);
    draw(false);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || reduced || hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function settleStill() {
    reduced = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    D = 0;
    st = 'hold';
    mode = 1;
    syl = null;
    vA = 0;
    ext = 0;
    cheerAt = 0;
    burst = [];
    ring2 = -1;
    const el = pick('[data-orb]');
    anchor = el;
    if (el) read(el);
    envA = envT;
    eA = energy;
    if (anchor && anchor.isConnected) {
      const r = anchor.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      R = Math.max(8, r.width / 2);
    }
    bgStill = false;
    resize();
  }

  window.addEventListener('pointermove', (e) => { ptr = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
  window.addEventListener('pointerdown', (e) => {
    ptr = { x: e.clientX, y: e.clientY, t: performance.now() };
    tap = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  window.addEventListener('resize', () => { if (reduced) settleStill(); else resize(); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => { if (reduced) settleStill(); else resize(); });
  }
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (!reduced) start();
  });
  mq.addEventListener?.('change', () => {
    if (mq.matches) settleStill();
    else { reduced = false; bgStill = false; resize(); start(); }
  });

  window.NextStepOrb = { celebrate, level };
  resize();
  if (reduced) settleStill();
  else start();
  if (appRoot && window.MutationObserver) {
    const mo = new MutationObserver(() => { if (reduced || mq.matches) settleStill(); });
    mo.observe(appRoot, { childList: true, subtree: true });
  }
})();
