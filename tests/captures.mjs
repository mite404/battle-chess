import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { chromium } from "playwright";

const directory = `${homedir()}/.agent-browser/browsers`;
const versions = await readdir(directory);
const chrome = versions.filter((name) => name.startsWith("chrome-")).sort().at(-1);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || `${directory}/${chrome}/chrome`,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.setDefaultTimeout(10000);

async function ready() {
  await page.waitForFunction(() => document.querySelector("#arena").dataset.phase === "ready");
}

async function battle() {
  await page.click("#theatre");
  await page.click('[data-theatre="n"]');
  await page.evaluate(() => {
    const arena = document.querySelector("#arena");
    const observer = new MutationObserver(() => {
      if (arena.dataset.phase !== "animating") return;
      window.captureControls = {
        skippable: !document.querySelector("#battle-banner").hidden,
        cameraLocked: document.querySelector("#flip").disabled,
      };
      observer.disconnect();
    });
    observer.observe(arena, { attributes: true, attributeFilter: ["data-phase"] });
  });
  const target = await page.locator('[data-square="d5"]').boundingBox();
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 60000));
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
}

try {
  await page.clock.install();
  await page.goto(process.env.VERIFY_URL || "http://localhost:5173");
  await ready();
  await battle();
  const skip = await page.locator("#skip-battle").boundingBox();
  assert(skip, "A cinematic can be skipped");
  await page.mouse.click(skip.x + skip.width / 2, skip.y + skip.height / 2);
  await page.clock.fastForward(100);
  await ready();
  assert.deepEqual(await page.evaluate(() => window.captureControls), {
    skippable: true,
    cameraLocked: true,
  });
  assert.equal(await page.locator('[data-square="d5"]').getAttribute("data-piece"), "wn");
  assert.equal(await page.locator('[data-square="e3"]').getAttribute("data-piece"), "");
  assert.equal(await page.locator(".move-row").count(), 1, "Skip commits the capture once");
  assert(!(await page.locator("#flip").isDisabled()), "Camera rotation restores after skip");
  assert(await page.locator("#skip-battle").isHidden());

  await page.clock.resume();
  await battle();
  await page.keyboard.press("Escape");
  await page.clock.fastForward(100);
  await ready();
  assert.equal(await page.locator('[data-square="d5"]').getAttribute("data-piece"), "wn");
  assert(await page.locator("#battle-banner").isHidden());

  await page.clock.resume();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await ready();
  await battle();
  assert(await page.locator("#battle-banner").isHidden(), "Reduced motion skips cinematics");
  await page.clock.fastForward(500);
  await ready();
  assert.equal(await page.locator('[data-square="d5"]').getAttribute("data-piece"), "wn");
  assert.deepEqual(errors, []);
  console.log("PASS cinematic skip, Escape, exact-once capture, control restore, reduced motion");
} finally {
  await browser.close();
}
