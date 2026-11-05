# Watch captures

## Sub-features

Pawn and knight sword attacks, bishop magic, the rook's golem, queen magic, and the king's sword.
Three-second sequences lock moves while the battle plays. Captures update the board and chronicle.

## How to get to it (user POV)

Open Battle theatre. Choose a character, then click the highlighted enemy on `d5`. Open Battle
theatre again and choose Return to your match to restore the saved game.

## Driving it with Playwright

Run `npm run verify`. It chooses every `[data-theatre]` button and clicks the `d5` destination.
Expect an animated phase lasting 2-5 seconds, a capture banner, sound output, and a capture in
history. The winning piece must occupy `d5`; its source must be empty. The original match must
restore unchanged.

## Gotchas

Reduced-motion preferences turn off captures by default. Enable Capture animations in Game settings
when testing choreography. The gauntlet uses six different opponents but not all possible pairings.
Returning to a match restores chess state and opponent mode, not the prior camera orientation.
