let context;
let enabled = true;

/** Enables or mutes synthesized game effects. */
export function setSound(value) {
  enabled = value;
}

/** Unlocks audio from a user gesture, as required by browsers. */
export function unlockAudio() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") context.resume();
}

function tone(frequency, duration, type, volume, delay = 0, endFrequency = frequency) {
  if (!enabled || !context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/** Plays an original selection, movement, magical, impact, or victory effect. */
export function sound(kind, piece = "p") {
  if (kind === "select") tone(420, 0.1, "sine", 0.04, 0, 620);
  if (kind === "move") {
    tone(130, 0.12, "triangle", 0.12, 0, 65);
    tone(190, 0.08, "sine", 0.035, 0.08);
  }
  if (kind === "battle") {
    if (piece === "q" || piece === "b") {
      [220, 330, 440, 660].forEach((f, i) => tone(f, 0.9, "sine", 0.04, i * 0.14, f * 2));
    } else {
      tone(100, 0.65, "sawtooth", 0.06, 0, 45);
      tone(250, 0.25, "triangle", 0.06, 0.3, 80);
    }
  }
  if (kind === "impact") {
    tone(piece === "r" ? 65 : 180, 0.4, "sawtooth", 0.12, 0, 30);
    tone(880, 0.22, "square", 0.035, 0, 110);
  }
  if (kind === "check") [330, 311].forEach((f, i) => tone(f, 0.3, "triangle", 0.08, i * 0.25));
  if (kind === "victory")
    [262, 330, 392, 523].forEach((f, i) => tone(f, 0.7, "triangle", 0.07, i * 0.17));
}
