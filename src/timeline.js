// timeline.js: turns replay frames into poses at any time t. Pure functions, shared by the
// interactive viewer (requestAnimationFrame) and the video renderer (one frame per call).

export const TIMING = { intro: 3.6, move: 0.9, hold: 0.45, note: 3.2, outro: 5 };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function buildTimeline(frames, notes) {
  const segs = []; let t = TIMING.intro;
  for (let i = 1; i < frames.length; i++) {
    const t0 = t, t1 = t0 + TIMING.move, t2 = t1 + (notes[i] ? TIMING.note : TIMING.hold);
    segs.push({ ply: i, t0, t1, t2 }); t = t2;
  }
  return { segs, total: t + TIMING.outro, introEnd: TIMING.intro, end: t };
}

export function poseAt(tl, frames, notes, t, sqToXY) {
  const seg = tl.segs.find(s => t >= s.t0 && t < s.t2);
  const last = frames.length - 1;
  const ply = seg ? seg.ply : (t < tl.introEnd ? 0 : last);
  const phase = !seg ? (ply === 0 ? 'intro' : 'outro') : t < seg.t1 ? 'move' : 'hold';
  const B = frames[ply], A = frames[Math.max(0, ply - 1)];
  const note = notes[ply];
  const place = sq => sqToXY(sq);
  let pieces;
  if (phase === 'move') {
    const p = clamp((t - seg.t0) / (seg.t1 - seg.t0)), e = ease(p), m = B.move;
    const bById = new Map(B.pieces.map(q => [q.id, q]));
    pieces = A.pieces.map(a => {
      const b = bById.get(a.id), o = { t: a.t, c: a.c, id: a.id, ...place(a.sq), z: 0, a: 1 };
      if (!b) { const f = clamp((p - .55) / .3); o.a = 1 - f; o.z = f * .35; o.s = 1 + f * .15; return o; }
      if (a.sq !== b.sq) {
        const from = place(a.sq), to = place(b.sq);
        o.x = from.x + (to.x - from.x) * e; o.y = from.y + (to.y - from.y) * e;
        if (m.rook && a.id === m.rook.id) o.z = .3 * Math.sin(Math.PI * e);
        else o.z = (a.t === 'n' ? .9 : .5) * Math.sin(Math.PI * e);
      }
      if (b.t !== a.t && p > .5) o.t = b.t;
      return o;
    });
  } else {
    pieces = B.pieces.map(b => ({ t: b.t, c: b.c, id: b.id, ...place(b.sq), z: 0, a: 1 }));
    if (phase === 'intro') for (const o of pieces) {            // pieces drop onto the board, back rank first
      const k = clamp((t - 0.25 - (o.x + o.y) / 14 * 1.5) / .7);
      o.a = clamp(k * 3); o.z = 3 * Math.pow(1 - ease(k), 2);
    }
  }
  const hl = [];
  if (B.move && phase !== 'move') {
    hl.push({ sq: B.move.from, a: .3 }, { sq: B.move.to, a: .45 });
    if (B.move.kingSq) hl.push({ sq: B.move.kingSq, kind: 'check', a: .6 });
  }
  const arrowAlpha = phase === 'hold' && note ? clamp((t - seg.t1) / .45) : 0;
  const scene = { pieces, hl, arrows: arrowAlpha > 0 && note?.arrows || [], marks: arrowAlpha > 0 && note?.marks || [], arrowAlpha };
  const key = [ply, phase, phase === 'move' ? Math.round((t - seg.t0) * 1000) : phase === 'intro' ? Math.round(t * 1000) : 0, arrowAlpha.toFixed(2)].join('|');
  return { scene, ply, phase, key, seg };
}
