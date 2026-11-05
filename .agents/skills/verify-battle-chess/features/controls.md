# Use controls

## Sub-features

Hints, rotation, sound and mute, animation settings, FEN validation, and a 390px layout.

## How to get to it (user POV)

Hint and Undo are below the board. Rotate view is at the top right of the board. Sound is in the
header. Game settings is in the footer.

## Driving it with Playwright

Run `npm run verify`. A hint must highlight a legal move, and a rotated board must accept input.
Mute must stop new oscillator starts. Invalid FEN must show an error without replacing the board. At
390px, the page must not overflow horizontally and a theatre capture must still work.

## Gotchas

Audio requires a user gesture. A fresh page has no active AudioContext until the player interacts.
The narrow capture uses Chromium viewport sizing, not touch emulation or a real device. The scripted
CLI has a moving pointer overlay solely for recording evidence.
