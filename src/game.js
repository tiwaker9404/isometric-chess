// game.js (Node only): replays SAN moves with chess.js and tracks piece identity,
// so the renderer can animate "this exact knight went from g1 to f3".
import { Chess } from 'chess.js';

export function replay(sans) {
  const c = new Chess(), at = {}, cur = new Map();
  let nid = 0;
  for (const row of c.board()) for (const s of row) if (s) { at[s.square] = nid; cur.set(nid, { id: nid, t: s.type, c: s.color, sq: s.square }); nid++; }
  const snap = () => [...cur.values()].map(p => ({ ...p }));
  const frames = [{ pieces: snap(), move: null }];
  for (const san of sans) {
    const m = c.move(san);
    const id = at[m.from]; delete at[m.from];
    const capSq = m.flags.includes('e') ? m.to[0] + m.from[1] : m.to;
    let captured = null;
    if (m.captured) { captured = at[capSq]; delete at[capSq]; cur.delete(captured); }
    cur.get(id).sq = m.to; at[m.to] = id;
    if (m.promotion) cur.get(id).t = m.promotion;
    let rook = null;
    if (m.flags.includes('k') || m.flags.includes('q')) {
      const rk = m.color === 'w' ? '1' : '8', short = m.flags.includes('k');
      const from = (short ? 'h' : 'a') + rk, to = (short ? 'f' : 'd') + rk, rid = at[from];
      delete at[from]; at[to] = rid; cur.get(rid).sq = to; rook = { id: rid, from, to };
    }
    const foe = m.color === 'w' ? 'b' : 'w';
    const king = c.inCheck() ? [...cur.values()].find(p => p.t === 'k' && p.c === foe).sq : null;
    frames.push({ pieces: snap(), move: { san: m.san, from: m.from, to: m.to, color: m.color, piece: m.piece, captured, rook, check: !!king, mate: c.isCheckmate(), kingSq: king } });
  }
  return frames;
}
