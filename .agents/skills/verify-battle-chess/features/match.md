# Play a match

## Sub-features

Legal moves, computer replies, local two-player mode, castling, en passant, promotion, checkmate,
stalemate, insufficient material, reload persistence, and undo.

## How to get to it (user POV)

Open the game. Select an ivory character, then a highlighted destination. Use New game to choose a
computer or local opponent. Use Game settings to load a FEN position.

## Driving it with Playwright

Run `npm run verify`. The script clicks `[data-square="e2"]` then `[data-square="e4"]`. For local
checkmate it plays `f3 e5 g4 Qh4#`. Expect the status to name Crimson as the winner. Castling must
move both the king and rook. En passant must remove the pawn off the destination. Promotion must
offer queen, rook, bishop, and knight. Undo against the computer removes both plies.

## Gotchas

Kings are not captured under chess rules. A checkmated king remains on its square. AI search runs on
the main thread and the strongest level can briefly delay the UI. FEN loading starts a local game.
The verifier covers draw examples, not every possible draw sequence.
