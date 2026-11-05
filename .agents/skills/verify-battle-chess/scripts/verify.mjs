#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { chromium } from "playwright";

const url = process.env.VERIFY_URL || "http://localhost:5173";
const output = resolve(".amp/in/artifacts");
const results = [];
const errors = [];
const names = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };
const sources = { p: "e4", n: "e3", b: "g2", r: "d2", q: "g2", k: "e4" };
const browserDirectory = resolve(homedir(), ".agent-browser/browsers");
let executablePath = process.env.CHROME_PATH;
if (!executablePath) {
  try {
    const versions = (await readdir(browserDirectory))
      .filter((name) => /^chrome-[\d.]+$/.test(name))
      .sort();
    if (versions.length) executablePath = resolve(browserDirectory, versions.at(-1), "chrome");
  } catch {
    /* Playwright's installed browser is the fallback. */
  }
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
});
await context.addInitScript(() => {
  const NativeAudioContext = window.AudioContext;
  window.__audioEvents = [];
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      window.__audioContext = this;
      const stream = this.createMediaStreamDestination();
      window.__audioChunks = [];
      window.__recorder = new MediaRecorder(stream.stream);
      window.__recorder.ondataavailable = (event) => window.__audioChunks.push(event.data);
      window.__recorder.start();
      const makeGain = this.createGain.bind(this);
      this.createGain = () => {
        const gain = makeGain();
        const connect = gain.connect.bind(gain);
        gain.connect = (...targets) => {
          if (targets[0] === this.destination) connect(stream);
          return connect(...targets);
        };
        return gain;
      };
      const makeOscillator = this.createOscillator.bind(this);
      this.createOscillator = () => {
        const oscillator = makeOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...params) => {
          window.__audioEvents.push({
            frequency: oscillator.frequency.value,
            type: oscillator.type,
          });
          return start(...params);
        };
        return oscillator;
      };
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const cursor = document.createElement("div");
    cursor.id = "verification-pointer";
    cursor.style.cssText =
      "position:fixed;z-index:99999;width:13px;height:13px;border:2px solid #fff;border-radius:50%;background:#a8874888;pointer-events:none;left:-30px;top:-30px;box-shadow:0 0 5px #000";
    document.body.append(cursor);
    document.addEventListener("pointermove", (event) => {
      cursor.style.left = `${event.clientX - 6}px`;
      cursor.style.top = `${event.clientY - 6}px`;
    });
  });
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.setDefaultTimeout(30000);

async function click(selector) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert(box, `Missing click target ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await locator.click();
}

async function ready() {
  await page.waitForFunction(() => document.querySelector("#arena").dataset.phase === "ready");
}

async function levelRanks() {
  const offsets = await page.evaluate(() =>
    Array.from({ length: 8 }, (_, i) => {
      const left = document.querySelector(`[data-square="a${i + 1}"]`).getBoundingClientRect();
      const right = document.querySelector(`[data-square="h${i + 1}"]`).getBoundingClientRect();
      return Math.abs(left.y + left.height / 2 - right.y - right.height / 2);
    }),
  );
  assert(
    offsets.every((offset) => offset < 0.5),
    `Board ranks must be level: ${offsets}`,
  );
}

async function move(from, to) {
  await click(`[data-square="${from}"]`);
  assert.equal(
    await page.locator(`[data-square="${to}"]`).getAttribute("data-legal"),
    "true",
    `${from}-${to} must be legal`,
  );
  await click(`[data-square="${to}"]`);
  await ready();
}

async function load(fen) {
  await click("#settings");
  await page.locator("#fen").fill(fen);
  await click("#load-fen");
  await page.waitForFunction(() => !document.querySelector("#modal").open);
  await ready();
}

async function piece(square, expected) {
  assert.equal(
    await page.locator(`[data-square="${square}"]`).getAttribute("data-piece"),
    expected,
    `Piece at ${square}`,
  );
}

function pass(name, detail = "") {
  results.push({ name, passed: true, detail });
  console.log(`PASS ${name}${detail ? ` (${detail})` : ""}`);
}

try {
  await page.goto(url);
  await ready();
  assert.equal(await page.locator(".square-hit").count(), 64);
  assert.equal(await page.locator('.square-hit:not([data-piece=""])').count(), 32);
  await levelRanks();
  await page.screenshot({ path: resolve(output, "battle-desktop.png") });
  pass("initial board", "64 squares, 32 characters");
  if (process.argv.includes("--doctor")) {
    assert.equal(errors.length, 0);
    pass("doctor", "app ready, no JavaScript errors");
  } else {
    await page.locator("#mode").selectOption("local");
    await click('[data-square="e2"]');
    assert.equal(await page.locator('[data-square="e5"]').getAttribute("data-legal"), "false");
    await click('[data-square="e5"]');
    await piece("e2", "wp");
    await piece("e5", "");
    pass("illegal move rejected");
    await move("e2", "e4");
    await page.reload();
    await ready();
    await piece("e4", "wp");
    await click("#undo");
    await piece("e2", "wp");
    pass("move, saved match reload, undo");
    await click("#hint");
    assert((await page.locator('[data-legal="true"]').count()) > 0);
    await page.screenshot({ path: resolve(output, "battle-hint.png") });
    pass("hint highlights a legal move");
    await click("#flip");
    await levelRanks();
    await move("d2", "d4");
    await piece("d4", "wp");
    await click("#flip");
    pass("rotated board input");
    const matchBefore = await page.locator("#arena").getAttribute("data-fen");
    for (const [type, name] of Object.entries(names)) {
      await click("#theatre");
      await click(`[data-theatre="${type}"]`);
      await piece(sources[type], `w${type}`);
      assert.equal(await page.locator('[data-square="d5"]').getAttribute("data-legal"), "true");
      const beforeAudio = await page.evaluate(() => window.__audioEvents.length);
      await page.evaluate(() => {
        window.__captureDuration = null;
        window.__captureStart = null;
        let start;
        const arena = document.querySelector("#arena");
        const observer = new MutationObserver(() => {
          if (arena.dataset.phase === "animating") {
            start = performance.now();
            window.__captureStart = {
              bannerVisible: !document.querySelector("#battle-banner").hidden,
              controlsLocked: document.querySelector("#new-game").disabled,
            };
          } else if (start) {
            window.__captureDuration = performance.now() - start;
            observer.disconnect();
          }
        });
        observer.observe(arena, { attributes: true, attributeFilter: ["data-phase"] });
      });
      await click('[data-square="d5"]');
      await ready();
      assert.deepEqual(await page.evaluate(() => window.__captureStart), {
        bannerVisible: true,
        controlsLocked: true,
      });
      const duration = Math.round(await page.evaluate(() => window.__captureDuration));
      assert(duration >= 2000 && duration <= 5000, `Capture duration ${duration}ms`);
      await piece("d5", `w${type}`);
      await piece(sources[type], "");
      await page.screenshot({ path: resolve(output, `capture-result-${type}.png`) });
      assert.match(await page.locator("#history").textContent(), /x/);
      assert(
        (await page.evaluate(() => window.__audioEvents.length)) > beforeAudio,
        "Capture must synthesize sound",
      );
      pass(`${name} capture`, `${duration}ms, victim removed, history and sound produced`);
    }
    await click("#theatre");
    await click("#return-match");
    assert.equal(await page.locator("#arena").getAttribute("data-fen"), matchBefore);
    pass("theatre preserves original match");
    await click("#theatre");
    await click('[data-theatre="p"]');
    await click("#new-game");
    await click("#start-local");
    await move("c2", "c4");
    await click("#play-tab");
    await piece("c4", "wp");
    await piece("d4", "");
    await page.reload();
    await ready();
    await piece("c4", "wp");
    await piece("d4", "");
    pass("new game discards the theatre snapshot and persists the replacement match");
    await load("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    await move("e1", "g1");
    await piece("g1", "wk");
    await piece("f1", "wr");
    await piece("h1", "");
    await move("e8", "c8");
    await piece("c8", "bk");
    await piece("d8", "br");
    pass("both sides castle, king and rook move");
    await load("7k/8/8/3pP3/8/8/8/K7 w - d6 0 2");
    await move("e5", "d6");
    await piece("d6", "wp");
    await piece("d5", "");
    pass("en passant removes the bypassed pawn");
    await load("7k/8/3r4/8/8/3Q4/8/K7 b - - 0 1");
    await move("d6", "d3");
    await piece("d3", "br");
    await piece("d6", "");
    pass("Crimson capture removes an ivory piece");
    for (const type of ["q", "r", "b", "n"]) {
      await load("7k/P7/8/8/8/8/8/7K w - - 0 1");
      await click('[data-square="a7"]');
      await click('[data-square="a8"]');
      await click(`[data-promote="${type}"]`);
      await ready();
      await piece("a8", `w${type}`);
    }
    pass("all four promotion choices");
    await click("#new-game");
    await click("#start-local");
    for (const [from, to] of [
      ["f2", "f3"],
      ["e7", "e5"],
      ["g2", "g4"],
      ["d8", "h4"],
    ])
      await move(from, to);
    assert.match(await page.locator("#status").textContent(), /Checkmate.*Crimson/);
    await click('[data-square="a2"]');
    assert.equal(await page.locator('[data-legal="true"]').count(), 0);
    pass("complete game to checkmate and no moves after game over");
    await load("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
    assert.match(await page.locator("#instruction").textContent(), /Stalemate/);
    pass("stalemate recognized");
    await load("7k/8/8/8/8/8/8/K7 w - - 0 1");
    assert.match(await page.locator("#instruction").textContent(), /Insufficient material/);
    pass("insufficient material draw");
    await click("#settings");
    await page.locator("#fen").fill("not a chess position");
    await click("#load-fen");
    assert.match(await page.locator("#fen-error").textContent(), /not valid/);
    await click("#close-modal");
    pass("invalid FEN rejected without losing board");
    for (const difficulty of ["1", "2", "3"]) {
      await click("#new-game");
      await click("#start-ai");
      await page.locator("#difficulty").selectOption(difficulty);
      await move("e2", "e4");
      await page.waitForFunction(
        () =>
          document.querySelector("#arena").dataset.moves === "2" &&
          document.querySelector("#arena").dataset.phase === "ready",
      );
      assert.match(await page.locator("#status").textContent(), /Your move/);
      await click("#undo");
      await piece("e2", "wp");
      assert.equal(await page.locator("#arena").getAttribute("data-moves"), "0");
      pass(`computer level ${difficulty} makes legal reply, undo takes back full turn`);
    }
    await load("7k/8/8/8/8/8/7p/K7 b - - 0 1");
    await page.locator("#mode").selectOption("ai");
    await page.waitForFunction(
      () =>
        document.querySelector("#arena").dataset.moves === "1" &&
        document.querySelector("#arena").dataset.phase === "ready",
    );
    await click("#undo");
    await page.waitForFunction(
      () =>
        document.querySelector("#arena").dataset.moves === "1" &&
        document.querySelector("#arena").dataset.phase === "ready",
    );
    assert.equal((await page.locator("#arena").getAttribute("data-fen")).split(" ")[1], "w");
    pass("undo reschedules the computer from a Black-to-move starting position");
    await click("#new-game");
    await click("#start-local");
    await page.locator('[data-square="b1"]').focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-square="c3"]').focus();
    await page.keyboard.press("Enter");
    await ready();
    await piece("c3", "wn");
    await click("#undo");
    pass("keyboard selection and move");
    const audioState = await page.evaluate(() => window.__audioContext.state);
    assert.equal(audioState, "running");
    await click("#sound");
    const mutedCount = await page.evaluate(() => window.__audioEvents.length);
    await click('[data-square="b1"]');
    assert.equal(await page.evaluate(() => window.__audioEvents.length), mutedCount);
    await click("#sound");
    pass("audio running and mute suppresses effects");
    const audio = await page.evaluate(
      () =>
        new Promise((resolve) => {
          window.__recorder.onstop = async () => {
            const buffer = await new Blob(window.__audioChunks, {
              type: "audio/webm",
            }).arrayBuffer();
            let binary = "";
            for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
            resolve(btoa(binary));
          };
          window.__recorder.stop();
        }),
    );
    await writeFile(resolve(output, "game-audio.webm"), Buffer.from(audio, "base64"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await levelRanks();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "No narrow viewport horizontal overflow",
    );
    await page.screenshot({ path: resolve(output, "battle-mobile.png"), fullPage: true });
    await click("#theatre");
    await click('[data-theatre="p"]');
    await click('[data-square="d5"]');
    await ready();
    await piece("d5", "wp");
    pass("390px layout and capture input");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await click("#theatre");
    await click("#return-match");
    await click("#new-game");
    await click("#start-local");
    await page.screenshot({ path: resolve(output, "battle-desktop.png") });
    assert.deepEqual(errors, [], "No browser JavaScript exceptions");
    pass("no browser JavaScript errors");
  }
  await writeFile(
    resolve(output, "verification.json"),
    JSON.stringify({ url, passed: true, results, errors }, null, 2),
  );
  console.log(`\n${results.length} checks passed. Evidence in ${output}`);
} catch (error) {
  await page.screenshot({ path: resolve(output, "verification-failure.png") }).catch(() => {});
  await writeFile(
    resolve(output, "verification.json"),
    JSON.stringify({ passed: false, results, errors, failure: String(error) }, null, 2),
  );
  throw error;
} finally {
  await context.close();
  const video = await page.video()?.path();
  if (video) console.log(`Video: ${video}`);
  await browser.close();
}
