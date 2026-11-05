import { Chess } from "chess.js";
import { createStage } from "./scene.js";
import { setSound, sound, unlockAudio } from "./audio.js";

const $ = (selector) => document.querySelector(selector);
const names = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };
const symbols = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 20000 };
const battles = {
  p: ["The last word", "A swift blade settles the argument."],
  n: ["Steel meets steel", "The knight delivers a sweeping sword strike."],
  b: ["Divine intervention", "An ancient spell claims its tribute."],
  r: ["The stone awakens", "The fortress becomes a living golem."],
  q: ["By royal decree", "The queen calls down a vanishing spell."],
  k: ["The king has spoken", "One final stroke. No appeal."],
};
const theatrePositions = {
  p: { fen: "7k/8/8/3n4/4P3/8/8/K7 w - - 0 1", from: "e4", to: "d5" },
  n: { fen: "7k/8/8/3b4/8/4N3/8/K7 w - - 0 1", from: "e3", to: "d5" },
  b: { fen: "7k/8/8/3r4/8/8/6B1/K7 w - - 0 1", from: "g2", to: "d5" },
  r: { fen: "7k/8/8/3q4/8/8/3R4/K7 w - - 0 1", from: "d2", to: "d5" },
  q: { fen: "7k/8/8/3n4/8/8/6Q1/K7 w - - 0 1", from: "g2", to: "d5" },
  k: { fen: "7k/8/8/3p4/4K3/8/8/8 w - - 0 1", from: "e4", to: "d5" },
};
const game = new Chess();
let phase = "ready";
let selected = null;
let mode = "ai";
let theatre = null;
let lastMove = null;
let aiTimer;
let toastTimer;
let soundEnabled = true;
let animateBattles = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let sessionVersion = 0;
let savedMatch = null;
const stage = createStage($("#board"), chooseSquare);

function toast(text) {
  clearTimeout(toastTimer);
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3500);
}

function modal(html) {
  $("#modal-body").innerHTML = html;
  $("#modal").showModal();
}
function closeModal() {
  $("#modal").close();
}

function refresh() {
  stage.sync(game.board());
  stage.highlight(
    selected,
    selected ? game.moves({ square: selected, verbose: true }) : [],
    lastMove,
  );
  const history = game.history({ verbose: true });
  $("#arena").dataset.phase = phase;
  $("#arena").dataset.fen = game.fen();
  $("#arena").dataset.moves = history.length;
  const whiteTurn = game.turn() === "w";
  $("#turn-icon").textContent = whiteTurn ? "♔" : "♚";
  let status =
    mode === "ai"
      ? whiteTurn
        ? "Your move, commander."
        : "The Crimson Court is thinking…"
      : `${whiteTurn ? "Ivory" : "Crimson"} to move.`;
  let instruction = `Select ${whiteTurn ? "an ivory" : "a crimson"} piece to see its legal moves.`;
  if (game.isCheck()) {
    status = `${whiteTurn ? "Ivory" : "Crimson"} is in check.`;
    instruction = "Protect your king.";
  }
  if (game.isGameOver()) {
    status = game.isCheckmate()
      ? `Checkmate. ${whiteTurn ? "Crimson" : "Ivory"} triumphs.`
      : "The battle ends in a draw.";
    instruction = game.isStalemate()
      ? "Stalemate. No legal moves remain."
      : game.isThreefoldRepetition()
        ? "Draw by threefold repetition."
        : game.isInsufficientMaterial()
          ? "Insufficient material to force checkmate."
          : "Start a new game to return to the battlefield.";
  }
  if (theatre) {
    status = `Battle theatre · ${names[theatre]}`;
    instruction = history.length
      ? "Choose another battle, or return to your match."
      : `Move ${theatrePositions[theatre].from} to ${theatrePositions[theatre].to} to watch the battle.`;
  }
  if (selected)
    instruction = `${names[game.get(selected).type]} on ${selected} · Choose a highlighted square.`;
  $("#status").textContent = status;
  $("#instruction").textContent = instruction;
  $("#opponent-label").textContent =
    mode === "ai"
      ? `Computer · ${$("#difficulty").selectedOptions[0].textContent}`
      : "Local player · Red pieces";
  $("#player-label").textContent =
    mode === "ai" ? "You · White pieces" : "Local player · White pieces";
  $("#difficulty").disabled = mode !== "ai" || phase !== "ready";
  $("#mode").disabled = phase !== "ready";
  $("#move-count").textContent =
    `MOVE ${String(Math.floor(history.length / 2) + 1).padStart(2, "0")}`;
  if (history.length) {
    $("#history").innerHTML = "";
    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";
      for (const text of [
        `${Math.floor(i / 2) + 1}.`,
        history[i].san,
        history[i + 1]?.san || "…",
      ]) {
        const span = document.createElement("span");
        span.textContent = text;
        row.append(span);
      }
      $("#history").append(row);
    }
    $("#history").scrollTop = $("#history").scrollHeight;
  } else
    $("#history").innerHTML =
      '<div class="empty-history"><span>⚔</span><p>The story is yours to write.</p><small>Your moves will be recorded here.</small></div>';
  for (const color of ["w", "b"]) {
    const captured = history
      .filter((move) => move.color !== color && move.captured)
      .map((move) => symbols[move.captured])
      .join("");
    $(`#captured-${color === "w" ? "white" : "black"}`).innerHTML =
      captured || "<span>No pieces captured</span>";
  }
  $("#undo").disabled = !history.length || phase !== "ready";
  $("#hint").disabled = phase !== "ready" || game.isGameOver() || (mode === "ai" && !whiteTurn);
  $("#new-game").disabled = phase !== "ready";
  $("#theatre").disabled = phase !== "ready";
}

function persist() {
  if (theatre) return;
  try {
    localStorage.setItem("battle-chess-match", JSON.stringify({ pgn: game.pgn(), mode }));
  } catch {
    /* Storage is optional in private browsing. */
  }
}

function evaluate() {
  if (game.isCheckmate()) return game.turn() === "b" ? -100000 : 100000;
  if (game.isDraw()) return 0;
  let score = 0;
  for (const row of game.board())
    for (const p of row)
      if (p) {
        const file = p.square.charCodeAt(0) - 97,
          rank = Number(p.square[1]) - 1;
        const center = 3.5 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5)) / 2;
        score += (p.color === "b" ? 1 : -1) * (values[p.type] + center * 8);
      }
  return score;
}

function search(depth, alpha, beta) {
  if (depth === 0 || game.isGameOver()) return evaluate();
  const maximizing = game.turn() === "b";
  let best = maximizing ? -Infinity : Infinity;
  const moves = game
    .moves({ verbose: true })
    .sort((a, b) => (values[b.captured] || 0) - (values[a.captured] || 0));
  for (const move of moves) {
    game.move(move);
    const score = search(depth - 1, alpha, beta);
    game.undo();
    best = maximizing ? Math.max(best, score) : Math.min(best, score);
    if (maximizing) alpha = Math.max(alpha, best);
    else beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function bestMove(depth) {
  const maximizing = game.turn() === "b";
  let result,
    best = maximizing ? -Infinity : Infinity;
  for (const move of game.moves({ verbose: true })) {
    game.move(move);
    const score = search(depth - 1, -Infinity, Infinity);
    game.undo();
    if (!result || (maximizing ? score > best : score < best)) {
      best = score;
      result = move;
    }
  }
  return result;
}

function scheduleComputer() {
  clearTimeout(aiTimer);
  if (mode !== "ai" || game.turn() !== "b" || game.isGameOver() || phase !== "ready") return;
  const version = sessionVersion;
  aiTimer = setTimeout(() => {
    if (version !== sessionVersion || mode !== "ai" || phase !== "ready") return;
    const move = bestMove(Number($("#difficulty").value));
    if (move) executeMove(move);
  }, 450);
}

async function executeMove(input) {
  if (phase !== "ready") return;
  const move = game.move(input);
  selected = null;
  phase = "animating";
  $("#arena").dataset.phase = phase;
  for (const id of ["undo", "hint", "new-game", "theatre", "mode", "difficulty"])
    $(`#${id}`).disabled = true;
  stage.highlight(null, [], [move.from, move.to]);
  if (move.captured && animateBattles) {
    $("#battle-title").textContent = battles[move.piece][0];
    $("#battle-subtitle").textContent =
      `${names[move.piece]} takes ${names[move.captured].toLowerCase()} · ${move.san}`;
    $("#battle-banner").hidden = false;
    $("#flip").disabled = true;
    $("#squares").inert = true;
    $("#status").textContent = battles[move.piece][0];
    $("#instruction").textContent = battles[move.piece][1];
    sound("battle", move.piece);
  } else sound("move");
  await stage.animateMove(move, move.captured && animateBattles ? 4200 : 360, () =>
    sound("impact", move.piece),
  );
  $("#battle-banner").hidden = true;
  $("#flip").disabled = false;
  $("#squares").inert = false;
  phase = "ready";
  lastMove = [move.from, move.to];
  refresh();
  persist();
  if (game.isCheckmate()) sound("victory");
  else if (game.isCheck()) sound("check");
  if (theatre)
    $("#scene-caption").textContent = "The curtain falls. Choose another battle in Battle theatre.";
  scheduleComputer();
}

function chooseSquare(square) {
  if (phase !== "ready" || game.isGameOver() || (mode === "ai" && game.turn() === "b")) return;
  unlockAudio();
  const moves = selected ? game.moves({ square: selected, verbose: true }) : [];
  const move = moves.find((candidate) => candidate.to === square);
  if (move) {
    if (move.promotion) {
      modal(
        '<h2>A new destiny</h2><p>Choose what your pawn becomes.</p><div class="promotion-options">' +
          ["q", "r", "b", "n"]
            .map(
              (type) =>
                `<button data-promote="${type}" aria-label="Promote to ${names[type]}">${symbols[type]}</button>`,
            )
            .join("") +
          "</div>",
      );
      document.querySelectorAll("[data-promote]").forEach((button) => {
        button.onclick = () => {
          closeModal();
          executeMove({ from: selected, to: square, promotion: button.dataset.promote });
        };
      });
    } else executeMove(move);
    return;
  }
  const piece = game.get(square);
  selected = piece?.color === game.turn() && square !== selected ? square : null;
  if (selected) sound("select");
  refresh();
}

function reset(fen, theatrePiece = null) {
  sessionVersion++;
  clearTimeout(aiTimer);
  if (fen) game.load(fen);
  else game.reset();
  theatre = theatrePiece;
  selected = null;
  lastMove = null;
  phase = "ready";
  $("#scene-caption").textContent = theatre
    ? "A private performance. Your move raises the curtain."
    : "Every piece has a part to play.";
  refresh();
}

$("#new-game").onclick = () => {
  modal(
    '<h2>A new battle</h2><p>Choose your opponent. Starting a new match replaces the current one.</p><div class="dialog-actions"><button class="gold-button" id="start-ai">Play the computer</button><button id="start-local">Local two player</button></div>',
  );
  for (const choice of ["ai", "local"])
    $(`#start-${choice}`).onclick = () => {
      mode = choice;
      $("#mode").value = mode;
      savedMatch = null;
      reset();
      persist();
      closeModal();
    };
};
$("#mode").onchange = (event) => {
  mode = event.target.value;
  sessionVersion++;
  clearTimeout(aiTimer);
  refresh();
  persist();
  scheduleComputer();
};
$("#difficulty").onchange = () => {
  refresh();
  scheduleComputer();
};
$("#undo").onclick = () => {
  sessionVersion++;
  clearTimeout(aiTimer);
  const wasWhite = game.turn() === "w";
  game.undo();
  if (mode === "ai" && wasWhite && game.history().length) game.undo();
  lastMove = null;
  selected = null;
  refresh();
  persist();
  scheduleComputer();
};
$("#hint").onclick = () => {
  const move = bestMove(2);
  if (!move) return;
  selected = move.from;
  refresh();
  stage.highlight(selected, [move], lastMove);
  toast(
    `${names[move.piece]} ${move.from} to ${move.to}${move.captured ? ` captures the ${names[move.captured].toLowerCase()}` : ""}.`,
  );
};
$("#flip").onclick = () => stage.flip();
$("#skip-battle").onclick = () => stage.skipBattle();
$("#sound").onclick = () => {
  unlockAudio();
  soundEnabled = !soundEnabled;
  setSound(soundEnabled);
  $("#sound").innerHTML =
    `${soundEnabled ? "♫" : "♩"} <span>Sound ${soundEnabled ? "on" : "off"}</span>`;
  $("#sound").setAttribute("aria-label", soundEnabled ? "Mute sound" : "Enable sound");
};
$("#theatre").onclick = () => {
  modal(
    '<h2>Battle theatre</h2><p>Six characters. Six ways to take the stage. Choose a piece, then make the highlighted capture on the board. Your current match is kept safe.</p><div class="theatre-grid">' +
      Object.entries(names)
        .map(
          ([type, name]) =>
            `<button class="theatre-choice" data-theatre="${type}" aria-label="Watch ${name} battle"><span>${symbols[type]}</span>${name}</button>`,
        )
        .join("") +
      '</div><div class="dialog-actions"><button id="return-match">Return to your match</button></div>',
  );
  document.querySelectorAll("[data-theatre]").forEach((button) => {
    button.onclick = () => {
      if (!theatre) savedMatch = { pgn: game.pgn(), mode };
      const type = button.dataset.theatre;
      mode = "local";
      $("#mode").value = mode;
      reset(theatrePositions[type].fen, type);
      selected = theatrePositions[type].from;
      refresh();
      closeModal();
    };
  });
  $("#return-match").onclick = returnToMatch;
};
function returnToMatch() {
  if (phase !== "ready") return;
  if (savedMatch) {
    const saved = savedMatch;
    savedMatch = null;
    reset();
    game.loadPgn(saved.pgn);
    mode = saved.mode;
    $("#mode").value = mode;
    refresh();
    scheduleComputer();
  }
  closeModal();
}
$("#play-tab").onclick = returnToMatch;
$("#how").onclick = () =>
  modal(
    "<h2>The art of battle</h2><p>Play standard chess with a little more theatre. Select one of your pieces, then choose a highlighted square. Ivory moves first. A gold dot marks a legal move; a copper ring marks a capture.</p><h3>Know your court</h3><p>Pawns advance one square, or two on their first move, and capture diagonally. Rooks travel straight, bishops diagonally, and queens both. Knights jump in an L. Kings move one square and must never move into check.</p><h3>The old rules still apply</h3><p>Castling, en passant, all four promotion choices, checkmate, stalemate, repetition, and the fifty-move rule are supported. Win by checkmating the opposing king. Kings are not captured.</p><h3>A little assistance</h3><p>Use Hint for a suggested move, Undo to take back a turn, or Rotate view to see the other side. Battle theatre offers six ready-to-play captures without losing your match. Your match is saved in this browser.</p>",
  );
$("#settings").onclick = () => {
  modal(
    `<h2>Game settings</h2><label class="setting-row">Capture animations <input id="animations" type="checkbox" ${animateBattles ? "checked" : ""}></label><p>Cinematic duels last about four seconds. Skip or press Escape to return to the board. Reduced-motion preferences turn them off by default.</p><label class="setting-row">Load a position <input id="fen" placeholder="Paste a FEN position" aria-label="FEN position"></label><div class="dialog-actions"><button id="load-fen" class="gold-button">Load position</button></div><p id="fen-error" role="alert"></p>`,
  );
  $("#animations").onchange = (event) => {
    animateBattles = event.target.checked;
  };
  $("#load-fen").onclick = () => {
    if (phase !== "ready") {
      $("#fen-error").textContent = "Wait for the current move to finish.";
      return;
    }
    try {
      const position = new Chess($("#fen").value.trim());
      mode = "local";
      $("#mode").value = mode;
      savedMatch = null;
      reset(position.fen());
      persist();
      closeModal();
    } catch {
      $("#fen-error").textContent =
        "That position is not valid. Include both kings and all six FEN fields.";
    }
  };
};
$("#close-modal").onclick = closeModal;
$("#modal").addEventListener("click", (event) => {
  if (event.target === $("#modal")) {
    const r = $("#modal").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (phase === "animating") {
      stage.skipBattle();
      return;
    }
    selected = null;
    stage.highlight(null, [], lastMove);
  }
});
try {
  const stored = JSON.parse(localStorage.getItem("battle-chess-match"));
  if (stored?.pgn) {
    game.loadPgn(stored.pgn);
    mode = stored.mode === "local" ? "local" : "ai";
    $("#mode").value = mode;
  }
} catch {
  toast("The saved match could not be restored. A new board is ready.");
}
refresh();
scheduleComputer();
