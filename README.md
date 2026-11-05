# Battle Chess

A playable homage to the animated medieval chess games of the late 1980s and early 1990s. The board
and characters are original Three.js geometry, not extracted game assets. This is not a
pixel-identical reproduction of Interplay's artwork or its 35 bespoke battles.

## Play locally

```sh
npm ci
npm run dev
```

Choose a character and then a highlighted square. Play against the computer at three search depths
or choose local two-player mode. Battle theatre offers one ready-to-play capture per character. Your
regular match survives a visit to the theatre and is saved in your browser.

## Verify the game

```sh
npx playwright install chromium ffmpeg
npm run build
npm run verify
```

The CLI expects the dev server on port 5173. Set `VERIFY_URL` to use another instance. An Amp orb's
installed Chromium is detected automatically. `CHROME_PATH` overrides browser detection. Use
`npm run verify -- --doctor` for a startup check. Full verification writes evidence to
`.amp/in/artifacts/`, including browser video, audio, screenshots, and a JSON report. The project
verification skill is `.agents/skills/verify-battle-chess/SKILL.md`.

## Implementation tasks

- [x] Inspect the repository and research Battle Chess's isometric board and character battles.
- [x] Choose the scene, chess-state, and sound boundaries before implementation.
- [x] Build a framed orthographic 3D board with original medieval figures for all six piece types.
- [x] Add legal chess, computer play, local play, and browser save restoration.
- [x] Add animated captures, original synthesized effects, hints, rotation, and undo.
- [x] Support castling, en passant, four promotion choices, checks, checkmate, and draws.
- [x] Add a six-character Battle theatre that preserves the current match.
- [x] Build a browser verification CLI and project-local verification skill.
- [x] Finish the capture gauntlet and complete browser play-test to checkmate.
- [x] Inspect desktop, narrow-screen, capture, and recorded sound evidence.

## Reference material

- [Battle Chess history and gameplay](https://en.wikipedia.org/wiki/Battle_Chess).
- [Original game description and archive](https://archive.org/details/battle_chess_1988).

Cinzel and Inter are distributed under the SIL Open Font License. Their licenses are in
`public/fonts/`. Sound effects are synthesized with Web Audio. No external services are needed to
play.
