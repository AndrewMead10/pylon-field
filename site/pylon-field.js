/* Pylon Field: a first-person fight at dusk under a dry lightning storm. It opens from behind the wheel: you crest a hill and
   find two pylons tearing a car apart on the road below, inside a ring of others that still look like ordinary pylons. They see
   you, one leaps, and you come to beside your own wreck. The ring then tears its buried legs out of the soil a few at a time.
   The field, road, sky and far grid are baked splats; everything that moves (pylons, legs, wires, lightning, tracers, your
   wreck) is redrawn each frame as frame-local splats. The scene carries its own simulation on world.game, so the page only
   feeds input and reads events. */
const RING = 8, ROVERS = 2, RING_R = 17, FAR_R = 39, ARENA = 30, HILL_Z = 52, EYE = 1.7;
const TOWER_H = 9, L1 = 5, L2 = 6.6, REACH = (L1 + L2) * 0.97, FOOT_R = 5.4, LIFT = 1.9;
const WAVES = [2, 3, 3];
const MAG = 30, LEG_HP = 7, CUT_REACH = 3.6, ROOT_REACH = 4.2;
const SHRINK = 0.62; // a streak's gaussian runs past its ends, so draw each strut a little short

// Palette slots
const SKY = [1, 2, 3, 4, 5, 6], STEEL = 14, STEEL_LIT = 16, RED_DIM = 18, RED = 20, RED_HOT = 21, HOT = 24, ARC = 26;

module.exports = ({ makeBuilder, makeSculpt, KIT: K }) => ({
  id: 'pylon-field',
  name: 'Pylon Field',
  seed: 22,
  build(seed) {
    const V = K.V;
    const palette = [
      0x0a1230,
      // dusk sky, zenith to horizon
      0x0c1636, 0x122048, 0x1a2d5c, 0x263d70, 0x3a5384, 0x556c96,
      // earth and dry grass, dark to light
      0x06080b, 0x0e120f, 0x1a1e15, 0x2b2d1e, 0x45422b, 0x696038, 0x93854d,
      // steel
      0x04060b, 0x0c111d, 0x182031, 0x2a3447,
      // warning lights
      0x520a10, 0xb00c18, 0xff2a2a, 0xff8468, 0xffe2d2,
      // muzzle and sparks
      0xffb838, 0xfff0b0,
      // arcing
      0x58c0ff, 0xd4f5ff,
      // asphalt and road paint
      0x12141a, 0x1d2028, 0x8a8672,
      // car paint: yours, then the stranger's
      0x33110f, 0x6b2318, 0xa23c22, 0x353d4b, 0x586373, 0x8591a0,
      // red seen against the dusk: where a lamp's soft edge meets the sky it settles on these, not on the grass greens
      0x2c1038, 0x4a0f30, 0x7a0e24
    ];
    const B = makeBuilder(seed, palette);
    const S = K.sculpt(makeSculpt(B));
    S.amb = 0.5;
    S.sky = 0.35;
    S.sun = V.norm([-0.5, 0.35, -0.8]);
    const fbm = (x, z, o) => B.fbm(x + seed * 0.71, 0.3, z, o) - 0.5;

    // ---- the baked field ----
    // the road runs north over a hill to the south and straight through the ring
    const hill = z => 5.2 * Math.exp(-(((z - HILL_Z) / 13) ** 2));
    const ground = (x, z) => hill(z) + 0.16 * fbm(x * 0.2, z * 0.2, 2) * Math.min(1, Math.abs(x) / 5);
    S.ground({ r: [7, 8, 9, 10], rf: (x, y, z) => (fbm(x * 0.12, z * 0.12, 3) > 0.08 ? [8, 9, 10, 11] : null) },
      { y: 0, rad: 50, zs: 0.78, cz: 8, res: 0.55, h: ground });
    S.terrain({ r: [27, 27, 28, 28] }, { h: (x, z) => hill(z) + 0.04, x0: -3.3, x1: 3.3, z0: -55, z1: 71, res: 0.3 });

    // A small saloon, nose toward its own -z. crush flattens the cabin. Returns where its lamps are.
    const glass = { r: [14, 15, 16] }, tyre = { r: [7, 14, 15] };
    const buildCar = (sculpt, at, yaw, paint, crush) => {
      const c = Math.cos(yaw), s = Math.sin(yaw), ax = [[c, 0, -s], [0, 1, 0], [s, 0, c]];
      const w = q => [at[0] + c * q[0] + s * q[2], at[1] + q[1], at[2] - s * q[0] + c * q[2]];
      const o = { ax, res: 0.075 }, roof = 1.1 - crush * 0.3, tall = 0.3 - crush * 0.13;
      sculpt.box(w([0, 0.58, 0]), [0.86, 0.3, 2.1], paint, { ...o, rd: 0.14 });
      sculpt.box(w([0, roof, 0.25]), [0.76, tall, 1.05], paint, { ...o, rd: 0.14 });
      sculpt.box(w([0, roof + 0.02, 0.25]), [0.785, tall * 0.55, 0.8], glass, { ...o, rd: 0.04 });
      sculpt.box(w([0, roof + 0.02, 0.25]), [0.6, tall * 0.55, 1.075], glass, { ...o, rd: 0.04 });
      for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]])
        sculpt.ball(w([sx * 0.84, 0.34, sz * 1.35]), [0.17, 0.34, 0.34], tyre, { ax, res: 0.07 });
      return { head: [w([0.58, 0.62, -2.14]), w([-0.58, 0.62, -2.14])], tail: [w([0.6, 0.68, 2.14]), w([-0.6, 0.68, 2.14])] };
    };
    const stranger = { x: 0.7, z: -22, yaw: 0.55 };
    const strangerLamps = buildCar(S, [stranger.x, hill(stranger.z) + 0.04, stranger.z], stranger.yaw, { r: [33, 34, 35] }, 0.8);
    S.bake();
    // road paint in short dabs: a long splat this close to the eye smears across the whole view
    // flat round dabs laid edge to edge, so the lines stay lines right up to your feet
    for (let z = -54; z < 70; z += 0.13) {
      const y = hill(z) + 0.1, up = [0, 1, 0];
      if (((z % 5) + 5) % 5 < 2.2) B.stick(0, y, z, up, 0.025, 0.085, B.P[29], 4, { nd: true });
      for (const x of [-2.95, 2.95]) if (B.R() < 0.93) B.stick(x, y, z, up, 0.025, 0.065, B.P[29], 4, { nd: true });
    }

    // your own car, baked apart so the wreck can be set down wherever the crash leaves it
    const carBuilder = makeBuilder(seed + 1, palette), carSculpt = K.sculpt(makeSculpt(carBuilder));
    Object.assign(carSculpt, { amb: S.amb, sky: S.sky, sun: S.sun });
    const wreckLamps = buildCar(carSculpt, [0, 0, 0], 0, { r: [30, 31, 32] }, 0.55);
    carSculpt.bake();
    const wreck = K.frameSplats.capture(carBuilder.finish({}));

    B.sky(d => {
      if (d[1] < -0.03) return 8;
      const glow = Math.max(0, -d[2]) * 0.12; // the last light sits low in the north
      const t = Math.min(1, Math.max(0, 1 - (d[1] - glow) * 2.6));
      return SKY[Math.min(5, Math.floor(t * t * 6))];
    }, 95);
    // storm cloud: a low dark ceiling with the horizon left clear under it
    for (let i = 0; i < 46; i++) {
      const a = B.R() * B.TAU, e = B.rr(0.22, 1.2), r = 88 * Math.cos(e);
      B.iso(Math.sin(a) * r, 88 * Math.sin(e), Math.cos(a) * r, B.rr(6, 12), B.P[B.R() < 0.6 ? 0 : 1], 0.7, { em: true, nd: true });
    }

    // dry grass: leaning blades, thick underfoot and thinning toward the horizon
    for (let i = 0; i < 16000; i++) {
      const r = 1.2 + 48 * Math.pow(B.R(), 1.4), a = B.R() * B.TAU, x = Math.cos(a) * r, z = 6 + Math.sin(a) * r * 1.25;
      if (Math.abs(x) < 3.7) continue;
      const patch = fbm(x * 0.15, z * 0.15, 3) + 0.5, h = B.rr(0.18, 0.5) * (0.6 + patch) * (1 + r * 0.02);
      const lean = [B.gauss() * 0.22 + 0.15, 1, B.gauss() * 0.22];
      const tone = Math.min(12, Math.max(9, Math.round(8.6 + patch * 2.6 + B.gauss() * 0.8)));
      B.stick(x, ground(x, z) + h * 0.5, z, V.norm(lean), h * 0.5, 0.02 + r * 0.0024, B.P[tone], 2.6, { nd: true });
    }

    // ---- pylon geometry, in the tower's own frame (y up from its footings, arms along x) ----
    const halfWidth = y => (y < 5.5 ? 1.15 - 0.7 * (y / 5.5) : 0.45 - 0.23 * ((y - 5.5) / 3.5));
    const struts = [], corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    const strut = (a, b, w = 0.055) => struts.push([a, b, w]);
    const levels = [0, 1.7, 3.1, 4.4, 5.5, 6.6, 7.6, 8.4, TOWER_H];
    for (let l = 0; l + 1 < levels.length; l++) {
      const y0 = levels[l], y1 = levels[l + 1], w0 = halfWidth(y0), w1 = halfWidth(y1);
      corners.forEach(([sx, sz], k) => {
        const [nx, nz] = corners[(k + 1) % 4];
        strut([sx * w0, y0, sz * w0], [sx * w1, y1, sz * w1], 0.07);
        strut([sx * w1, y1, sz * w1], [nx * w1, y1, nz * w1], 0.045);
        if ((l + k) % 2) strut([sx * w0, y0, sz * w0], [nx * w1, y1, nz * w1], 0.045);
        else strut([nx * w0, y0, nz * w0], [sx * w1, y1, sz * w1], 0.045);
      });
    }
    const arms = [[6.6, 2.9], [8.0, 2.1]], tips = [];
    for (const [y, span] of arms)
      for (const s of [-1, 1]) {
        const w = halfWidth(y), tip = [s * span, y + 0.22, 0];
        for (const z of [-w, w]) {
          strut([s * w, y, z], tip, 0.05);
          strut([s * w, y + 0.75, z], tip, 0.05);
        }
        strut([s * span * 0.55, y + 0.1, 0], [s * span * 0.55, y + 0.45, 0], 0.04);
        strut(tip, [tip[0], tip[1] - 0.55, 0], 0.06);
        tips.push(tip);
      }
    strut([0, TOWER_H, 0], [0, TOWER_H + 1, 0], 0.05);
    // concrete footings, underground until the tower lifts
    const footings = corners.map(([sx, sz]) => [[sx * 1.15, 0, sz * 1.15], [sx * 1.2, -1.0, sz * 1.2], 0.1]);
    const lamps = [[0, TOWER_H + 1.05, 0], tips[2], tips[3], [0.2, TOWER_H + 0.35, 0.1], [-0.2, TOWER_H + 0.6, -0.1]];
    const hips = corners.map(([sx, sz]) => [sx * 0.8, 1.2, sz * 0.8]);

    const frameOf = (x, z, heading) => ({ o: [x, 0, z], x: [Math.cos(heading), 0, -Math.sin(heading)], y: [0, 1, 0], z: [Math.sin(heading), 0, Math.cos(heading)] });
    const place = (f, p) => [
      f.o[0] + f.x[0] * p[0] + f.y[0] * p[1] + f.z[0] * p[2],
      f.o[1] + f.x[1] * p[0] + f.y[1] * p[1] + f.z[1] * p[2],
      f.o[2] + f.x[2] * p[0] + f.y[2] * p[1] + f.z[2] * p[2]
    ];
    const sag = (a, b, drop, n) => Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, p = V.lerp(a, b, t);
      p[1] -= drop * 4 * t * (1 - t);
      return p;
    });

    // The far grid: baked, thicker so it holds together at a pixel or two wide.
    const ringAt = k => {
      const a = (k + 0.5) / RING * B.TAU;
      return [Math.sin(a), Math.cos(a), a];
    };
    const bakeLine = (a, b, w, col) => {
      const d = V.sub(b, a), len = V.len(d);
      if (len > 1e-6) B.stick(...V.lerp(a, b, 0.5), V.mul(d, 1 / len), len * 0.5 * SHRINK, w, B.P[col], 3.2, { nd: true });
    };
    const farLamps = [], farFrames = [];
    const bakeTower = (f, scale, fat) => {
      const g = { ...f, x: V.mul(f.x, scale), y: V.mul(f.y, scale), z: V.mul(f.z, scale) };
      struts.forEach(([a, b, w], i) => (i % 3 !== 2 || scale > 0.9) && bakeLine(place(g, a), place(g, b), w * fat, STEEL));
      for (const lamp of lamps.slice(0, 3)) farLamps.push(place(g, lamp));
      return g;
    };
    for (let k = 0; k < RING; k++) {
      const [sx, cz, a] = ringAt(k);
      farFrames.push(bakeTower(frameOf(sx * FAR_R, cz * FAR_R, a + Math.PI), 1, 1.9));
    }
    for (let k = 0; k < RING; k++) {
      const a = farFrames[k], b = farFrames[(k + 1) % RING];
      for (const tip of tips) {
        const line = sag(place(a, tips[tips.indexOf(tip) ^ 1]), place(b, tip), 2.2, 9);
        for (let i = 0; i < 9; i++) bakeLine(line[i], line[i + 1], 0.05, STEEL);
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = B.R() * B.TAU, r = B.rr(58, 86);
      bakeTower(frameOf(Math.sin(a) * r, Math.cos(a) * r, B.R() * 3), B.rr(0.85, 1.25), 3.4);
    }
    // lights of a grid that goes on past the horizon
    for (let i = 0; i < 46; i++) {
      const a = B.R() * B.TAU, r = B.rr(84, 92);
      B.iso(Math.sin(a) * r, B.rr(0.6, 5), Math.cos(a) * r, 0.2, B.P[B.R() < 0.7 ? 19 : RED], 3, { em: true, nd: true });
    }

    // ---- everything that moves ----
    const pool = K.pool(B, 2200);
    let game;
    const frame = K.frameSplats(B, 8200 + wreck.count, (draw, dt, t) => game.draw(draw, t));
    const W = B.finish({
      cam: { target: [0, 3, -6], dist: 9, pitch: -0.1, yaw: 0, fov: 1.1 },
      detail: 20,
      dither: 0.35,
      radius: 110,
      fog: { c: 5, start: 0.62, max: 0.5 },
      palName: 'Dusk grid'
    });
    const stage = K.stage(W);
    const ps = stage.add(K.particles(stage, pool, { ground: () => 0 }));
    stage.add(frame);

    // ---- simulation ----
    const ease = t => t * t * (3 - 2 * t), clamp01 = t => Math.min(1, Math.max(0, t));
    const span = (t, a, b) => clamp01((t - a) / (b - a));
    const turn = (v, axis, angle) => {
      const c = Math.cos(angle), s = Math.sin(angle), d = V.dot(axis, v) * (1 - c), x = V.cross(axis, v);
      return [v[0] * c + x[0] * s + axis[0] * d, v[1] * c + x[1] * s + axis[1] * d, v[2] * c + x[2] * s + axis[2] * d];
    };
    const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    // where a ray passes closest to a segment: [distance between them, distance along the ray]
    const rayToSegment = (o, d, a, b) => {
      const u = V.sub(b, a), w = V.sub(o, a), uu = V.dot(u, u), ud = V.dot(u, d), uw = V.dot(u, w), dw = V.dot(d, w);
      const den = uu - ud * ud;
      let s = den > 1e-9 ? clamp01((uw - ud * dw) / den) : 0;
      const t = Math.max(0, ud * s - dw);
      s = uu > 1e-9 ? clamp01((uw + t * ud) / uu) : 0;
      return [V.dist(V.mad(o, d, t), V.mad(a, u, s)), t];
    };

    const makeGame = intro => {
      const order = [0, 4, 6, 2, 7, 3, 1, 5];
      const makePylon = (k, x, z, heading) => ({
        k, state: 'dormant', t: 0, hp: 0, max: 0, x, z, heading, lift: 0, lean: 0, cut: 0,
        fall: 0, fallDir: [0, 0, 1], shudder: 0, flash: 0, cool: 0, wave: 0, attackLeg: 0, strikeFrom: null, strikeTo: null,
        vel: [0, 0], phase: k * 1.7,
        legs: hips.map(() => ({ out: 0, pole: -1, foot: [0, 0, 0], from: null, to: null, s: 1, pluck: 0, landed: false, hp: LEG_HP, broken: false, debris: null, cutT: 0 })),
        frame: null, lampsAt: [], hipsAt: [], knees: []
      });
      const pylons = Array.from({ length: RING }, (_, k) => {
        const [sx, cz, a] = ringAt(k);
        return makePylon(k, sx * RING_R, cz * RING_R, a + Math.PI);
      });
      // two that are already up and walking, busy with the stranger's car
      const rovers = [[-4.8, -25], [5.4, -20.5]].map(([x, z], r) =>
        Object.assign(makePylon(RING + r, x, z, Math.atan2(stranger.x - x, stranger.z - z)), { state: 'script', lift: LIFT, hp: 26, max: 26, wave: 1, rover: true }));
      pylons.push(...rovers);
      const g = {
        pylons, events: [], stage, time: 0, total: pylons.length,
        player: { x: 0, z: 0, yaw: 0, pitch: 0.05, hp: 100, bob: 0, hurt: 0, down: 0, dash: 0, dashDir: [0, 0], safe: 0, dodgeCool: 0, tool: 'gun', ammo: MAG, reserve: MAG * 4, reload: 0, heat: 0 },
        phase: 'intro', timer: 0, wave: 0, woken: 0, shake: 0, cooldown: 0, tracers: [], kills: 0, shots: 0,
        car: { z: 71, v: 7, look: 0, stage: 'drive', t: 0 }, cut: 0, stare: false, wreck: null, cutTarget: null,
        flash: 0, storm: { next: 1.5, bolts: [] }, smoke: 0, pickups: [], cutLeg: null, marks: [], mag: MAG
      };
      const say = (type, more) => g.events.push({ type, ...more });
      const near = p => 1 / (1 + Math.hypot(p[0] - g.player.x, p[2] - g.player.z) * 0.12);

      const pose = p => {
        // the tower's frame: heading, a forward lean, a shudder, and the topple when it dies
        const jx = p.shudder * Math.sin(g.time * 61 + p.phase), jz = p.shudder * Math.cos(g.time * 47 + p.phase);
        let f = frameOf(p.x + jx * 0.06, p.z + jz * 0.06, p.heading);
        f.o[1] = p.lift + Math.abs(jx) * 0.05;
        const tilt = p.lean + jz * 0.012;
        if (tilt) { const ax = f.x; f = { ...f, y: turn(f.y, ax, tilt), z: turn(f.z, ax, tilt) }; }
        if (p.fall) {
          const ax = V.norm(V.cross([0, 1, 0], p.fallDir));
          f = { o: f.o, x: turn(f.x, ax, p.fall), y: turn(f.y, ax, p.fall), z: turn(f.z, ax, p.fall) };
        }
        p.frame = f;
        p.lampsAt = lamps.map(l => place(f, l));
        p.hipsAt = hips.map(h => place(f, h));
        p.legs.forEach((leg, i) => {
          if (!leg.out) return;
          // two-bone reach from hip to foot, the knee thrown toward the leg's pole
          const hip = p.hipsAt[i];
          if (leg.broken) {
            // what is left of a shot-through leg: the upper truss, hanging outward from the hip
            const out = V.norm([hip[0] - f.o[0], 0, hip[2] - f.o[2]]);
            p.knees[i] = V.mad(hip, V.norm([out[0], -0.62, out[2]]), L1 * 0.8);
            leg.foot = p.knees[i].slice();
            return;
          }
          let d = V.sub(leg.foot, hip), len = V.len(d);
          if (len > REACH) { leg.foot = V.mad(hip, d, REACH / len); d = V.sub(leg.foot, hip); len = REACH; }
          const dir = V.mul(d, 1 / Math.max(len, 1e-6));
          const along = (L1 * L1 - L2 * L2 + len * len) / (2 * len), high = Math.sqrt(Math.max(0, L1 * L1 - along * along));
          const outward = V.norm([hip[0] - f.o[0], 0, hip[2] - f.o[2]]);
          let up = V.mad([0, 1, 0], outward, 0.25);
          up = V.norm(V.mad(up, dir, -V.dot(up, dir)));
          const side = V.cross(dir, up), a = leg.pole * Math.PI / 2;
          p.knees[i] = V.mad(V.mad(V.mad(hip, dir, along), up, high * Math.sin(a)), side, high * Math.cos(a) * (i % 2 ? 1 : -1));
        });
      };
      const home = (p, i, lead = 0, spread = 1) => {
        const [sx, sz] = corners[i], c = Math.cos(p.heading), s = Math.sin(p.heading), lx = sx * FOOT_R * 0.72 * spread, lz = sz * FOOT_R * 0.72 * spread;
        return [p.x + c * lx + s * lz + p.vel[0] * lead, 0, p.z - s * lx + c * lz + p.vel[1] * lead];
      };
      const thud = (at, size) => {
        ps.dust(at, Math.round(10 * size), [11, 10, 9], 1.6 * size);
        ps.chips(at, Math.round(5 * size), [9, 8, 10], null, 5);
        g.shake = Math.min(1.2, g.shake + 0.5 * size * near(at));
        say('stomp', { vol: size * near(at) });
      };

      const intact = p => p.legs.filter(leg => !leg.broken).length;
      const drop = (x, z, n) => g.pickups.push({ x, z, n, t: 0 });
      const fell = (p, dir, how) => {
        if (p.state === 'dying' || p.state === 'dead') return;
        Object.assign(p, { state: 'dying', t: 0, vel: [0, 0], shudder: 1, fallDir: V.norm([dir[0] + 1e-3, 0, dir[2]]) });
        g.kills++;
        for (const lamp of p.lampsAt) ps.sparks(lamp, 10, [22, RED_HOT, RED, RED_DIM], null, 6);
        ps.bolt(p.lampsAt[0], p.hipsAt[0], [ARC, 25]);
        // each one that falls leaves a box of rivets where it stood; a cut one, never having spent itself, leaves more
        drop(p.x - p.fallDir[0] * 2.2, p.z - p.fallDir[2] * 2.2, how === 'cut' ? 20 : 12);
        say(how === 'cut' ? 'felled' : 'kill', { vol: near([p.x, 0, p.z]) });
      };
      const breakLeg = (p, i, dir) => {
        const leg = p.legs[i], knee = p.knees[i] || p.hipsAt[i];
        if (leg.broken) return;
        Object.assign(leg, { broken: true, s: 1, hp: 0, debris: [[knee[0], 0.2, knee[2]], [leg.foot[0], 0.12, leg.foot[2]]] });
        ps.sparks(knee, 22, [ARC, 25, HOT], null, 7);
        ps.bolt(knee, p.hipsAt[i], [ARC, 25]);
        thud(leg.debris[0], 1.1);
        p.stagger = 1;
        if (p.attackLeg === i && (p.state === 'windup' || p.state === 'strike')) { p.state = 'recover'; p.t = 0; }
        say('legbreak', { vol: near(knee), left: intact(p) });
        // it can drag itself on two; on one it goes over
        if (intact(p) < 2) fell(p, dir, 'legs');
      };

      const wake = (p, wave) => {
        if (p.state !== 'dormant') return;
        Object.assign(p, { state: 'waking', t: 0, wave, hp: 20 + wave * 5, max: 20 + wave * 5 });
        g.woken++;
        if (g.phase === 'calm') g.phase = 'fight';
        p.legs.forEach((leg, i) => Object.assign(leg, { out: 0, pole: -1, foot: [...home(p, i)], s: 1, pluck: 0, landed: false }));
        for (const tip of [2, 3].map(i => place(p.frame, tips[i]))) {
          ps.sparks(tip, 14, [ARC, 25, HOT], null, 7);
          ps.bolt(tip, V.add(tip, [B.rr(-2, 2), -2.5, B.rr(-2, 2)]), [ARC, 25]);
        }
        say('wake', { vol: near([p.x, 0, p.z]) });
      };
      const hurtPlayer = amount => {
        const me = g.player;
        if (g.phase === 'lost' || g.phase === 'won' || g.phase === 'intro') return;
        if (me.safe > 0) return say('evade');
        me.hp = Math.max(0, me.hp - amount);
        me.hurt = 1;
        g.shake = 1.2;
        say('hurt');
        if (!me.hp) { g.phase = 'lost'; say('lose'); }
      };

      const stepPylon = (p, dt) => {
        const me = g.player, toMe = [me.x - p.x, me.z - p.z], dist = Math.hypot(...toMe);
        p.t += dt;
        p.flash = Math.max(0, p.flash - dt * 5);
        p.cool -= dt;
        if (p.state === 'dormant') p.shudder = Math.max(0, p.shudder - dt * 5);
        p.legs.forEach((leg, i) => { if (leg.broken && p.state !== 'dead' && Math.random() < dt * 1.2) ps.sparks(p.knees[i], 3, [ARC, 25], null, 3); });
        if (p.state === 'waking') {
          // legs scythe up out of the soil one after another, each foot plucks free and stamps, then the footings tear loose
          p.shudder = p.t < 2.2 ? 1 : Math.max(0, 1 - (p.t - 2.2) * 2);
          p.legs.forEach((leg, i) => {
            const start = 0.5 + i * 0.34, sweep = span(p.t, start, start + 0.6);
            if (p.t < start) return;
            if (!leg.out) { leg.out = 1; thud(V.lerp(p.hipsAt[i], home(p, i), 0.5), 0.7); }
            leg.pole = -1 + 2 * ease(sweep);
            const pluck = span(p.t, start + 0.55, start + 1.0), h = home(p, i);
            leg.foot = [h[0], -0.4 + 2.6 * Math.sin(Math.PI * pluck) + 0.4 * pluck, h[2]];
            if (pluck >= 1 && !leg.landed) { leg.landed = true; thud(h, 0.9); }
          });
          const rise = span(p.t, 2.1, 3.0);
          if (rise > 0 && p.lift === 0) {
            for (const [a] of footings) ps.chips(place(p.frame, a), 8, [9, 8, 7, 10], null, 6);
            thud([p.x, 0, p.z], 1.5);
            say('uproot', { vol: near([p.x, 0, p.z]) });
          }
          const back = 1 + 2.2 * Math.pow(rise - 1, 3) + 1.2 * Math.pow(rise - 1, 2); // overshoot, then settle
          p.lift = rise > 0 ? Math.max(0.001, LIFT * back) : 0;
          if (p.t > 3.3) { p.state = 'hunt'; p.t = 0; p.cool = 0.6; }
          return;
        }
        if (p.state === 'dying') {
          p.shudder = Math.max(0, 1 - p.t);
          p.lift = Math.max(0.05, p.lift - dt * 5 * p.t);
          const before = p.fall;
          p.fall = Math.min(1.5, 1.5 * Math.pow(span(p.t, 0.25, 1.7), 2.4));
          p.legs.forEach(leg => { leg.pole = Math.max(-0.2, leg.pole - dt * 0.9); });
          if (p.fall >= 1.5 && before < 1.5) {
            const top = place(p.frame, [0, TOWER_H, 0]);
            thud([top[0], 0, top[2]], 1.6);
            thud(V.lerp([p.x, 0, p.z], [top[0], 0, top[2]], 0.5), 1.2);
            ps.sparks([top[0], 0.4, top[2]], 20, [HOT, 23, RED], null, 6);
            p.state = 'dead';
          }
          return;
        }
        if (p.state !== 'hunt' && p.state !== 'windup' && p.state !== 'strike' && p.state !== 'recover') return;

        const want = Math.atan2(toMe[0], toMe[1]);
        let dh = want - p.heading;
        dh -= Math.round(dh / B.TAU) * B.TAU;
        p.heading += Math.max(-1.1 * dt, Math.min(1.1 * dt, dh));
        const bob = Math.sin(g.time * 3.1 + p.phase), lost = 4 - intact(p);
        p.lift += (LIFT - 0.55 * lost + 0.18 * bob - p.lift) * Math.min(1, dt * 4);
        p.stagger = Math.max(0, (p.stagger || 0) - dt);

        if (p.state === 'hunt') {
          // a leg down and it limps; two down and it drags
          const speed = (2.5 + p.wave * 0.35) * (dist > 7.6 ? 1 : dist < 6.2 ? -0.5 : 0) * [1, 0.6, 0.32][lost] * (p.stagger > 0 ? 0 : 1);
          if (p.stagger > 0) p.shudder = p.stagger;
          else if (p.shudder) p.shudder = 0;
          p.vel = [toMe[0] / dist * speed, toMe[1] / dist * speed];
          for (const q of pylons) {
            if (q === p || q.state === 'dormant' || q.state === 'dead' || q.state === 'dying') continue;
            const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
            if (d < 9 && d > 0.01) { p.vel[0] += dx / d * (9 - d) * 0.6; p.vel[1] += dz / d * (9 - d) * 0.6; }
          }
          p.x += p.vel[0] * dt;
          p.z += p.vel[1] * dt;
          p.lean += (0.1 * Math.sign(speed) + 0.07 * lost - p.lean) * Math.min(1, dt * 3);
          // gait: a foot left too far behind its place swings forward, never two neighbours at once
          p.legs.forEach((leg, i) => {
            if (leg.broken) return;
            if (leg.s < 1) {
              leg.s = Math.min(1, leg.s + dt / 0.36);
              const e = ease(leg.s);
              leg.foot = V.lerp(leg.from, leg.to, e);
              leg.foot[1] = 1.7 * Math.sin(Math.PI * e);
              if (leg.s >= 1) thud(leg.to, 0.55);
            } else if (flat(leg.foot, home(p, i, 0.35)) > 2.3 && p.legs[(i + 1) % 4].s >= 1 && p.legs[(i + 3) % 4].s >= 1) {
              leg.from = leg.foot.slice();
              leg.to = home(p, i, 0.55);
              leg.s = 0;
            }
          });
          if (dist < 9.6 && p.cool <= 0 && p.stagger <= 0 && p.legs.every(leg => leg.s >= 1) && g.phase !== 'lost') {
            const mine = [me.x, 0, me.z], able = [0, 1, 2, 3].filter(i => !p.legs[i].broken), front = able.filter(i => i < 2);
            p.attackLeg = (front.length ? front : able).reduce((a, b) => (flat(p.legs[a].foot, mine) < flat(p.legs[b].foot, mine) ? a : b));
            p.strikeFrom = p.legs[p.attackLeg].foot.slice();
            p.state = 'windup';
            p.t = 0;
            p.vel = [0, 0];
            say('windup', { vol: near([p.x, 0, p.z]) });
          }
          return;
        }
        const leg = p.legs[p.attackLeg], hip = p.hipsAt[p.attackLeg];
        const within = target => {
          const d = V.sub(target, hip), len = V.len(d);
          return len > REACH * 0.98 ? V.mad(hip, d, REACH * 0.98 / len) : target;
        };
        if (p.state === 'windup') {
          // the leg rears up over you; where it will land is fixed only as it starts down
          const wind = 0.85 - p.wave * 0.05;
          const apex = within([p.x + toMe[0] / dist * 3.5, 8.5, p.z + toMe[1] / dist * 3.5]);
          leg.foot = V.lerp(p.strikeFrom, apex, ease(span(p.t, 0, wind * 0.7)));
          p.lean = -0.12 * ease(span(p.t, 0, wind));
          if (p.t >= wind) {
            p.strikeFrom = leg.foot.slice();
            p.strikeTo = within([me.x, 0, me.z]);
            p.strikeTo[1] = 0;
            p.state = 'strike';
            p.t = 0;
          }
        } else if (p.state === 'strike') {
          const s = span(p.t, 0, 0.13);
          leg.foot = V.lerp(p.strikeFrom, p.strikeTo, s * s);
          p.lean = -0.12 + 0.3 * s;
          if (s >= 1) {
            thud(p.strikeTo, 1.4);
            ps.ring(p.strikeTo, 2.2, [12, 11, 10], 28, 0.35);
            if (flat(p.strikeTo, [me.x, 0, me.z]) < 1.75) hurtPlayer(22);
            p.state = 'recover';
            p.t = 0;
          }
        } else if (p.t > 0.55) {
          p.state = 'hunt';
          p.t = 0;
          p.cool = 1.5 - p.wave * 0.15;
        }
      };

      const fire = () => {
        const me = g.player, eye = g.eye(), aim = g.forward();
        const wild = 0.004 + 0.02 * me.heat;
        const fwd = V.norm([aim[0] + B.gauss() * wild, aim[1] + B.gauss() * wild, aim[2] + B.gauss() * wild]);
        me.heat = Math.min(1, me.heat + 0.16);
        let best = fwd[1] < -1e-3 ? -eye[1] / fwd[1] : 120, hit = null;
        const test = (p, part, a, b, r, leg) => {
          const [d, t] = rayToSegment(eye, fwd, a, b);
          if (d < r && t < best && t > 0.5) { best = t; hit = { p, part, leg }; }
        };
        for (const p of pylons) {
          if (p.state === 'dead' || !p.frame) continue;
          const f = p.frame;
          test(p, 'body', place(f, [0, 0, 0]), place(f, [0, 3.2, 0]), 1.0);
          test(p, 'body', place(f, [0, 3.2, 0]), place(f, [0, 6.4, 0]), 0.68);
          test(p, 'body', place(f, [0, 6.4, 0]), place(f, [0, TOWER_H, 0]), 0.42);
          for (const [y, sp] of arms) test(p, 'body', place(f, [-sp, y + 0.3, 0]), place(f, [sp, y + 0.3, 0]), 0.32);
          p.legs.forEach((leg, i) => {
            if (!leg.out || !p.knees[i]) return;
            test(p, 'leg', p.hipsAt[i], p.knees[i], 0.34, i);
            if (!leg.broken) test(p, 'leg', p.knees[i], leg.foot, 0.34, i);
          });
          for (const lamp of p.lampsAt) test(p, 'lamp', lamp, lamp, 0.42);
        }
        const end = V.mad(eye, fwd, best), right = V.norm(V.cross(aim, [0, 1, 0]));
        const muzzle = V.mad(V.mad(V.mad(eye, aim, 0.9), right, 0.28), [0, 1, 0], -0.22);
        g.tracers.push({ a: muzzle, b: end, life: 0.06 });
        g.shots++;
        say('shot');
        if (!hit) {
          if (best < 120) ps.dust(end, 4, [11, 10], 0.8);
          return;
        }
        const { p, part } = hit, back = V.mul(fwd, -0.5);
        if (p.state === 'dormant') {
          ps.sparks(end, 5, [HOT, 23], back, 4);
          say('ping', { vol: near(end) });
          if (g.phase !== 'won' && g.phase !== 'lost') wake(p, Math.max(1, g.wave));
          return;
        }
        const crit = part === 'lamp';
        ps.sparks(end, crit ? 16 : 6, crit ? [22, RED_HOT, RED] : [HOT, 23, RED_DIM], back, crit ? 7 : 4.5);
        say(crit ? 'crit' : 'ping', { vol: near(end) });
        if (p.state === 'dying') return;
        p.flash = 1;
        const leg = part === 'leg' ? p.legs[hit.leg] : null;
        if (leg && !leg.broken && p.state !== 'waking') {
          // rivets through a leg mostly hurt the leg
          leg.hp -= 1;
          p.hp -= 0.25;
          if (leg.hp <= 0) breakLeg(p, hit.leg, fwd);
        } else p.hp -= (crit ? 3 : 0.8) * (p.state === 'waking' ? 0.5 : 1);
        if (p.hp <= 0) fell(p, fwd, 'shot');
      };

      // Bolt cutters: stand at a rooted pylon's feet and hold to shear its four legs. It falls without ever waking,
      // but the one nearest you feels it go and comes up angry.
      const cutters = (dt, held) => {
        const me = g.player, look = g.forward();
        let best = ROOT_REACH;
        for (const p of pylons) {
          const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
          if (p.state === 'dormant' && d < best && (dx * look[0] + dz * look[2]) / d > 0.35) { best = d; g.cutTarget = p; }
        }
        const p = g.cutTarget;
        if (!p) {
          // nothing rooted in reach: a walking one's planted foot will do. Half a second under it takes the leg off.
          let reach = CUT_REACH;
          for (const q of pylons) {
            if (!['hunt', 'windup', 'strike', 'recover'].includes(q.state)) continue;
            q.legs.forEach((leg, i) => {
              const dx = leg.foot[0] - me.x, dz = leg.foot[2] - me.z, d = Math.hypot(dx, dz);
              if (!leg.broken && leg.foot[1] < 0.9 && d < reach && (dx * look[0] + dz * look[2]) / Math.max(d, 0.01) > 0.2) { reach = d; g.cutLeg = { p: q, i, leg }; }
            });
          }
          const grip = g.cutLeg;
          if (grip && held) {
            const before = grip.leg.cutT;
            grip.leg.cutT += dt / 0.5;
            if (before === 0) say('snip', { n: 0 });
            if (grip.leg.cutT >= 1) { breakLeg(grip.p, grip.i, look); g.cutLeg = null; }
          }
          return;
        }
        if (!held) return;
        const before = Math.floor(p.cut * 4);
        p.cut = Math.min(1, p.cut + dt / 2.6);
        p.shudder = 0.8;
        const leg = Math.min(3, Math.floor(p.cut * 4));
        if (leg !== before || p.cut >= 1) {
          const at = place(p.frame, [footings[before % 4][0][0], 0.35, footings[before % 4][0][2]]);
          ps.sparks(at, 12, [HOT, 23, RED], null, 5);
          say('snip', { n: before + 1 });
        }
        if (p.cut < 1) return;
        fell(p, [p.x - me.x, 0, p.z - me.z], 'cut');
        g.cutTarget = null;
        const angry = pylons.filter(q => q.state === 'dormant').sort((a, b) => flat([a.x, 0, a.z], [me.x, 0, me.z]) - flat([b.x, 0, b.z], [me.x, 0, me.z]))[0];
        if (angry) { wake(angry, Math.max(1, g.wave)); say('angry'); }
      };

      // Dry lightning: forked strikes out past the far grid, lighting the cloud above them.
      const stepStorm = dt => {
        const storm = g.storm;
        for (const bolt of storm.bolts) bolt.life -= dt;
        storm.bolts = storm.bolts.filter(bolt => bolt.life > 0);
        if ((storm.next -= dt) > 0) return;
        storm.next = 1.2 + Math.random() * 5 + (Math.random() < 0.3 ? 0 : 1.5);
        const a = Math.random() * B.TAU, r = 62 + Math.random() * 22, rnd = k => (Math.random() - 0.5) * k;
        const fork = (from, to, n, jag) => Array.from({ length: n + 1 }, (_, i) => {
          const q = V.lerp(from, to, i / n), k = i && i < n ? jag : 0;
          return [q[0] + rnd(k), q[1] + rnd(k * 0.5), q[2] + rnd(k)];
        });
        const top = [Math.sin(a) * r, 46 + Math.random() * 14, Math.cos(a) * r], foot = [top[0] + rnd(20), 0, top[2] + rnd(20)];
        const main = fork(top, foot, 12, 5), branches = [];
        for (let b = 0; b < 1 + Math.floor(Math.random() * 3); b++) {
          const from = main[2 + Math.floor(Math.random() * 7)];
          branches.push(fork(from, [from[0] + rnd(26), from[1] - 6 - Math.random() * 14, from[2] + rnd(26)], 5, 3));
        }
        storm.bolts.push({ main, branches, top, life: 0.42, seed: Math.random() * 9 });
        g.flash = 1;
        say('thunder', { delay: 0.4 + r / 60, vol: 1.3 - r / 90 });
      };

      // The opening, seen from the driver's seat. The car and the two rovers are moved by hand here.
      const [leaper, other] = rovers;
      const beginPlay = wreckZ => {
        const me = g.player, z = Math.max(6, Math.min(14, wreckZ));
        g.wreck = { x: 0.3, z, yaw: 0.4, at: [0.3, hill(z) + 0.04, z] };
        Object.assign(me, { x: 2.9, z: z + 2.4, yaw: 0.25, pitch: 0.1 });
        Object.assign(leaper, { state: 'hunt', t: 0, cool: 3.2, x: -3.5, z: z - 15, lift: LIFT, lean: 0, vel: [0, 0] });
        Object.assign(other, { state: 'hunt', t: 0, cool: 1, lean: 0 });
        for (const p of rovers) {
          p.heading = Math.atan2(me.x - p.x, me.z - p.z);
          p.legs.forEach((leg, i) => Object.assign(leg, { out: 1, pole: 1, foot: home(p, i), s: 1 }));
        }
        // rivets: a box thrown clear of your car, and whatever the stranger had in the boot
        drop(g.wreck.x - 2.3, z + 1.2, MAG);
        drop(stranger.x + Math.sin(stranger.yaw) * 3.1, stranger.z + Math.cos(stranger.yaw) * 3.1, MAG * 2);
        g.phase = 'fight';
        g.stare = false;
        g.shake = 1;
        say('begin');
      };
      g.skip = () => { if (g.phase === 'intro') beginPlay(10); };
      const stepIntro = dt => {
        const car = g.car, me = g.player, T = (g.cut += dt);
        car.t += dt;
        me.x = -0.38;
        me.z = car.z;
        const roofAt = [stranger.x, hill(stranger.z) + 1.0, stranger.z];
        rovers.forEach((p, r) => {
          p.legs.forEach((leg, i) => { if (!leg.out) Object.assign(leg, { out: 1, pole: 1, foot: home(p, i), s: 1 }); });
          if (car.stage !== 'drive' || p.state !== 'script') return;
          // taking the stranger's car apart: a front leg rears, slams the roof, draws back
          const u = (T + r * 0.6) / 1.2 % 1, leg = p.legs[r], rest = home(p, r), high = V.add(V.lerp(rest, roofAt, 0.7), [0, 6, 0]);
          leg.foot = u < 0.55 ? V.lerp(rest, high, ease(u / 0.55)) : u < 0.66 ? V.lerp(high, roofAt, ((u - 0.55) / 0.11) ** 2) : V.lerp(roofAt, rest, ease((u - 0.66) / 0.34));
          p.lean = u > 0.55 && u < 0.75 ? 0.14 : -0.05;
          if (u >= 0.66 && leg.hit !== Math.floor((T + r * 0.6) / 1.2)) {
            leg.hit = Math.floor((T + r * 0.6) / 1.2);
            ps.sparks(roofAt, 14, [HOT, 23, RED], null, 6);
            ps.chips(roofAt, 4, [34, 33, 15], null, 5);
            say('clang', { vol: near(roofAt) });
          }
        });
        if (car.stage === 'drive') {
          // over the crest and down, braking hard once the road ahead makes sense
          car.v = Math.min(car.v + 4 * dt, 12.5, Math.sqrt(Math.max(0, 2 * 8 * (car.z - 3))) + 0.2);
          car.z -= car.v * dt;
          if (car.z < HILL_Z - 6 && !car.seen) { car.seen = true; say('caption', { text: 'What is that on the road' }); }
          if (car.z <= 3.05) { Object.assign(car, { stage: 'stare', t: 0, v: 0 }); say('brake'); }
        } else if (car.stage === 'stare') {
          // they stop. They turn. Then every lamp in the field comes on at once.
          for (const p of rovers) {
            let dh = Math.atan2(me.x - p.x, me.z - p.z) - p.heading;
            dh -= Math.round(dh / B.TAU) * B.TAU;
            p.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
            p.lean += (0 - p.lean) * Math.min(1, dt * 4);
            p.legs.forEach((leg, i) => { leg.foot = V.lerp(leg.foot, home(p, i), Math.min(1, dt * 5)); });
          }
          if (car.t > 1.3 && !g.stare) { g.stare = true; say('stare'); say('caption', { text: 'They are all looking at you' }); }
          car.look = 0.55 * Math.sin(Math.max(0, car.t - 1.6) * 2.4) * Math.min(1, Math.max(0, 3.6 - car.t));
          if (car.t > 3.6) { Object.assign(car, { stage: 'flee', t: 0, look: 0 }); say('reverse'); say('caption', { text: 'Go go go' }); }
        } else if (car.stage === 'flee') {
          car.v = Math.max(-9, car.v - 3.4 * dt);
          car.z -= car.v * dt;
          if (other.state === 'script') Object.assign(other, { state: 'hunt', t: 0, cool: 9 });
          // one drops low, then comes through the air at the windscreen
          const s = Math.min(1, Math.max(0, (car.t - 0.7) / 1.7));
          if (car.t < 0.7) leaper.lift = LIFT - 1.1 * ease(car.t / 0.7);
          else {
            leaper.from ??= [leaper.x, leaper.z];
            if (!leaper.leapt) { leaper.leapt = true; thud([leaper.x, 0, leaper.z], 1.4); say('leap'); }
            leaper.x = leaper.from[0] + (-0.2 - leaper.from[0]) * s;
            leaper.z = leaper.from[1] + (car.z - 3.2 - leaper.from[1]) * s;
            leaper.lift = 0.8 + (hill(leaper.z) + 0.6 - 0.8) * s + 46 * s * (1 - s);
            leaper.lean = 0.5 * s;
          }
          leaper.heading = Math.atan2(me.x - leaper.x, me.z - leaper.z);
          leaper.legs.forEach((leg, i) => { leg.foot = home(leaper, i, 0, 1 - 0.45 * Math.sin(Math.PI * s)); leg.foot[1] = Math.max(0, leaper.lift - LIFT) * (i < 2 ? 0.85 : 1.1); });
          if (s >= 1) {
            g.shake = 1.2;
            g.flash = 1;
            ps.sparks([0, hill(car.z) + 1, car.z - 2], 30, [HOT, 23, 22], null, 8);
            Object.assign(car, { stage: 'black', t: 0, v: 0 });
            say('crash');
          }
        } else if (car.t > 2.6) beginPlay(car.z);
      };

      g.forward = () => {
        const { yaw, pitch } = g.player;
        return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      };
      g.eye = () => {
        const me = g.player, duck = me.dash > 0 ? 0.4 * Math.sin(Math.PI * me.dash / 0.24) : 0;
        if (g.phase === 'intro') return [-0.38, hill(g.car.z) + 1.24 + 0.012 * Math.sin(g.time * 23) * Math.min(1, Math.abs(g.car.v) / 6), g.car.z];
        return [me.x, hill(me.z) + EYE + 0.05 * Math.sin(me.bob) - duck - 1.25 * ease(me.down), me.z];
      };
      // The renderer's camera orbits a target, so look from the eye by placing the target a short way down the line of sight.
      g.camera = () => {
        const me = g.player, k = g.shake * g.shake, t = g.time, driving = g.phase === 'intro';
        // behind the wheel the view follows the road's slope and the driver's glances
        const slope = Math.atan((hill(g.car.z - 1.5) - hill(g.car.z + 1.5)) / 3);
        const yaw = (driving ? g.car.look : me.yaw) + 0.02 * k * Math.sin(t * 71);
        const pitch = (driving ? slope * 0.8 + 0.03 : me.pitch) + 0.02 * k * Math.sin(t * 93 + 1) - 0.5 * ease(me.down);
        const eye = g.eye(), fwd = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
        return { target: V.mad(eye, fwd, 2.6), dist: 2.6, yaw, pitch: -pitch, fov: 1.12 + (me.dash > 0 ? 0.14 * Math.sin(Math.PI * me.dash / 0.24) : 0) };
      };
      // where a point in the world falls on the screen, as fractions of its width and height; null when behind you
      g.screen = (at, aspect) => {
        const cam = g.camera(), pitch = -cam.pitch, eye = g.eye();
        const f = [-Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(cam.yaw) * Math.cos(pitch)];
        const r = V.norm(V.cross(f, [0, 1, 0])), u = V.cross(r, f), d = V.sub(at, eye), z = V.dot(d, f), k = Math.tan(cam.fov / 2);
        return z < 0.4 ? null : [0.5 + V.dot(d, r) / (z * k * aspect) / 2, 0.5 - V.dot(d, u) / (z * k) / 2];
      };
      g.step = (dt, input) => {
        const me = g.player;
        g.time += dt;
        g.shake = Math.max(0, g.shake - dt * 2.2);
        me.hurt = Math.max(0, me.hurt - dt * 1.6);
        g.cooldown -= dt;
        g.flash = Math.max(0, g.flash - dt * 4.5);
        stepStorm(dt);
        g.cutTarget = null;
        g.cutLeg = null;
        if (g.phase === 'intro') stepIntro(dt);
        else if (g.phase === 'lost') me.down = Math.min(1, me.down + dt * 1.4);
        else {
          me.yaw = input.yaw;
          me.pitch = input.pitch;
          me.tool = input.tool || 'gun';
          me.safe -= dt;
          me.dodgeCool -= dt;
          const speed = input.sprint ? 7.4 : 5, len = Math.hypot(input.mx, input.mz);
          const c = Math.cos(me.yaw), s = Math.sin(me.yaw), ax = len > 0 ? input.mx / len : 0, az = len > 0 ? input.mz / len : -1;
          // dodge: a short lunge the way you are moving (or straight back), untouchable until just after it ends
          if (input.dodge && me.dodgeCool <= 0) {
            Object.assign(me, { dash: 0.24, safe: 0.4, dodgeCool: 0.8, dashDir: [c * ax - s * az, -s * ax - c * az] });
            say('dodge');
          }
          if (me.dash > 0) {
            me.dash -= dt;
            me.x += me.dashDir[0] * 21 * dt;
            me.z += me.dashDir[1] * 21 * dt;
          } else if (len > 0) {
            me.x += (c * ax - s * az) * speed * dt;
            me.z += (-s * ax - c * az) * speed * dt;
            me.bob += dt * speed * 2.1;
          }
          const r = Math.hypot(me.x, me.z + 2);
          if (r > ARENA) { me.x *= ARENA / r; me.z = (me.z + 2) * ARENA / r - 2; }
          const clear = (x, z, keep) => {
            const dx = me.x - x, dz = me.z - z, d = Math.hypot(dx, dz);
            if (d < keep && d > 1e-3) { me.x = x + dx / d * keep; me.z = z + dz / d * keep; }
          };
          for (const p of pylons) if (p.state !== 'dead') clear(p.x, p.z, 1.7);
          if (g.wreck) clear(g.wreck.x, g.wreck.z, 1.9);
          clear(stranger.x, stranger.z, 1.9);
          me.heat = Math.max(0, me.heat - dt * 1.6);
          if (me.tool !== 'gun') me.reload = 0;
          if (me.reload > 0 && (me.reload -= dt) <= 0) {
            const n = Math.min(MAG - me.ammo, me.reserve);
            me.ammo += n;
            me.reserve -= n;
            me.reload = 0;
            say('reloaded');
          }
          if (me.tool === 'cutters') cutters(dt, input.fire);
          else if (me.reload <= 0) {
            if ((input.reload || (input.fire && !me.ammo)) && me.ammo < MAG && me.reserve > 0) { me.reload = 1.5; say('reload'); }
            else if (input.fire && g.cooldown <= 0) {
              if (me.ammo) { me.ammo--; g.cooldown = 0.085; fire(); }
              else { g.cooldown = 0.35; say('dry'); }
            }
          }
          // What the cutters could bite, for the page to point at: every intact leg of anything walking nearby and the feet
          // of anything still rooted, each marked as in reach or not.
          g.marks = [];
          if (me.tool === 'cutters') {
            for (const p of pylons) {
              const d = Math.hypot(p.x - me.x, p.z - me.z);
              if (p.state === 'dormant' && d < 16) g.marks.push({ at: [p.x, hill(p.z) + 1.3, p.z], kind: 'root', near: d < ROOT_REACH, active: g.cutTarget === p, progress: p.cut });
              if (!['hunt', 'windup', 'strike', 'recover'].includes(p.state)) continue;
              p.legs.forEach(leg => {
                const reach = Math.hypot(leg.foot[0] - me.x, leg.foot[2] - me.z), planted = leg.foot[1] < 0.9;
                if (!leg.broken && reach < 18) g.marks.push({ at: [leg.foot[0], leg.foot[1] + 1, leg.foot[2]], kind: 'leg', planted, near: planted && reach < CUT_REACH, active: g.cutLeg?.leg === leg, progress: leg.cutT, reach });
              });
            }
          }
          for (const box of g.pickups) {
            box.t += dt;
            if (Math.hypot(box.x - me.x, box.z - me.z) < 1.5) { me.reserve += box.n; box.n = 0; say('ammo', { n: 1 }); }
          }
          g.pickups = g.pickups.filter(box => box.n > 0);
          // the wreck smoulders
          if (g.wreck && (g.smoke -= dt) <= 0) {
            g.smoke = 0.3;
            ps.smoke(V.add(g.wreck.at, [Math.sin(g.wreck.yaw) * -1.5, 0.9, Math.cos(g.wreck.yaw) * -1.5]), 1, [16, 15, 14]);
          }
        }
        for (const p of pylons) stepPylon(p, dt);
        for (const p of pylons) pose(p);
        for (const tr of g.tracers) tr.life -= dt;
        g.tracers = g.tracers.filter(tr => tr.life > 0);

        // waves: a quiet spell, then the next few pylons wake; the fight lasts until they are all down
        if (g.phase === 'calm') {
          g.timer -= dt;
          if (g.timer <= 0) {
            const count = WAVES[g.wave++] ?? 3;
            g.phase = 'fight';
            say('wave', { n: g.wave, of: WAVES.length });
            order.map(k => pylons[k]).filter(p => p.state === 'dormant').slice(0, count).forEach(p => wake(p, g.wave));
          }
        } else if (g.phase === 'fight' && pylons.every(p => p.state === 'dormant' || p.state === 'dead')) {
          if (pylons.every(p => p.state === 'dead')) { g.phase = 'won'; say('win'); }
          else {
            g.phase = 'calm';
            g.timer = 10;
            me.hp = Math.min(100, me.hp + 30);
            say('lull', { n: g.wave });
          }
        }
      };

      g.draw = (draw, t) => {
        const line = (a, b, width, color, emissive = false, density = 4) => {
          // nothing below the soil is drawn, so buried legs and footings stay hidden without relying on the ground to cover them
          if (a[1] < 0 && b[1] < 0) return;
          if (a[1] < 0) a = V.lerp(a, b, a[1] / (a[1] - b[1]));
          else if (b[1] < 0) b = V.lerp(b, a, b[1] / (b[1] - a[1]));
          const m = V.lerp(a, b, 0.5);
          draw.streak(V.lerp(m, a, SHRINK), V.lerp(m, b, SHRINK), { width, color, density, emissive, depth: true });
        };
        const lamp = (at, on, hot) => {
          // one solid globe: deep red, brighter red when it is angry, simply dark when off
          if (on < 0.5) return;
          draw.point(at, { width: 0.2, color: hot ? RED : 19, density: 8, emissive: true });
        };
        const truss = (a, b, pole, color, fat) => {
          // a spindle of two rails bowed apart at the middle, laced across
          const axis = V.norm(V.sub(b, a)), n = V.norm(V.mad(pole, axis, -V.dot(pole, axis))), mid = V.lerp(a, b, 0.5), e = 0.24 * fat;
          const rail = s => [a, V.mad(V.lerp(a, mid, 0.5), n, s * e * 0.7), V.mad(mid, n, s * e), V.mad(V.lerp(mid, b, 0.5), n, s * e * 0.7), b];
          const top = rail(1), under = rail(-1);
          for (let i = 0; i < 4; i++) {
            line(top[i], top[i + 1], 0.065 * fat, color);
            line(under[i], under[i + 1], 0.065 * fat, color);
          }
          for (let i = 1; i < 4; i++) {
            line(top[i], under[i], 0.04, color);
            line(top[i], under[i + (i < 2 ? 1 : -1)], 0.04, color);
          }
        };

        // lightning first: a hard stroke for a few frames, then a stutter
        for (const bolt of g.storm.bolts) {
          const age = 1 - bolt.life / 0.42, lit = age < 0.22 || Math.sin(t * 70 + bolt.seed) > 0.1;
          if (!lit) continue;
          const stroke = (pts, width, color) => { for (let i = 0; i + 1 < pts.length; i++) draw.streak(pts[i], pts[i + 1], { width, color, density: 9, emissive: true }); };
          stroke(bolt.main, 0.5, ARC);
          for (const branch of bolt.branches) stroke(branch, 0.3, ARC);
          draw.point(bolt.top, { width: 15, color: 5, density: 0.5, emissive: true });
          draw.point(V.add(bolt.top, [0, -5, 0]), { width: 7, color: 6, density: 0.6, emissive: true });
        }
        if (g.wreck) {
          const w = g.wreck, c = Math.cos(w.yaw), s = Math.sin(w.yaw), spot = q => [w.at[0] + c * q[0] + s * q[2], w.at[1] + q[1], w.at[2] - s * q[0] + c * q[2]];
          draw.model(wreck, w.at, { matrix: [c, 0, s, 0, 1, 0, -s, 0, c] });
          if (Math.sin(t * 31) + Math.sin(t * 7.3) > 0.2) draw.point(spot(wreckLamps.head[0]), { width: 0.07, color: HOT, density: 4, emissive: true });
          for (const lamp of wreckLamps.tail) draw.point(spot(lamp), { width: 0.05, color: RED, density: 4, emissive: true });
        }
        // the stranger's hazards are still going
        if (t % 0.9 < 0.45) for (const lamp of strangerLamps.tail) draw.point(lamp, { width: 0.07, color: 23, density: 4, emissive: true });
        draw.point(strangerLamps.head[1], { width: 0.08, color: HOT, density: 4, emissive: true });

        for (const p of pylons) {
          if (!p.frame) pose(p);
          const f = p.frame, alive = p.state !== 'dead' && p.state !== 'dying', color = p.flash > 0.5 ? STEEL_LIT : STEEL;
          for (const [a, b, w] of struts) line(place(f, a), place(f, b), w, color);
          if (p.lift > 0) for (const [a, b, w] of footings) line(place(f, a), place(f, b), w, 9);
          p.legs.forEach((leg, i) => {
            if (!leg.out || !p.knees[i]) return;
            const hip = p.hipsAt[i], knee = p.knees[i], pole = leg.broken ? [0, 1, 0.01] : V.sub(knee, V.lerp(hip, leg.foot, 0.5));
            if (leg.debris) truss(leg.debris[0], leg.debris[1], [0, 1, 0.01], STEEL, 0.9);
            truss(hip, knee, pole, color, 1.15);
            if (leg.broken) return;
            truss(knee, leg.foot, pole, color, 0.9);
            line(leg.foot, V.mad(leg.foot, V.norm(V.sub(leg.foot, knee)), -0.9), 0.1, color);
            lamp(knee, alive ? 0.7 : 0, false);
          });
          // lamps: a slow wink while rooted, a hard strobe as a leg rears to strike, dark once dead
          let on = 0;
          if (p.state === 'dormant') on = g.stare || Math.sin(t * 1.6 + p.phase) > -0.55 ? 1 : 0;
          else if (p.state === 'waking') on = Math.sin(t * 38 + p.phase) > 0 ? 1 : 0.15;
          else if (p.state === 'windup') on = Math.sin(t * 46) > 0 ? 1 : 0;
          else if (p.state === 'dying') on = Math.sin(t * 55 + p.phase) > p.t - 0.6 ? 1 : 0;
          else if (alive) on = 1;
          p.lampsAt.forEach(at => lamp(at, on, p.state === 'windup' || p.flash > 0 || (g.stare && alive)));
        }
        // wires hang between neighbours, and out to the far grid, for as long as both ends stay rooted
        pylons.forEach((p, k) => {
          if (p.state !== 'dormant') return;
          const q = pylons[(k + 1) % RING];
          if (k >= RING) return;
          tips.forEach((tip, i) => {
            if (q.state === 'dormant') {
              const pts = sag(place(p.frame, tips[i ^ 1]), place(q.frame, tip), 1.5, 8);
              for (let j = 0; j < 8; j++) line(pts[j], pts[j + 1], 0.024, STEEL);
            }
            if (i > 1) {
              const pts = sag(place(p.frame, tip), place(farFrames[k], tip), 2.4, 8);
              for (let j = 0; j < 8; j++) line(pts[j], pts[j + 1], 0.026, STEEL);
            }
          });
        });
        // rivet boxes: a small crate with a blinking tag
        for (const box of g.pickups) {
          const y = hill(box.z), s = 0.22, c = [[-s, -s], [s, -s], [s, s], [-s, s]];
          c.forEach(([x, z], k) => {
            const [nx, nz] = c[(k + 1) % 4];
            draw.streak([box.x + x, y + 0.36, box.z + z], [box.x + nx, y + 0.36, box.z + nz], { width: 0.045, color: 23, density: 5, emissive: true });
            draw.streak([box.x + x, y + 0.05, box.z + z], [box.x + x, y + 0.36, box.z + z], { width: 0.045, color: 12, density: 5, emissive: false, depth: true });
          });
          draw.point([box.x, y + 0.2, box.z], { width: 0.19, color: 11, density: 6, emissive: false, depth: true });
          if (box.t % 0.8 < 0.5) draw.point([box.x, y + 0.75 + 0.06 * Math.sin(box.t * 4), box.z], { width: 0.07, color: HOT, density: 8, emissive: true });
        }
        farLamps.forEach((at, i) => Math.sin(t * 1.3 + i * 2.4) > -0.6 && draw.point(at, { width: 0.24, color: 19, density: 6, emissive: true }));
        for (const tr of g.tracers) draw.streak(tr.a, tr.b, { width: 0.035, color: HOT, density: 3, emissive: true });
      };
      for (const p of pylons) pose(p);
      return g;
    };

    game = makeGame();
    W.game = game;
    // start again; pass false to skip the drive in and wake beside the wreck
    W.restart = (intro = true) => {
      game = makeGame();
      W.game = game;
      if (!intro) game.skip();
      return game;
    };
    return W;
  }
});
