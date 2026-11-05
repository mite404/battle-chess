---
name: verify-battle-chess
description:
  Verifies Battle Chess in a real Chromium browser. Use after chess, rendering, capture, sound, or
  layout changes, or to replay the six-piece capture gauntlet.
---

# Verify Battle Chess

## Launch

From the repository root, run `npm ci` and `npx playwright install ffmpeg`. Use the orb's installed
Chromium. Outside an orb, run `npx playwright install chromium`. Run `amp orb services ensure` in an
orb. The `web` service listens on port 5173. Outside an orb, run `npm run dev -- --port 5173` in a
separate terminal. The ready state has 64 square buttons and 32 pieces, not merely a successful HTTP
response.

## Doctor

Run `npm run verify -- --doctor`. Expect `PASS doctor` and no JavaScript exceptions. The doctor
launches an isolated browser with empty storage. It does not change an existing match. Set
`VERIFY_URL` to verify another instance. Set `CHROME_PATH` to choose a Chromium executable.

## Gate

Run `npm run build` before browser verification. This checks module imports and production bundling.
Run `node --check src/main.js`, `node --check src/scene.js`, and `node --check src/audio.js`. These
commands run manually. There is no CI, Git hook, type checker, or lint gate in this repository. The
application is JavaScript. A successful build does not prove legal moves or rendered output.

## Drive

Run `npm run verify`. The executable helper is `scripts/verify.mjs`, relative to this skill. The CLI
uses Playwright with Chromium, real pointer movement, and real clicks. It clicks the same square
buttons and dialogs available to a player. It never calls internal moves.

The coverage set is [the feature map](features/README.md). The default command covers all entries.
It tests all six attackers, special moves, a complete game to checkmate, AI, storage, and narrow
layout. Capture cases use Battle theatre. A preselected attacker captures the piece on `d5`. The CLI
records the actual phase transition in the browser to check the 2-5 second duration. Screenshot time
is excluded from that duration because GPU readback can take several seconds.

For manual exploration, load `using-agent-browser` and run:

```sh
agent-browser --session chess open http://localhost:5173
agent-browser --session chess set viewport 1440 1000 2
agent-browser --session chess click '[data-square="e2"]'
agent-browser --session chess click '[data-square="e4"]'
agent-browser --session chess snapshot -i
agent-browser --session chess close
```

## Evidence

The CLI writes screenshots, browser video, captured Web Audio, and `verification.json` under
`.amp/in/artifacts/`. A successful report has `passed: true`, named results, and an empty errors
array. Inspect screenshots and the video before claiming visual correctness. The cursor in the video
follows real pointer events. Inspect `game-audio.webm` to assess the synthesized effects.

Board buttons expose `data-piece`, `data-legal`, and accessible square names. The arena exposes the
rendered position as `data-fen` and the move count as `data-moves`. Read these to assert results.
Keep all game mutations on the real UI path. Audio instrumentation records the real AudioContext
output and oscillator starts, not mocked sounds.

The six theatre cases cover attacker types, not every attacker-victim permutation. The narrow
screenshot uses desktop Chromium at 390px, not a physical mobile device. Screenshots cannot
establish parity with the original Battle Chess artwork.

## Cleanup

The helper closes its own browser in `finally`. It leaves the game service running for the player.
If you started a disposable orb service, stop only that service with `amp orb service stop web`. Use
`amp orb services ensure` to restart it. Keep `.amp/in/artifacts/` after cleanup. Browser profiles
are isolated, so two runs do not share localStorage, though they compete for GPU time. Run one full
capture gauntlet at a time in a small orb.

Use `/maintain-verification-skill` when features change to keep this map aligned with the
application.
