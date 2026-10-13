import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import type { Opening, Side } from "./catalog";

const names: Record<PieceSymbol, string> = {
  p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king",
};
const centers = ["d4", "e4", "d5", "e5"] as Square[];
const squares = [..."abcdefgh"].flatMap(file => [1, 2, 3, 4, 5, 6, 7, 8].map(rank => `${file}${rank}` as Square));
const colorName = (side: Side) => side === "w" ? "White" : "Black";

/** Explain observable consequences, rather than claiming an engine's intention. */
export function movePurpose(before: Chess, after: Chess, move: Move): string {
  const actor = colorName(move.color);
  const clauses: string[] = [];
  if (move.promotion) clauses.push(`The pawn reaches the last rank and promotes to a ${names[move.promotion]}. Promotion changes the material and the new piece’s range; inspect its attacks and the opposing king’s legal replies.`);
  const attackedBefore = before.attackers(move.from, move.color === "w" ? "b" : "w");
  if (attackedBefore.length && !move.captured)
    clauses.push(`The ${names[move.piece]} leaves ${move.from}, which was attacked by ${attackedBefore.map(s => `${names[before.get(s)!.type]} on ${s}`).join(" and ")}. Moving away may answer that pressure; check whether the new square is safe too.`);
  if (move.flags.includes("k") || move.flags.includes("q"))
    clauses.push(`${actor} castles, bringing the king and rook into new positions. The rook can join central play, while the pawns near the king need protection.`);
  else if (move.captured) {
    const previous = before.history({ verbose: true }).at(-1);
    clauses.push(previous?.captured && previous.to === move.to
      ? `${actor} recaptures on ${move.to}, taking back material after the preceding exchange. Look at the resulting open lines and which piece now occupies that square.`
      : `${actor} takes the ${names[move.captured]}${move.flags.includes("e") ? " en passant" : ` on ${move.to}`}. Removing it changes the material and the lines available to both sides; the capture alone does not prove a material win.`);
  } else if (move.piece === "p") {
    const controls = centers.filter(s => after.attackers(s, move.color).includes(move.to));
    clauses.push(controls.length
      ? `The pawn on ${move.to} controls ${controls.join(" and ")}, helping contest the center. Its advance gains space but gives up the ability to defend from ${move.from}.`
      : `The pawn move changes the structure permanently. It may make room for a piece or support a later advance; compare the pawn's new attacks with the squares it leaves behind.`);
    const opened = before.board().flat().filter(p => p?.color === move.color && (p.type === "b" || p.type === "q")).flatMap(p => {
      if (!p) return [];
      const available = (position: Chess) => squares.filter(square => position.attackers(square, move.color).includes(p.square));
      const old = available(before);
      return available(after).filter(s => !old.includes(s) && centers.includes(s)).map(s => `${names[p.type]} on ${p.square} now reaches ${s}`);
    });
    if (opened.length) clauses.push(`It also opens a line: the ${opened.slice(0, 2).join("; the ")}.`);
  } else if ((move.piece === "n" || move.piece === "b") && move.from[1] === (move.color === "w" ? "1" : "8"))
    clauses.push(`The ${names[move.piece]} comes off its starting rank. Development gives it a job beyond defending the back rank and helps the pieces coordinate before a central break.`);
  else if (move.piece === "r") {
    const pawns = after.board().flat().filter(p => p?.type === "p" && p.square[0] === move.to[0]);
    clauses.push(pawns.length === 0
      ? `The rook moves to the open ${move.to[0]}-file, where no pawns block that file. Other pieces can still obstruct it; look for entry squares before invading.`
      : `The rook moves to the ${move.to[0]}-file. Pawns still occupy this file, so its usefulness depends on supporting them or opening the file later.`);
  } else clauses.push(`${actor} moves the ${names[move.piece]} to ${move.to}. Compare its new attacks and defenders before committing to the next exchange.`);
  const targets = after.board().flat().filter(p => p && p.color !== move.color && p.type !== "k" && after.attackers(p.square, move.color).includes(move.to));
  if (targets.length) clauses.push(`From ${move.to} it attacks ${targets.slice(0, 3).map(p => `${names[p!.type]} on ${p!.square}`).join(" and ")}. An attack creates a decision for the opponent, but a defended target is not necessarily free to capture.`);
  const defended = after.board().flat().filter(p => p && p.color === move.color && p.square !== move.to && after.attackers(p.square, move.color).includes(move.to));
  if (defended.length) clauses.push(`It also supports the ${move.color === "w" ? "White" : "Black"} ${defended.slice(0, 2).map(p => `${names[p!.type]} on ${p!.square}`).join(" and ")}.`);
  if (after.isCheck() && !after.isCheckmate()) clauses.push(`The opposing king is in check. The reply must remove the check by moving the king, capturing the checking piece, or blocking its line when legal.`);
  return clauses.join(" ");
}

export function themedPurpose(opening: Opening, before: Chess, move: Move, ply: number): string | undefined {
  if (ply > 20) return;
  const family = opening.name;
  if (/London/.test(family) && move.color === "w") {
    if (move.san === "Bf4" && move.from === "c1") return "Bf4 brings the c1 bishop outside the pawn chain before e3 can close its starting diagonal. From f4 it controls e5, making a central ...e5 advance something Black must prepare. A usual London development plan is e3, Nf3, Nbd2, c3, Bd3, then castling, but the order must respond to Black's moves. Watch pressure on b2 after the bishop leaves c1, especially if Black can bring the queen to b6.";
    if (move.san === "e3") return "e3 supports the d4 pawn and frees the f1 bishop. If your other bishop has already reached f4, it stays outside this pawn chain. Develop the remaining minor pieces and get the king safe; Black can challenge d4 with ...c5 rather than letting you build undisturbed.";
    if (move.san === "c3") return "c3 supports d4 and gives the center a solid base. The cost is occupying the c3 square that a knight might otherwise use, so London setups often develop that knight to d2. Watch Black's pressure on d4 and on the queenside instead of automatically starting a kingside attack.";
    if (move.san === "Nbd2") return "Nbd2 develops the b1 knight behind the central pawns, supports e4 and c4, and leaves the c-pawn free to support d4. The knight also helps reinforce the other knight if it comes to f3. Coordinate the bishops and castle before choosing a pawn break.";
  }
  if (/Caro-Kann/.test(family)) {
    if (move.color === "b" && move.san === "d5" && move.from === "d7" && before.get("c6")?.type === "p" && before.get("c6")?.color === "b") return "...d5 is the central challenge prepared by ...c6: the c6 pawn supports d5, and the new d5 pawn attacks e4. White can advance e5, exchange on d5, or defend the center with a developing move. Each choice creates a different pawn structure, so Black's bishop placement and pawn breaks must adapt.";
    if (move.color === "b" && move.san === "Bf5" && move.from === "c8") return "...Bf5 develops the light-squared bishop toward e4 before a later ...e6 can shut its original diagonal. White may challenge this bishop with a knight or pawn, so keep a retreat available. Develop the remaining pieces and prepare a central break suited to White's actual pawn chain.";
    if (move.color === "w" && move.san === "e5") return "e5 gains central space and fixes the e-pawn ahead of Black's structure. That space needs support: Black can attack the base of White's center with ...c5, and in some positions challenge its head with ...f6. Develop pieces that can defend the center before using the extra space to attack.";
  }
  if (/French/.test(family) && move.color === "b" && move.san === "c5" && before.get("d4")?.type === "p" && before.get("d4")?.color === "w") return "...c5 challenges d4, often the base of White's pawn center. This is how Black creates counterplay instead of simply defending a cramped position. White must decide whether to maintain the center, exchange, or advance; inspect the resulting bishop diagonals after each pawn trade.";
  if (/Sicilian/.test(family) && move.color === "w" && move.san === "d4" && before.get("c5")?.type === "p" && before.get("c5")?.color === "b") return "d4 directly challenges Black's c5 pawn and seeks an open center for active pieces. If Black exchanges on d4, White often recaptures with a knight, while Black gains a semi-open c-file. Develop and secure your king before treating that activity as an attack.";
  if (/Queen's Gambit/.test(family) && move.color === "w" && move.san === "c4" && before.get("d5")?.type === "p" && before.get("d5")?.color === "b") return "c4 challenges the pawn on d5 with a flank pawn. The aim is to influence the center and possibly open the c-file, rather than offer a pawn for no reason. If Black takes on c4, check how White can recover it; if Black supports d5, develop and decide when a central exchange helps your pieces.";
  if (/King's Indian|Grünfeld|Modern Defense|Pirc/.test(family) && move.color === "b" && move.san === "Bg7") return "...Bg7 develops the bishop onto the long h8–a1 diagonal. Central pawns can block that diagonal, so the bishop's activity depends on later exchanges and pawn breaks. Black should challenge White's center with a break appropriate to this variation and bring the king to safety.";
  return;
}

export function positionGuidance(game: Chess, side: Side, opponentStrategy: string) {
  const other = side === "w" ? "b" : "w";
  const pieces = game.board().flat().filter(p => p !== null);
  const yourTargets = pieces.filter(p => p.color === side && p.type !== "k" && game.attackers(p.square, other).length);
  const undefended = yourTargets.filter(p => !game.attackers(p.square, side).length);
  const watch: string[] = [];
  if (game.isCheckmate()) return { opponentPlan: "The game has ended in checkmate; there is no legal reply.", watch: ["Review which checking line could not be blocked or captured, and which escape squares were covered."] };
  if (game.isGameOver()) return { opponentPlan: "The game has ended in a draw; there is no further guided move.", watch: ["Review the final position and the game's draw condition."] };
  if (game.isCheck()) watch.push(`${colorName(game.turn())} is in check now. Only a legal reply that removes the check is possible.`);
  if (undefended.length) watch.push(`Your ${undefended.slice(0, 3).map(p => `${names[p.type]} on ${p.square}`).join(" and ")} ${undefended.length === 1 ? "is" : "are"} attacked with no direct defender. Check legal captures and tactical replies before ignoring the pressure.`);
  else if (yourTargets.length) watch.push(`The opponent attacks your ${yourTargets.slice(0, 3).map(p => `${names[p.type]} on ${p.square}`).join(" and ")}. These have direct defenders, but an exchange or pin can change that.`);
  const enemyCenter = pieces.filter(p => p.color === other && p.type === "p" && centers.includes(p.square));
  const undeveloped = pieces.filter(p => p.color === side && (p.type === "b" || p.type === "n") && p.square[1] === (side === "w" ? "1" : "8"));
  if (undeveloped.length) watch.push(`You still have ${undeveloped.length} minor ${undeveloped.length === 1 ? "piece" : "pieces"} on the back rank: ${undeveloped.map(p => `${names[p.type]} on ${p.square}`).join(", ")}. Find useful development squares before committing to a long attack.`);
  const king = pieces.find(p => p.color === side && p.type === "k")!;
  if (king.square === (side === "w" ? "e1" : "e8")) watch.push("Your king is still on its starting square. Before opening central files, check king safety and whether castling remains available.");
  if (!watch.length) watch.push("Before each move, inspect the opponent's checks, captures, and attacks. A recorded continuation is one route, not the only legal response.");
  const attackers = yourTargets.flatMap(p => game.attackers(p.square, other).map(square => `${colorName(other)}'s ${names[game.get(square)!.type]} on ${square} attacks your ${names[p.type]} on ${p.square}`));
  const fixedCenter = (game.get("d4")?.color === "w" && game.get("d4")?.type === "p" && game.get("d5")?.color === "b" && game.get("d5")?.type === "p")
    || (game.get("e4")?.color === "w" && game.get("e4")?.type === "p" && game.get("e5")?.color === "b" && game.get("e5")?.type === "p");
  const structure = fixedCenter ? " Opposing central pawns block each other's advance. A neighboring pawn break or a supported exchange may open lines; check what it exposes before playing it." : "";
  const pressure = enemyCenter.length ? ` In this position, ${colorName(other)} occupies ${enemyCenter.map(p => p.square).join(" and ")} with central pawns; your pieces and pawn breaks need to account for that space.` : "";
  return {
    opponentPlan: `${opponentStrategy}${pressure}${structure}${attackers.length ? ` Current pressure: ${attackers.slice(0, 2).join("; ")}. These are attacks to inspect, not a prediction that every capture is safe.` : ""}${game.isCheck() ? ` Right now, ${colorName(game.turn())} must answer the check before carrying out a longer plan.` : ""}`,
    watch: watch.slice(0, 3),
  };
}
