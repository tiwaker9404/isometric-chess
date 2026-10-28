// iso.js: a tiny isometric (2:1 dimetric) renderer for a chess board, written from scratch.
// Everything is plain SVG. Round pieces are "lathed" from radius profiles, the knight is an
// extruded silhouette, crowns and crosses are boxes. No dependencies, runs in Node and browsers.

export const W = 96;                          // on-screen width of one tile
export const ZK = 62;                         // pixels per tile-unit of height
const HW = W / 2, QW = W / 4;
const EX = W * Math.SQRT1_2, EY = EX / 2;     // ellipse radii (px) for a circle of radius 1 tile

export const PAL = {
  bg: '#dfe7ea', frame: '#27363f', frameSide: ['#1b2830', '#141e25'],
  light: '#e6eadf', dark: '#5b7f7a', accent: '#d6336c', last: '#f2b01e',
  w: { hi: '#fffaf0', mid: '#ebe1ca', lo: '#a89a7c', top: '#faf3e3' },
  b: { hi: '#5a7188', mid: '#2e4054', lo: '#0e1721', top: '#40566b' },
};

// --- projection -------------------------------------------------------------------------
export const proj = (x, y, z = 0) => [(x - y) * HW, (x + y) * QW - z * ZK];
const P = (x, y, z) => proj(x, y, z).map(n => n.toFixed(1)).join(',');
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(p => P(...p)).join(' ')}" fill="${fill}" ${extra}/>`;

// board square -> world centre. a1 is the dark corner nearest the viewer, White sits on the lower-right edge.
export function sqToXY(sq) {
  const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
  return { x: 7 - r + 0.5, y: 7 - f + 0.5 };
}

// --- colour helpers ---------------------------------------------------------------------
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

// --- primitives -------------------------------------------------------------------------
// axis-aligned box with the three visible faces; (x,y,z) is the min corner.
function box(x, y, z, dx, dy, dz, c) {
  const t = z + dz;
  return poly([[x, y, t], [x + dx, y, t], [x + dx, y + dy, t], [x, y + dy, t]], c.top)
    + poly([[x + dx, y, t], [x + dx, y + dy, t], [x + dx, y + dy, z], [x + dx, y, z]], c.right)
    + poly([[x, y + dy, t], [x + dx, y + dy, t], [x + dx, y + dy, z], [x, y + dy, z]], c.left);
}
const shades = base => ({ top: mix(base, '#ffffff', .25), left: base, right: mix(base, '#000000', .38) });

// Catmull-Rom resampling of a [height, radius] profile
function smooth(p, sub = 5) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(p[p.length - 1]);
  return out.map(([h, r]) => [h, Math.max(0, r)]);
}
const egg = (c, a, rad, h0, h1, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
  const h = h0 + (h1 - h0) * i / n, d = (h - c) / a;
  return [h, rad * Math.sqrt(Math.max(0, 1 - d * d))];
});
const foot = r => [[0, r], [.07, r], [.09, r - .04], [.15, r - .08]];

// A lathe: a stack of frusta around a vertical axis, drawn bottom to top.
function lathe(pts, grad, topFill) {
  const sl = [];
  for (let i = 0; i < pts.length - 1; i++) sl.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]);
  let out = '';
  sl.forEach(([hA, rA, hB, rB], i) => {
    const yA = -hA * ZK, yB = -hB * ZK, xa = rA * EX, ya = rA * EY, xb = rB * EX, yb = rB * EY;
    if (hB - hA > 1e-4 && (xa + xb) > .2) {
      out += `<path d="M${-xa},${yA.toFixed(1)}L${-xb},${yB.toFixed(1)}A${xb.toFixed(1)},${yb.toFixed(1)} 0 0 1 ${xb.toFixed(1)},${yB.toFixed(1)}L${xa.toFixed(1)},${yA.toFixed(1)}A${xa.toFixed(1)},${ya.toFixed(1)} 0 0 1 ${-xa},${yA.toFixed(1)}Z" fill="url(#${grad})" stroke="url(#${grad})" stroke-width=".8" stroke-linejoin="round"/>`;
    }
    const nxt = sl[i + 1];
    if (rB > .02 && (!nxt || nxt[1] < rB - .015)) out += `<ellipse cx="0" cy="${yB.toFixed(1)}" rx="${xb.toFixed(1)}" ry="${yb.toFixed(1)}" fill="${topFill}"/>`;
  });
  return out;
}
const at = (h, dx = 0, dy = 0) => [dx, -h * ZK + dy];
// small sphere; r is in pixels, centred on (cx, cy)
const ball = (cx, cy, r, grad, top) => { const t = r / EX; return `<g transform="translate(${cx.toFixed(1)},${(cy + r).toFixed(1)})">${lathe(egg(t, t, t, 0, 2 * t, 6), grad, top)}</g>`; };

// --- pieces -----------------------------------------------------------------------------
// Each model draws around local (0,0) = centre of the base on the board. `c` is the colour table.
const MODELS = {
  p(g, c) {
    return lathe([...foot(.36), ...smooth([[.15, .28], [.28, .17], [.48, .12], [.58, .12]], 4),
      [.58, .21], [.62, .21], [.64, .12], ...egg(.78, .16, .16, .64, .94, 8)], g, c.top);
  },
  r(g, c, f) {
    let s = lathe([...foot(.37), ...smooth([[.15, .29], [.25, .24], [.7, .22]], 4), [.7, .31], [.9, .31]], g, c.top);
    s += `<ellipse cx="0" cy="${at(.9)[1]}" rx="${.2 * EX}" ry="${.2 * EY}" fill="${c.lo}"/>`;
    const bx = shades(c.mid);
    for (const [dx, dy] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) {   // merlons, back to front
      const [sx, sy] = proj(dx, dy, .9);
      s += `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})">${box(-.07, -.07, 0, .14, .14, .16, bx)}</g>`;
    }
    return s;
  },
  n(g, c, f) {
    const t = .3, steps = 10;
    const prof = [[-.26, .13], [.26, .13], [.22, .3], [.28, .5], [.4, .66], [.43, .78], [.42, .86], [.3, .97], [.24, 1.2], [.12, 1.1], [-.04, 1.18], [-.17, .95], [-.25, .6], [-.27, .3]];
    const sgn = f; // facing direction along x: White looks to -x, Black to +x
    const pts = off => prof.map(([u, h]) => { const [sx, sy] = proj(sgn * u, off); return `${(sx).toFixed(1)},${(sy - h * ZK).toFixed(1)}`; }).join(' ');
    let s = lathe([...foot(.37)], g, c.top);
    for (let i = 0; i <= steps; i++) {
      const off = -t / 2 + t * i / steps, last = i === steps;
      s += `<polygon points="${pts(off)}" fill="${last ? `url(#${g})` : mix(c.lo, c.mid, .3)}" ${last ? `stroke="${mix(c.lo, '#000000', .2)}" stroke-width=".7"` : `stroke="${mix(c.lo, c.mid, .3)}" stroke-width="1"`} stroke-linejoin="round"/>`;
    }
    const [ex, ey] = proj(sgn * .2, t / 2); const hx = ex, hy = ey - .98 * ZK;
    s += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="2.6" fill="${c.lo === PAL.w.lo ? '#2b3a46' : '#d9e3ea'}"/>`;
    return s;
  },
  b(g, c) {
    let s = lathe([...foot(.37), ...smooth([[.15, .29], [.3, .17], [.65, .12], [.74, .12]], 4),
      [.74, .2], [.78, .2], [.8, .12], ...egg(1.05, .34, .19, .8, 1.39, 9)], g, c.top);
    s += ball(0, -1.41 * ZK, .06 * EX * 1.1, g, c.top);
    s += `<path d="M${-.07 * EX},${at(1.0)[1]}L${.08 * EX},${at(1.16)[1]}" stroke="${c.lo}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    return s;
  },
  q(g, c) {
    let s = lathe([...foot(.38), ...smooth([[.15, .3], [.3, .19], [.7, .13], [1.0, .15]], 4),
      [1.0, .26], [1.05, .26], ...smooth([[1.05, .26], [1.2, .3], [1.42, .33]], 3), [1.46, .33]], g, c.top);
    s += `<ellipse cx="0" cy="${at(1.46)[1]}" rx="${.21 * EX}" ry="${.21 * EY}" fill="${c.lo}"/>`;
    const balls = [];
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, [sx, sy] = proj(Math.cos(a) * .3, Math.sin(a) * .3, 1.46); balls.push([sx, sy]); }
    balls.sort((a, b) => a[1] - b[1]).forEach(([sx, sy]) => { s += ball(sx, sy - 3, 5.2, g, c.top); });
    s += ball(0, at(1.5)[1], 7.5, g, c.top);
    return s;
  },
  k(g, c) {
    let s = lathe([...foot(.38), ...smooth([[.15, .3], [.3, .19], [.7, .13], [1.0, .15]], 4),
      [1.0, .26], [1.05, .26], ...smooth([[1.05, .26], [1.25, .3], [1.5, .3]], 3), [1.54, .3], ...smooth([[1.54, .3], [1.64, .22], [1.72, .09]], 3)], g, c.top);
    const bx = shades(c.mid);
    const [sx, sy] = proj(0, 0, 1.7);
    s += `<g transform="translate(${sx.toFixed(1)},${sy.toFixed(1)})">${box(-.045, -.045, 0, .09, .09, .36, bx)}${box(-.13, -.045, .2, .26, .09, .08, bx)}</g>`;
    return s;
  },
};

export function pieceSVG(p) {
  const c = PAL[p.c], g = 'g' + p.c;
  const [sx, sy] = proj(p.x, p.y, 0);
  const lift = (p.z || 0) * ZK, s = p.s || 1;
  const body = MODELS[p.t](g, c, p.c === 'w' ? -1 : 1);
  return `<g transform="translate(${sx.toFixed(1)},${(sy - lift).toFixed(1)}) scale(${s})" opacity="${(p.a ?? 1).toFixed(2)}">${body}</g>`;
}
function shadowSVG(p) {
  const [sx, sy] = proj(p.x, p.y, 0), k = 1 - Math.min(.5, (p.z || 0) * .6);
  return `<ellipse cx="${(sx + 7).toFixed(1)}" cy="${(sy + 4).toFixed(1)}" rx="${(.4 * EX * k).toFixed(1)}" ry="${(.4 * EY * k).toFixed(1)}" fill="#0b1a20" opacity="${(.24 * k * (p.a ?? 1)).toFixed(2)}"/>`;
}

// --- board ------------------------------------------------------------------------------
function boardSVG() {
  const m = -.3, e = 8.3, T = .45;
  let s = poly([[m, e, 0], [e, e, 0], [e, e, -T], [m, e, -T]], PAL.frameSide[0]);
  s += poly([[e, m, 0], [e, e, 0], [e, e, -T], [e, m, -T]], PAL.frameSide[1]);
  s += poly([[m, m, 0], [e, m, 0], [e, e, 0], [m, e, 0]], PAL.frame);
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
    const x0 = 7 - r, y0 = 7 - f;
    s += poly([[x0, y0, 0], [x0 + 1, y0, 0], [x0 + 1, y0 + 1, 0], [x0, y0 + 1, 0]], (f + r) % 2 ? PAL.light : PAL.dark);
  }
  const lab = (t, x, y) => { const [sx, sy] = proj(x, y, 0); return `<text x="${sx.toFixed(1)}" y="${(sy + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#9fb4ba" font-family="Helvetica,Arial,sans-serif">${t}</text>`; };
  for (let i = 0; i < 8; i++) { s += lab('abcdefgh'[i], 8.62, 7 - i + .5); s += lab(i + 1, 7 - i + .5, 8.62); }
  return s;
}
const squareQuad = (sq, fill, op) => { const { x, y } = sqToXY(sq); return poly([[x - .5, y - .5, .01], [x + .5, y - .5, .01], [x + .5, y + .5, .01], [x - .5, y + .5, .01]], fill, `opacity="${op}"`); };
function arrowSVG(a, b, alpha) {
  const A = sqToXY(a), B = sqToXY(b), dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
  const s0 = .22, s1 = L - .5, hl = .4, w = .09, hw = .23;
  const pt = (a1, b1) => [A.x + ux * a1 + px * b1, A.y + uy * a1 + py * b1, .02];
  const pts = [pt(s0, w), pt(s1 - hl + .1, w), pt(s1 - hl, hw), pt(s1 + .12, 0), pt(s1 - hl, -hw), pt(s1 - hl + .1, -w), pt(s0, -w)];
  return poly(pts, PAL.accent, `opacity="${(.88 * alpha).toFixed(2)}" stroke="#fff" stroke-opacity="${(.5 * alpha).toFixed(2)}" stroke-width="1"`);
}

const DEFS = ['w', 'b'].map(k => { const c = PAL[k]; return `<linearGradient id="g${k}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${mix(c.hi, c.mid, .5)}"/><stop offset=".28" stop-color="${c.hi}"/><stop offset=".6" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.lo}"/></linearGradient>`; }).join('');

// scene = { pieces:[{t,c,x,y,z,s,a}], hl:[{sq,kind,a}], arrows:[[from,to]], arrowAlpha }
// opts  = { bg:boolean }  adds a background so the SVG works standalone
export function renderScene(scene, opts = {}) {
  const vb = '-410 -125 820 565';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" role="img" aria-label="Isometric chess position"><defs>${DEFS}</defs>`;
  if (opts.bg) s += `<rect x="-410" y="-125" width="820" height="565" fill="${PAL.bg}"/>`;
  s += boardSVG();
  for (const h of scene.hl || []) s += squareQuad(h.sq, h.kind === 'check' ? PAL.accent : PAL.last, h.a ?? .4);
  for (const m of scene.marks || []) s += squareQuad(m, PAL.accent, .45 * (scene.arrowAlpha ?? 1));
  const ps = [...scene.pieces].sort((a, b) => (a.x + a.y) - (b.x + b.y) || (a.z || 0) - (b.z || 0));
  for (const p of ps) s += shadowSVG(p);
  for (const [a, b] of scene.arrows || []) s += arrowSVG(a, b, scene.arrowAlpha ?? 1);
  for (const p of ps) s += pieceSVG(p);
  return s + '</svg>';
}
