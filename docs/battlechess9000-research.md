# BattleChess9000 comparison

Reviewed on 2026-11-05 at upstream commit
`e4940e6576ef92c4f3a1a5808ed6697ea91c69f4`. Source inspection includes `index.html`,
`asset_generator.py`, the asset tree, two character images, and knight/rook capture videos.
The upstream multiplayer service was not exercised or audited.

Our baseline is the source archive transferred from the original Battle Chess thread, SHA-256
`9c7738b84b527ed61e0ef54fa1f28c81e50e9346b4f8402e75565a151b0924c5`. It contains a
Three.js/Vite game, chess.js rules, depth-1/2/3 minimax, procedural 3D characters, six
attacker-based captures, same-browser two-player play, and browser verification.

## The useful shortcut is offline cinematic production

Upstream puts illustrated PNGs on camera-facing planes. These are not rigged 3D characters.
Captures open an HTML video overlay selected by attacker color/type and victim type, then remove
the defeated piece and move the survivor when playback ends or the player skips. See
[piece creation][pieces], [capture flow][flow], and [video selection][video].

The generator creates a board image, then 12 piece illustrations. For each capture pairing it
composes a setup image using the board and both characters as references. The attacker is always
left and the victim right. Veo animates that setup image. Files are generated offline and served
statically during play. Gemini/Veo do not choose chess moves. See [generation][generator].

The medieval theme contains 70 MP4s totaling 336,267,413 bytes, approximately 336 MB decimal.
That count includes king-defeat cinematics, not just legal captures. The inspected knight capture
is 1280 by 720, eight seconds, and 3,036,365 bytes. Its sequence is anticipation, sword impact,
victim shattering, then a surviving attacker pose. The rook video transforms a tower into a
hammer-wielding humanoid. This is more ambitious than the current real-time golem-arm treatment.

## Do not replace our opponent with theirs

Their CPU chooses the first legal capture, otherwise a random legal move. It always promotes to a
queen. There is no search or position evaluation in [makeAIMove()][cpu]. Our alpha-beta minimax
already evaluates material and centralization and exposes three search depths. Keep it for now.

For stronger play, use a maintained engine instead of extending our search indefinitely.
[Stockfish.js][stockfish] supports browser Workers and single-threaded WASM builds that need no
cross-origin-isolation headers. It adds a WASM download, UCI command handling, cancellation, and
GPL-3.0 distribution obligations. Moving our current search to a Worker is another option if it
blocks rendering; no performance measurement was taken here.

Both games already use chess.js. Reusing their older 0.10.3 integration would not improve our
1.4.0-based rules, promotion, castling, en passant, or draw detection.

## Yes, multiplayer uses WebSockets, but its backend is absent

Their client connects to a hard-coded Google Cloud Run `wss://` endpoint. It sends login,
private-room creation/join, challenges, moves, and client-declared wins. Invite links carry
`?room=<id>`. See [connection and rooms][rooms] and [received messages][messages].

The published repository does not include the server. Server-side move validation, identity,
durability, scaling, and anti-cheat cannot be assessed from this client. There is no reusable
backend to transplant. Our baseline has local two-player play, not online multiplayer.

The client sends moves before animations finish. Each browser plays and skips its own capture
video independently. There are no move acknowledgements, sequence numbers, board reconciliation,
or animation queues. A faster opponent can reply while the other browser is still animating.
Socket closure reloads the page rather than reconnecting to the same match.

Borrow the small move payload and invite-room experience. For our online mode, a server should
validate moves and retain an ordered move history or current position. Queue accepted moves
locally while cinematics play; do not make network correctness depend on video duration.

## What saves work, and what remains difficult

- Keep our working chess rules, search, special moves, and verification. Upstream supplies no
  stronger opponent or published networking server.
- Borrow the capture presentation: close-up duel, clear wind-up, defender reaction, impact,
  destruction, recovery, and skip. Keep chess state independent of presentation.
- Reuse one consistent material palette and reference sheet for every character. Their ivory/gold
  and obsidian/silver statues explain much of the visual cohesion.
- Reuse the offline pipeline pattern: deterministic asset names, shared reference images,
  saved prompts, resume-by-output, and video compression. Improve completion validation before
  treating file existence as a finished asset.
- A prerecorded-video route removes combat rigging work, but adds downloads, generation/review
  work, character continuity problems, and a transition between board and movie.
- A real-time route preserves the actual board and characters. High-quality sculpted meshes,
  rigging, weapon contact, convincing breakage, and bespoke attacker/victim choreography remain
  substantial art/animation work. PNGs and MP4s cannot supply those 3D assets.
- Full pairing coverage grows quickly: 60 ordinary cross-color attacker/victim-type cases when
  kings are excluded as victims, plus any separate checkmate scenes. Start with six convincing
  attacker treatments and shared defender reactions, then add pair-specific exceptions.

## Reuse with attribution, not assumptions

The [Apache-2.0 license][license] permits reuse under its notice and redistribution conditions.
It does not clear original-game screenshots, third-party franchise assets, trademarks, or every
generated asset's provenance. Our implementation borrows behavior and material direction rather
than copying upstream code or media.

Source-derived hazards worth avoiding include capture cleanup at `move.to` for en passant, one
global video callback for overlapping network captures, and unescaped lobby names in `innerHTML`.
These are inspection findings, not reproduced upstream bugs.

[pieces]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L1021-L1064
[flow]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L1213-L1257
[video]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L1319-L1329
[generator]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/asset_generator.py
[cpu]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L1204-L1210
[rooms]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L868-L910
[messages]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/index.html#L920-L965
[stockfish]: https://github.com/nmrugg/stockfish.js
[license]: https://github.com/automateyournetwork/BattleChess9000/blob/e4940e6/LICENSE
