import { type Move, type PieceSymbol, type Square } from "chess.js";
import { gameAt, type Opening, type Side } from "./catalog";
const names: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
export type LessonStep = {
  move: Move;
  label: string;
  instruction: string;
  why: string;
  facts: string[];
  reply: string | null;
  plan: string;
};
const plans: Record<string, { idea: string; white: string; black: string }> = {
  "Scandinavian Defense": {
    idea: "Black challenges White's e4 pawn immediately with ...d5. After an exchange, Black can recapture with the queen or develop the knight first.",
    white:
      "Develop while gaining time against an exposed queen. Build a center with d4 and bring your pieces out before launching an attack.",
    black:
      "Recover the central pawn when the line allows, find a safe square for the queen, and develop the minor pieces. Avoid spending several moves moving the queen while White develops.",
  },
  "Sicilian Defense": {
    idea: "Black answers e4 with ...c5, contesting d4 from the side rather than mirroring White with ...e5.",
    white:
      "Develop the knights and consider the d4 break in an Open Sicilian. Watch the different pawn structures: an Alapin or Closed Sicilian has a different plan.",
    black:
      "Use the asymmetrical center to create counterplay. Develop, choose a central break that fits this variation, and bring the king to safety.",
  },
  "French Defense": {
    idea: "Black prepares ...d5 with ...e6, directly challenging White's central pawn structure.",
    white:
      "Use your central space, develop before attacking, and watch Black's pressure against d4.",
    black:
      "Challenge the center with ...c5 when the position allows it, and look for a useful role for the bishop that begins on c8.",
  },
  "Caro-Kann Defense": {
    idea: "Black supports ...d5 with ...c6. The c8 bishop's diagonal is not blocked by ...e6 at the start.",
    white:
      "Choose how to resolve the central tension: advance, exchange, or develop. The resulting pawn structure tells you where to put your pieces.",
    black:
      "Develop the light-squared bishop when appropriate and challenge White's center. Avoid treating every variation as the same setup.",
  },
  "Italian Game": {
    idea: "White develops the king's bishop to c4, where it points toward f7. Both sides can build the center or prepare to open it.",
    white:
      "Develop and castle, then decide whether to prepare d4 with c3 or use a quieter d3 setup. An attack on f7 needs supporting pieces.",
    black:
      "Develop the minor pieces, secure the king, and keep an eye on White's possible d4 break and pressure on f7.",
  },
  "Ruy Lopez": {
    idea: "White's Bb5 attacks the knight on c6, which helps defend the e5 pawn. This creates long-term central tension.",
    white:
      "Develop, castle, and prepare central play. Capturing the c6 knight is a choice in some lines, not an obligation.",
    black:
      "Maintain the center and develop. Moves such as ...a6 ask the bishop to decide its role, but the right follow-up depends on the variation.",
  },
  "London System": {
    idea: "White develops the dark-squared bishop to f4, often before e3 closes its original diagonal.",
    white:
      "Support the center, develop the knights and remaining bishop, and castle. Respond to Black's setup instead of playing every move automatically.",
    black:
      "Develop and challenge White's center. Look for pressure on d4 and b2 when the position allows it.",
  },
  "King's Indian Defense": {
    idea: "Black develops behind a kingside fianchetto while White is allowed to occupy more of the center.",
    white:
      "Use the extra central space, develop, and anticipate Black's pawn breaks before choosing where to attack.",
    black:
      "Prepare a central break such as ...e5 or ...c5. The direction of play depends on how White responds and which center becomes fixed.",
  },
  "English Opening": {
    idea: "White starts with c4 and controls d5 from the flank. The position can transpose into several other opening families.",
    white:
      "Develop around the central squares and choose a pawn structure that fits Black's response. Keep track of possible transpositions.",
    black:
      "Contest central squares with pawns and development. Decide whether to mirror c4 with ...c5 or establish a different central structure.",
  },
  "Queen's Gambit Declined": {
    idea: "White offers the c-pawn to challenge Black's d5 pawn. Black declines the immediate capture and supports the center.",
    white:
      "Develop and increase central pressure. Decide when to exchange on d5 according to the pawn structure you want.",
    black:
      "Develop while supporting d5, and prepare a freeing break when the position allows it. Give the c8 bishop a route into the game.",
  },
  "Scotch Game": {
    idea: "White opens the central tension early with d4 after developing the king's knight.",
    white:
      "Use active development in the open center and bring the king to safety. Watch for attacks on exposed central pieces.",
    black:
      "Develop with tempo when available and contest the central squares. Do not fall behind in development after the center opens.",
  },
};
export function openingPlan(opening: Opening, side: Side) {
  const guide =
    plans[opening.family] ??
    (opening.name.includes("London") ? plans["London System"] : undefined);
  if (guide) return guide;
  const root = opening.moves.slice(0, 2).join(" ");
  const rootGuides: Record<
    string,
    { idea: string; white: string; black: string }
  > = {
    "e4 e5": {
      idea: "Both sides put an e-pawn in the center. These open-game positions focus on developing the minor pieces and deciding when to challenge the center with the d-pawn.",
      white:
        "Develop toward the center, support e4 when necessary, and prepare d4 if it fits the variation. Castle before committing to a long attack.",
      black:
        "Support e5 when needed, develop the minor pieces, and watch for White's d4 break. Look for a useful ...d5 break once the position allows it.",
    },
    "d4 d5": {
      idea: "Both sides occupy the center with a d-pawn. Play often turns on whether the c-pawn challenges the opposing d-pawn and how that tension is resolved.",
      white:
        "Develop while deciding whether to challenge d5 with c4 or use a supported d4 setup. Your pawn exchanges will shape the bishops' roles.",
      black:
        "Develop while maintaining or exchanging the central d5 pawn. Look for a suitable ...c5 or ...e5 break rather than accepting a cramped position automatically.",
    },
    "e4 Nf6": {
      idea: "Black develops a knight and immediately attacks the pawn on e4. White can gain space by advancing pawns, but must also keep those pawns supported.",
      white:
        "Use central space without advancing pawns blindly. Develop the pieces that support your center before trying to chase every opposing piece.",
      black:
        "Use piece activity to challenge White's center. Retreats in the recorded line often preserve the knight while White commits to a pawn structure.",
    },
    "d4 Nf6": {
      idea: "Black develops the king's knight, controlling e4 and d5 without yet committing the central pawns. The following moves determine which Indian or queen's pawn structure emerges.",
      white:
        "Support d4 and develop toward the center. Decide whether to build a larger center with c4 and e4 according to Black's setup.",
      black:
        "Develop while deciding how to challenge White's center. Choose the central pawn break according to the variation, and bring the king to safety.",
    },
    "e4 g6": {
      idea: "Black prepares a kingside fianchetto with ...g6, leaving White room to occupy the center initially. The bishop's diagonal and later pawn breaks are important.",
      white:
        "Use the central space while developing and protecting the king. Anticipate Black's counterattack against the center rather than advancing without support.",
      black:
        "Develop the bishop on its long diagonal and prepare a central challenge. The pawn break must fit White's actual setup.",
    },
    "e4 d6": {
      idea: "Black supports the e5 square with ...d6 while keeping several central setups available. White can occupy more central space before Black chooses a break.",
      white:
        "Build and support the center, develop your pieces, and watch for Black's eventual central pawn challenge.",
      black:
        "Develop and decide how to contest White's center. Coordinate the pieces and pawn breaks instead of leaving White's space unchallenged.",
    },
  };
  if (rootGuides[root]) return rootGuides[root];
  if (opening.moves[0] === "c4") return plans["English Opening"];
  const flank = opening.moves[0];
  if (flank === "b3" || flank === "g3")
    return {
      idea: `White prepares a ${flank === "b3" ? "queenside" : "kingside"} bishop fianchetto with ${flank}. The bishop can influence a long diagonal while the central pawn structure remains flexible.`,
      white:
        "Develop the bishop on its long diagonal and choose a central pawn setup based on Black's response. Keep an eye on pieces or pawns that block the diagonal.",
      black:
        "Occupy or contest central squares, develop the pieces, and watch the fianchetto bishop's diagonal when choosing pawn advances.",
    };
  const gambit = /gambit/i.test(opening.name);
  return {
    idea: gambit
      ? "This named line contains a gambit: one side offers material for activity or another positional aim. Follow the actual captures to see whether the offer is accepted."
      : `This is a recorded route to the ${opening.name} position. Study the moves from both sides and watch how the center and piece placement change.`,
    white:
      "Develop your pieces, control useful central squares, and secure your king. Before choosing a continuation, inspect captures, checks, and what the opponent is threatening.",
    black:
      "Develop your pieces, contest the center, and secure your king. Your follow-up depends on the actual pawn structure and the opponent's threats.",
  };
}
function specificWhy(opening: Opening, prefix: string): string | undefined {
  const family = opening.family;
  if (prefix === "e4")
    return "White claims central space with the e-pawn and attacks d5. Moving the e2 pawn also opens diagonals for the f1 bishop and d1 queen, helping White develop.";
  if (prefix === "d4")
    return "White claims central space with the d-pawn and attacks e5. Moving the d2 pawn opens the c1 bishop's diagonal; the d1 queen still supports the pawn on d4 along the d-file.";
  if (prefix === "c4")
    return "White controls d5 with the c-pawn without committing the d- and e-pawns yet. This flank approach keeps several central pawn setups available.";
  if (prefix === "Nf3")
    return "White develops the king's knight and attacks d4 and e5. The central pawns remain flexible, so White can choose a setup after seeing Black's response.";
  if (family === "Scandinavian Defense")
    return {
      "e4 d5":
        "Black immediately attacks the e4 pawn and puts a pawn in the center. This direct challenge is the defining move of the Scandinavian.",
      "e4 d5 exd5":
        "White accepts the central exchange by taking the d5 pawn. This gives up the e4 pawn's central foothold and asks how Black will recover the pawn.",
      "e4 d5 exd5 Qxd5":
        "Black's queen recovers the pawn on d5. The trade-off is early queen exposure: White can develop a knight to c3 and attack it.",
      "e4 d5 exd5 Nf6":
        "Black develops a knight and attacks the pawn on d5 instead of immediately recapturing with the queen. White can try to hold the pawn, so the exact follow-up matters.",
      "e4 d5 exd5 Qxd5 Nc3":
        "White develops a knight and attacks the queen on d5 at the same time. Black needs to address that attack, so White gains development with tempo.",
      "e4 d5 exd5 Qxd5 Nc3 Qa5":
        "Black moves the attacked queen to a5, where the knight on c3 no longer attacks it. The queen stays active on the a5–e1 diagonal; Black still needs to develop the other pieces.",
      "e4 d5 exd5 Qxd5 Nc3 Qd8":
        "Black withdraws the queen to its starting square. It is out of the knight's attack, but the queen excursion has allowed White to develop with tempo.",
      "e4 d5 exd5 Qxd5 Nc3 Qd6":
        "Black steps the queen away from the c3 knight's attack while keeping it near the center. Further development and king safety remain important.",
    }[prefix];
  if (family === "Sicilian Defense" && prefix === "e4 c5")
    return "Black contests d4 with the c-pawn, creating an asymmetrical center. Unlike ...e5, this keeps Black's e-pawn available for a different central setup.";
  if (family === "French Defense" && prefix === "e4 e6")
    return "Black prepares ...d5 and opens a diagonal for the f8 bishop. The trade-off is that the c8 bishop's original diagonal is now blocked by the e6 pawn.";
  if (family === "Caro-Kann Defense" && prefix === "e4 c6")
    return "Black prepares ...d5 by putting a supporting pawn on c6. Unlike ...e6, this leaves the c8 bishop's original diagonal open.";
  if (family === "Italian Game" && prefix === "e4 e5 Nf3 Nc6 Bc4")
    return "White develops the bishop onto the a2–g8 diagonal, pointing it toward f7. Black's king initially defends f7, so this square is a common focus for coordinated play.";
  if (family === "Ruy Lopez" && prefix === "e4 e5 Nf3 Nc6 Bb5")
    return "White develops the bishop while attacking the knight on c6, one of the defenders of e5. This adds pressure to the center without immediately resolving the tension.";
  return undefined;
}
export function explainStep(
  opening: Opening,
  ply: number,
  side: Side,
): LessonStep | null {
  if (ply >= opening.moves.length) return null;
  const after = gameAt(opening, ply + 1);
  const move = after.history({ verbose: true }).at(-1)!;
  const actor = move.color === "w" ? "White" : "Black",
    opponent = move.color === side ? "You" : "Your opponent";
  const facts: string[] = [];
  if (move.captured)
    facts.push(
      `Captures a ${names[move.captured]}${move.flags.includes("e") ? " en passant" : ` on ${move.to}`}.`,
    );
  if (move.promotion)
    facts.push(`Promotes the pawn to a ${names[move.promotion]}.`);
  if (after.isCheckmate()) facts.push("Delivers checkmate.");
  else if (after.isCheck())
    facts.push(`Checks the ${move.color === "w" ? "Black" : "White"} king.`);
  const central = (["d4", "e4", "d5", "e5"] as Square[]).filter((s) =>
    after.attackers(s, move.color).includes(move.to),
  );
  if (central.length)
    facts.push(
      `The ${names[move.piece]} now attacks ${central.join(" and ")} in the center.`,
    );
  const threats = after
    .board()
    .flat()
    .filter(
      (p) =>
        p &&
        p.color !== move.color &&
        p.type !== "k" &&
        after.attackers(p.square, move.color).includes(move.to),
    );
  for (const piece of threats.slice(0, 2))
    if (piece)
      facts.push(
        `Attacks the opponent's ${names[piece.type]} on ${piece.square}.`,
      );
  let why = specificWhy(opening, opening.moves.slice(0, ply + 1).join(" "));
  if (!why) {
    if (move.flags.includes("k") || move.flags.includes("q"))
      why = `${actor} castles ${move.flags.includes("k") ? "kingside" : "queenside"}, moving the king and rook in one move. This moves the king away from its original central square and brings the rook closer to central play.`;
    else if (move.promotion)
      why = `The pawn has reached the last rank and must promote. This line chooses a ${names[move.promotion]}; other promotion choices would create a different position.`;
    else if (move.captured)
      why = `${actor} exchanges material by taking the ${names[move.captured]}. Notice which piece recaptures, or whether the following move in this line pursues a different idea. An exchange changes both the material and the open lines.`;
    else if (move.piece === "p" && ["d4", "e4", "d5", "e5"].includes(move.to))
      why = `${actor} puts a pawn on ${move.to}, occupying a central square. That claims space and changes which central squares the pawns can control.`;
    else if (
      (move.piece === "n" || move.piece === "b") &&
      move.from[1] === (move.color === "w" ? "1" : "8")
    )
      why = `${actor} develops the ${names[move.piece]} from its starting rank. Look at the squares it attacks from ${move.to}: development matters because it gives the piece a role in the position.`;
    else if (move.piece === "b" && ["g2", "b2", "g7", "b7"].includes(move.to))
      why = `The bishop takes up a fianchetto position on ${move.to}. Its long diagonal can influence central squares; intervening pieces and pawns determine how far it currently sees.`;
    else if (move.piece === "p")
      why = `The pawn advances from ${move.from} to ${move.to}, changing the pawn structure. A pawn cannot move backward, so compare the squares it now controls with the squares it leaves behind.`;
    else if (move.piece === "q")
      why = `${actor} repositions the queen from ${move.from} to ${move.to}. Check whether it is escaping an attack or creating pressure; repeated queen moves can give the opponent time to develop.`;
    else if (move.piece === "r")
      why = `${actor} repositions the rook to ${move.to}. Rooks are most useful on files or ranks with clear paths, so inspect the pawns and pieces along its new lines.`;
    else if (move.piece === "k")
      why = `${actor} moves the king to ${move.to}. King moves affect safety and the ability to castle, so pay attention to the opposing pieces' attacks.`;
    else
      why = `${actor} repositions the ${names[move.piece]} from ${move.from} to ${move.to}. Compare its new attacks and defenders with its previous square.`;
  }
  if (!facts.length)
    facts.push(
      `The ${names[move.piece]} moves from ${move.from} to ${move.to}.`,
    );
  const guide = openingPlan(opening, side);
  return {
    move,
    label: `${Math.floor(ply / 2) + 1}${move.color === "w" ? "." : "..."} ${move.san}`,
    instruction: `${opponent} ${move.color === side ? "play" : "plays"} ${move.san}: ${move.flags.includes("k") || move.flags.includes("q") ? "castle" : `move the ${names[move.piece]} from ${move.from} to ${move.to}`}.`,
    why,
    facts,
    reply: opening.moves[ply + 1] ?? null,
    plan: side === "w" ? guide.white : guide.black,
  };
}
