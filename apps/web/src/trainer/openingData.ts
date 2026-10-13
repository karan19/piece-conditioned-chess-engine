
import type { OpeningCourse, OpeningLine } from "./trainerTypes";

export const openingCourses: OpeningCourse[] = [
  {
    id: "london-system",
    name: "London System",
    tagline: "A solid, low-theory White system you can play every game.",
    description: "A solid, low-theory White system you can play every game.\n\nPlay d4 and Bf4, then build the bishop on d3, knight on f3, and castle. Avoid mainline theory to focus on middlegame skills.",
    author: "PCCE team · public theory",
    side: "w" as const,
    essentials: [
      {
        id: "london/classic",
        name: "Classic setup",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","c5","c3","Bd6","Bd3","O-O","Nbd2","b6"],
        summary: "d4-d5, Bf4, Nf3, e3, Bd3 with a bishop eye on h7."
      },
      {
        id: "london/exchange-slav",
        name: "Exchange Slav",
        moves: ["d4","d5","Bf4","Bf5","e3","e6","Bd3","Bxd3","cxd3","c6"],
        summary: "When Black plays Bf5, trade dark-squared bishops on d6."
      },
      {
        id: "london/symmetrical",
        name: "Symmetrical setup",
        moves: ["d4","d5","Bf4","c5","e3","Nc6","Nf3","Nf6","c3","g6","Be2","Bg7","O-O","O-O","dxc5"],
        summary: "Both sides mirror; plan the e4 break to fight for the centre."
      },
      {
        id: "london/kings-indian",
        name: "vs King's Indian",
        moves: ["d4","Nf6","c3","g6","Bf4","Bg7","Nf3","O-O","Nbd2","d6","e3","c5","h3","Nc6"],
        summary: "Slow London setup with an early e4 break."
      },
      {
        id: "london/slav-approach",
        name: "Slav-ish setup",
        moves: ["d4","d5","Bf4","c6","Nf3","Nf6","e3","Bf5","Bd3","Bxd3","cxd3","e6"],
        summary: "Trade dark bishops and then push e4 with the light-squared bishop."
      },
      {
        id: "london/gambit-line",
        name: "Gambit-line",
        moves: ["d4","d5","Bf4","Nf6","e3","g6","Nc3","Bg7","Nf3","O-O","Be2","c5","O-O","cxd4"],
        summary: "Build a bishop on g7 and attack with e4 or c3-e5 pushes."
      },
      {
        id: "london/old-indian",
        name: "Old Indian setup",
        moves: ["d4","Nf6","Bf4","e6","Nf3","b6","Nc3","Bb4","e3","Bb7","Bd3","Be7","Qe2","O-O"],
        summary: "Against the Old Indian, play a solid London and prepare e4."
      },
      {
        id: "london/stoic-slav",
        name: "Stoic Slav",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","Bd6","Bd3","O-O","O-O","b6","c4","Bd7"],
        summary: "Push c4 to open the queenside after the solid setup."
      },
      {
        id: "london/french-style",
        name: "French-style setup",
        moves: ["d4","e6","Bf4","d5","e3","Bd6","Bd3","Nf6","Nf3","O-O","O-O","c5","c3","Nc6"],
        summary: "Meet a French-style setup by developing Bf4, Nf3 and Bd3 first."
      },
      {
        id: "london/stoic-line",
        name: "Stoic Line",
        moves: ["d4","d5","Bf4","c6","e3","e6","Nf3","Nf6","c3","Bd6","Bd3","O-O","Nbd2","Qc7"],
        summary: "Trade bishops with Bd3, then push e4, and castle king's side."
      },
      {
        id: "italian/guuoco",
        name: "Giuoco Piano",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4","Bb4+","Nc3","Nxe4","O-O","Nxc3"],
        summary: "Open with Bc4/Bc5, Nf3/Nc6, and fight d4 with c3 and Bg5."
      },
      {
        id: "italian/evans",
        name: "Evans Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4","exd4","O-O","Nge7","e5","O-O"],
        summary: "Sacrifice the b-pawn for development and attack d4 with c3, d4, e5."
      },
      {
        id: "italian/modern-classical",
        name: "Modern classical: d3 setup",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d3","Nf6","c3","d6","Nbd2","O-O","O-O","a6","Re1","Ba7"],
        summary: "Slow development with d3 and c3, then push either d3-d4 or e5."
      },
      {
        id: "italian/italian-gambit",
        name: "Italian Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d4","exd4","O-O","d6","c3"],
        summary: "Build the bishop pair and push c3, d4, e5 quickly."
      },
      {
        id: "italian/fried-liver",
        name: "Fried Liver Attack",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and d5, winning material and the king."
      },
      {
        id: "italian/two-knights",
        name: "Two Knights Defence",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and a queen check on h5."
      }
    ],
    full: [
      {
        id: "london/classic",
        name: "Classic setup",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","c5","c3","Bd6","Bd3","O-O","Nbd2","b6"],
        summary: "d4-d5, Bf4, Nf3, e3, Bd3 with a bishop eye on h7."
      },
      {
        id: "london/exchange-slav",
        name: "Exchange Slav",
        moves: ["d4","d5","Bf4","Bf5","e3","e6","Bd3","Bxd3","cxd3","c6"],
        summary: "When Black plays Bf5, trade dark-squared bishops on d6."
      },
      {
        id: "london/symmetrical",
        name: "Symmetrical setup",
        moves: ["d4","d5","Bf4","c5","e3","Nc6","Nf3","Nf6","c3","g6","Be2","Bg7","O-O","O-O","dxc5"],
        summary: "Both sides mirror; plan the e4 break to fight for the centre."
      },
      {
        id: "london/kings-indian",
        name: "vs King's Indian",
        moves: ["d4","Nf6","c3","g6","Bf4","Bg7","Nf3","O-O","Nbd2","d6","e3","c5","h3","Nc6"],
        summary: "Slow London setup with an early e4 break."
      },
      {
        id: "london/slav-approach",
        name: "Slav-ish setup",
        moves: ["d4","d5","Bf4","c6","Nf3","Nf6","e3","Bf5","Bd3","Bxd3","cxd3","e6"],
        summary: "Trade dark bishops and then push e4 with the light-squared bishop."
      },
      {
        id: "london/gambit-line",
        name: "Gambit-line",
        moves: ["d4","d5","Bf4","Nf6","e3","g6","Nc3","Bg7","Nf3","O-O","Be2","c5","O-O","cxd4"],
        summary: "Build a bishop on g7 and attack with e4 or c3-e5 pushes."
      },
      {
        id: "london/old-indian",
        name: "Old Indian setup",
        moves: ["d4","Nf6","Bf4","e6","Nf3","b6","Nc3","Bb4","e3","Bb7","Bd3","Be7","Qe2","O-O"],
        summary: "Against the Old Indian, play a solid London and prepare e4."
      },
      {
        id: "london/stoic-slav",
        name: "Stoic Slav",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","Bd6","Bd3","O-O","O-O","b6","c4","Bd7"],
        summary: "Push c4 to open the queenside after the solid setup."
      },
      {
        id: "london/french-style",
        name: "French-style setup",
        moves: ["d4","e6","Bf4","d5","e3","Bd6","Bd3","Nf6","Nf3","O-O","O-O","c5","c3","Nc6"],
        summary: "Meet a French-style setup by developing Bf4, Nf3 and Bd3 first."
      },
      {
        id: "london/stoic-line",
        name: "Stoic Line",
        moves: ["d4","d5","Bf4","c6","e3","e6","Nf3","Nf6","c3","Bd6","Bd3","O-O","Nbd2","Qc7"],
        summary: "Trade bishops with Bd3, then push e4, and castle king's side."
      },
      {
        id: "italian/guuoco",
        name: "Giuoco Piano",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4","Bb4+","Nc3","Nxe4","O-O","Nxc3"],
        summary: "Open with Bc4/Bc5, Nf3/Nc6, and fight d4 with c3 and Bg5."
      },
      {
        id: "italian/evans",
        name: "Evans Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4","exd4","O-O","Nge7","e5","O-O"],
        summary: "Sacrifice the b-pawn for development and attack d4 with c3, d4, e5."
      },
      {
        id: "italian/modern-classical",
        name: "Modern classical: d3 setup",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d3","Nf6","c3","d6","Nbd2","O-O","O-O","a6","Re1","Ba7"],
        summary: "Slow development with d3 and c3, then push either d3-d4 or e5."
      },
      {
        id: "italian/italian-gambit",
        name: "Italian Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d4","exd4","O-O","d6","c3"],
        summary: "Build the bishop pair and push c3, d4, e5 quickly."
      },
      {
        id: "italian/fried-liver",
        name: "Fried Liver Attack",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and d5, winning material and the king."
      },
      {
        id: "italian/two-knights",
        name: "Two Knights Defence",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and a queen check on h5."
      }
    ]
  },
  {
    id: "sicilian-defense",
    name: "Sicilian Defense",
    tagline: "The sharpest reply to 1.e4 — counter-attack from move one.",
    description: "The sharpest reply to 1.e4 — counter-attack from move one.\n\nPlay c5 first, then build the fianchetto bishop on g7 or the Kan a6 setup. Aim to trade on d4 for the bishop pair.",
    author: "PCCE team · public theory",
    side: "b" as const,
    essentials: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ],
    full: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ]
  },
  {
    id: "italian-game",
    name: "Italian Game",
    tagline: "A principled e4 opening that teaches you plan-building.",
    description: "A principled e4 opening.\n\nPlay e4, Bc4, Nf3, c3, and aim for either d4 or d3. Develop fast and use the bishop pair to create attacking chances.",
    author: "PCCE team · public theory",
    side: "w" as const,
    essentials: [
      {
        id: "london/classic",
        name: "Classic setup",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","c5","c3","Bd6","Bd3","O-O","Nbd2","b6"],
        summary: "d4-d5, Bf4, Nf3, e3, Bd3 with a bishop eye on h7."
      },
      {
        id: "london/exchange-slav",
        name: "Exchange Slav",
        moves: ["d4","d5","Bf4","Bf5","e3","e6","Bd3","Bxd3","cxd3","c6"],
        summary: "When Black plays Bf5, trade dark-squared bishops on d6."
      },
      {
        id: "london/symmetrical",
        name: "Symmetrical setup",
        moves: ["d4","d5","Bf4","c5","e3","Nc6","Nf3","Nf6","c3","g6","Be2","Bg7","O-O","O-O","dxc5"],
        summary: "Both sides mirror; plan the e4 break to fight for the centre."
      },
      {
        id: "london/kings-indian",
        name: "vs King's Indian",
        moves: ["d4","Nf6","c3","g6","Bf4","Bg7","Nf3","O-O","Nbd2","d6","e3","c5","h3","Nc6"],
        summary: "Slow London setup with an early e4 break."
      },
      {
        id: "london/slav-approach",
        name: "Slav-ish setup",
        moves: ["d4","d5","Bf4","c6","Nf3","Nf6","e3","Bf5","Bd3","Bxd3","cxd3","e6"],
        summary: "Trade dark bishops and then push e4 with the light-squared bishop."
      },
      {
        id: "london/gambit-line",
        name: "Gambit-line",
        moves: ["d4","d5","Bf4","Nf6","e3","g6","Nc3","Bg7","Nf3","O-O","Be2","c5","O-O","cxd4"],
        summary: "Build a bishop on g7 and attack with e4 or c3-e5 pushes."
      },
      {
        id: "london/old-indian",
        name: "Old Indian setup",
        moves: ["d4","Nf6","Bf4","e6","Nf3","b6","Nc3","Bb4","e3","Bb7","Bd3","Be7","Qe2","O-O"],
        summary: "Against the Old Indian, play a solid London and prepare e4."
      },
      {
        id: "london/stoic-slav",
        name: "Stoic Slav",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","Bd6","Bd3","O-O","O-O","b6","c4","Bd7"],
        summary: "Push c4 to open the queenside after the solid setup."
      },
      {
        id: "london/french-style",
        name: "French-style setup",
        moves: ["d4","e6","Bf4","d5","e3","Bd6","Bd3","Nf6","Nf3","O-O","O-O","c5","c3","Nc6"],
        summary: "Meet a French-style setup by developing Bf4, Nf3 and Bd3 first."
      },
      {
        id: "london/stoic-line",
        name: "Stoic Line",
        moves: ["d4","d5","Bf4","c6","e3","e6","Nf3","Nf6","c3","Bd6","Bd3","O-O","Nbd2","Qc7"],
        summary: "Trade bishops with Bd3, then push e4, and castle king's side."
      },
      {
        id: "italian/guuoco",
        name: "Giuoco Piano",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4","Bb4+","Nc3","Nxe4","O-O","Nxc3"],
        summary: "Open with Bc4/Bc5, Nf3/Nc6, and fight d4 with c3 and Bg5."
      },
      {
        id: "italian/evans",
        name: "Evans Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4","exd4","O-O","Nge7","e5","O-O"],
        summary: "Sacrifice the b-pawn for development and attack d4 with c3, d4, e5."
      },
      {
        id: "italian/modern-classical",
        name: "Modern classical: d3 setup",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d3","Nf6","c3","d6","Nbd2","O-O","O-O","a6","Re1","Ba7"],
        summary: "Slow development with d3 and c3, then push either d3-d4 or e5."
      },
      {
        id: "italian/italian-gambit",
        name: "Italian Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d4","exd4","O-O","d6","c3"],
        summary: "Build the bishop pair and push c3, d4, e5 quickly."
      },
      {
        id: "italian/fried-liver",
        name: "Fried Liver Attack",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and d5, winning material and the king."
      },
      {
        id: "italian/two-knights",
        name: "Two Knights Defence",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and a queen check on h5."
      }
    ],
    full: [
      {
        id: "london/classic",
        name: "Classic setup",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","c5","c3","Bd6","Bd3","O-O","Nbd2","b6"],
        summary: "d4-d5, Bf4, Nf3, e3, Bd3 with a bishop eye on h7."
      },
      {
        id: "london/exchange-slav",
        name: "Exchange Slav",
        moves: ["d4","d5","Bf4","Bf5","e3","e6","Bd3","Bxd3","cxd3","c6"],
        summary: "When Black plays Bf5, trade dark-squared bishops on d6."
      },
      {
        id: "london/symmetrical",
        name: "Symmetrical setup",
        moves: ["d4","d5","Bf4","c5","e3","Nc6","Nf3","Nf6","c3","g6","Be2","Bg7","O-O","O-O","dxc5"],
        summary: "Both sides mirror; plan the e4 break to fight for the centre."
      },
      {
        id: "london/kings-indian",
        name: "vs King's Indian",
        moves: ["d4","Nf6","c3","g6","Bf4","Bg7","Nf3","O-O","Nbd2","d6","e3","c5","h3","Nc6"],
        summary: "Slow London setup with an early e4 break."
      },
      {
        id: "london/slav-approach",
        name: "Slav-ish setup",
        moves: ["d4","d5","Bf4","c6","Nf3","Nf6","e3","Bf5","Bd3","Bxd3","cxd3","e6"],
        summary: "Trade dark bishops and then push e4 with the light-squared bishop."
      },
      {
        id: "london/gambit-line",
        name: "Gambit-line",
        moves: ["d4","d5","Bf4","Nf6","e3","g6","Nc3","Bg7","Nf3","O-O","Be2","c5","O-O","cxd4"],
        summary: "Build a bishop on g7 and attack with e4 or c3-e5 pushes."
      },
      {
        id: "london/old-indian",
        name: "Old Indian setup",
        moves: ["d4","Nf6","Bf4","e6","Nf3","b6","Nc3","Bb4","e3","Bb7","Bd3","Be7","Qe2","O-O"],
        summary: "Against the Old Indian, play a solid London and prepare e4."
      },
      {
        id: "london/stoic-slav",
        name: "Stoic Slav",
        moves: ["d4","d5","Bf4","Nf6","e3","e6","Nf3","Bd6","Bd3","O-O","O-O","b6","c4","Bd7"],
        summary: "Push c4 to open the queenside after the solid setup."
      },
      {
        id: "london/french-style",
        name: "French-style setup",
        moves: ["d4","e6","Bf4","d5","e3","Bd6","Bd3","Nf6","Nf3","O-O","O-O","c5","c3","Nc6"],
        summary: "Meet a French-style setup by developing Bf4, Nf3 and Bd3 first."
      },
      {
        id: "london/stoic-line",
        name: "Stoic Line",
        moves: ["d4","d5","Bf4","c6","e3","e6","Nf3","Nf6","c3","Bd6","Bd3","O-O","Nbd2","Qc7"],
        summary: "Trade bishops with Bd3, then push e4, and castle king's side."
      },
      {
        id: "italian/guuoco",
        name: "Giuoco Piano",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4","Bb4+","Nc3","Nxe4","O-O","Nxc3"],
        summary: "Open with Bc4/Bc5, Nf3/Nc6, and fight d4 with c3 and Bg5."
      },
      {
        id: "italian/evans",
        name: "Evans Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4","exd4","O-O","Nge7","e5","O-O"],
        summary: "Sacrifice the b-pawn for development and attack d4 with c3, d4, e5."
      },
      {
        id: "italian/modern-classical",
        name: "Modern classical: d3 setup",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d3","Nf6","c3","d6","Nbd2","O-O","O-O","a6","Re1","Ba7"],
        summary: "Slow development with d3 and c3, then push either d3-d4 or e5."
      },
      {
        id: "italian/italian-gambit",
        name: "Italian Gambit",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d4","exd4","O-O","d6","c3"],
        summary: "Build the bishop pair and push c3, d4, e5 quickly."
      },
      {
        id: "italian/fried-liver",
        name: "Fried Liver Attack",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and d5, winning material and the king."
      },
      {
        id: "italian/two-knights",
        name: "Two Knights Defence",
        moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5","Nxf7","Kxf7","Qh5+","Ke6"],
        summary: "Attack f7 with Bc4/Ng5 and a queen check on h5."
      }
    ]
  },
  {
    id: "french-defense",
    name: "French Defense",
    tagline: "Meet 1.e4 with e6 and d5. Solid and hard to break.",
    description: "A solid reply to 1.e4 with e6 and d5.\n\nBuild a pawn chain from d5-e6-f7 and fianchetto the light-squared bishop for a slow kingside attack.",
    author: "PCCE team · public theory",
    side: "b" as const,
    essentials: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ],
    full: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ]
  },
  {
    id: "caro-kann",
    name: "Caro-Kann Defense",
    tagline: "Meet 1.e4 with c6 then d5. Solid, safe, attacking.",
    description: "Meet 1.e4 with c6 and d5 for a solid, safe game.\n\nBuild the bishop on d3 or fianchetto, then aim for a kingside attack.",
    author: "PCCE team · public theory",
    side: "b" as const,
    essentials: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ],
    full: [
      {
        id: "sic/classic-kan",
        name: "Kan: a6 setup",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Nc6","Be2","Nf6","Be3","Bb4","f3"],
        summary: "Play e6 and a6, then develop the knight to c6 with Bb4 to come."
      },
      {
        id: "sic/dragon",
        name: "Accelerated Dragon",
        moves: ["e4","c5","Nf3","g6","d4","cxd4","Nxd4","Nc6","Nc3","Bg7","Be3","Nf6","f3","O-O"],
        summary: "Fianchetto on g7 and prepare the Rb8/b5 pawn storm."
      },
      {
        id: "sic/najdorf",
        name: "Najdorf: 5.a6",
        moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be7","f3","O-O"],
        summary: "Play a6 to prevent Nb5, then d6, Nf6, e5 and a slow kingside attack."
      },
      {
        id: "sic/taimanov",
        name: "Taimanov: Nc6",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","Nc6","Nc3","Qc7","Be2","a6","Be3","Nf6","f4","Bb4"],
        summary: "Nc6 first, then Qc7 to fight the d-file and prepare Bb4 for White's knight."
      },
      {
        id: "sic/classical",
        name: "Classical Sicilian",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","g6","Nc3","Bg7","Be3","Nf6","f3","O-O","Qd2","d6"],
        summary: "Nc6 + Bg7 setup with an early Nf6 to hit e4 square directly."
      },
      {
        id: "sic/sveshnikov",
        name: "Sveshnikov setup",
        moves: ["e4","c5","Nf3","Nc6","d4","cxd4","Nxd4","Nf6","Nc3","e6","Ndb5","d6","Bf4","e5","Bg5","a6"],
        summary: "e5 setup to control d4/f5, then a6/d6 to hold the knights and attack kingside."
      },
      {
        id: "sic/kan-quiet",
        name: "Kan: quiet line",
        moves: ["e4","c5","Nf3","e6","d4","cxd4","Nxd4","a6","Nc3","Qc7","Be2","Nf6","O-O","Bb4","Qd3","Nc6"],
        summary: "Develop Qc7 and Bb4, then hit the e4 pawn with Nf6/Qc7 support."
      },
      {
        id: "french/main-line",
        name: "Main line: Nf6",
        moves: ["e4","e6","d4","d5","Nc3","Nf6","e5","Nfd7","f4","c5","Nf3","Nc6","Be3","Qb6"],
        summary: "e6, d5, Nf6, then hit the d4 pawn with Nc6/Qb6."
      },
      {
        id: "french/winawer",
        name: "Winawer: Bb4",
        moves: ["e4","e6","d4","d5","Nc3","Bb4","e5","c5","a3","Bxc3+","bxc3","Ne7","Qg4","O-O"],
        summary: "Bb4 pins the knight, then Nf6+e5 pushes White to a pawn-chain decision."
      },
      {
        id: "french/advance",
        name: "Advance variation",
        moves: ["e4","e6","d4","d5","e5","c5","c3","Nc6","Nf3","Qb6","Be2","cxd4","cxd4","Nxd4"],
        summary: "Push e5 to take the centre, then Nc6 and Qb6 to hit b2/d4 pawns."
      },
      {
        id: "ck/main-line",
        name: "Main line: Nc6",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Play c6/d5, trade on e4, and develop Bf5 to support c6-knight."
      },
      {
        id: "ck/advance",
        name: "Advance variation",
        moves: ["e4","c6","d4","d5","e5","Bf5","Nf3","e6","Be2","c5","c3","Nc6","O-O","Nge7","Na3","cxd4"],
        summary: "Play e5 first, then Bf5/c5 to hit the centre with a queenside attack."
      },
      {
        id: "ck/classical",
        name: "Classical line",
        moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Bd3"],
        summary: "Slow solid setup that trades dark bishops on d3 and fianchettos later."
      },
      {
        id: "ck/exchange",
        name: "Exchange variation",
        moves: ["e4","c6","d4","d5","exd5","cxd5","Bd3","Nc6","c3","Nf6","Bf4","Bg4","Qf3","e6"],
        summary: "Trade on d5, then develop quickly for e4/d4 open squares."
      }
    ]
  },
];
