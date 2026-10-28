// The Opera Game: Paul Morphy vs. the Duke of Brunswick and Count Isouard, Paris, 1858.
// The moves are public domain; the commentary below is original text for this project.

export const TITLE = 'The Opera Game';
export const SUBTITLE = 'Paris, 1858. Paul Morphy plays White in a box at the opera against two noblemen who are consulting over every move.';

export const SANS = ['e4', 'e5', 'Nf3', 'd6', 'd4', 'Bg4', 'dxe5', 'Bxf3', 'Qxf3', 'dxe5', 'Bc4', 'Nf6', 'Qb3', 'Qe7',
  'Nc3', 'c6', 'Bg5', 'b5', 'Nxb5', 'cxb5', 'Bxb5+', 'Nbd7', 'O-O-O', 'Rd8', 'Rxd7', 'Rxd7', 'Rd1', 'Qe6',
  'Bxd7+', 'Nxd7', 'Qb8+', 'Nxb8', 'Rd8#'];

// keyed by ply (1 = White's first move). arrows/marks are drawn on the board while the note is shown.
export const NOTES = {
  1: { text: 'Morphy grabs the center and opens lines for his bishop and queen. Everything that follows is about getting pieces into the game faster than the opponent.' },
  6: { text: 'Black pins the knight on f3 to the queen standing behind it. A pinned piece cannot move without losing something bigger.', arrows: [['g4', 'd1']] },
  9: { text: 'The trade is done and the queen is back in play. Material is even, White’s queen is active, and most of Black’s pieces are still at home.' },
  11: { text: 'The bishop looks straight at f7, the one square next to the king that only the king itself defends.', arrows: [['c4', 'f7']] },
  13: { text: 'The queen now attacks f7 and b7 at the same time. Two threats at once is what tactics are made of.', arrows: [['b3', 'f7'], ['b3', 'b7']] },
  14: { text: 'Black covers f7 with the queen. Morphy keeps developing instead of grabbing material.' },
  17: { text: 'Bg5 pins the knight on f6 to the queen on e7. Black can barely move.', arrows: [['g5', 'e7']] },
  18: { text: 'Black tries to chase the bishop away with ...b5. It opens up lines in front of his own king, which is the real danger.' },
  19: { text: 'Morphy gives up a knight on purpose. If the c6 pawn takes the knight, the bishop captures it with check.', marks: ['b5'] },
  21: { text: 'The bishop checks along the diagonal. Black blocks with the knight, which is now pinned and cannot move.', arrows: [['b5', 'e8']] },
  23: { text: 'Castling long brings the rook to the d-file with a direct threat on the pinned knight.', arrows: [['d1', 'd7']] },
  27: { text: 'The second rook joins the d-file. The rook on d7 is pinned by the bishop and attacked twice.', arrows: [['d1', 'd7'], ['b5', 'd7']] },
  29: { text: 'The bishop takes the rook with check and Black recaptures with the knight. The b-file is wide open now, and the queen on b3 has a clear path to b8.' },
  31: { text: 'Qb8+ gives up the queen. Black has only one legal reply, taking it with the knight.', arrows: [['b3', 'b8']] },
  33: { text: 'Rd8 is checkmate. The bishop on g5 guards the rook, and every escape square is covered. Black’s rook never left h8.', arrows: [['d1', 'd8'], ['g5', 'd8']] },
};
