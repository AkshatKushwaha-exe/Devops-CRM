// Record each scene with Playwright at 1920×1080, with captions drawn on the page in sync with
// the narration produced by voice.mjs.
//   RUN_URL=<actions run url> node presentation/record.mjs [scene-id-prefix ...]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chapters, scenes } from "./storyboard.mjs";
import { slideHtml, terminalHtml } from "./pages.mjs";

const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const ROOT = new URL("./", import.meta.url).pathname;
const AUDIO = `${ROOT}output/audio/`;
const SCENES = `${ROOT}output/scenes/`;
const W = 1920;
const H = 1080;
mkdirSync(SCENES, { recursive: true });

// Installed into every document of a scene's context, so captions survive navigation.
function captionRuntime({ captions, chapter }) {
  // Captions live in the browser's top layer (popover) so modal <dialog> backdrops in the app
  // cannot cover them; they are re-raised whenever a new modal opens.
  const css = `
    #__cap,#__chap{position:fixed;inset:auto;margin:0;border:0;overflow:visible;pointer-events:none}
    #__cap{left:50%;bottom:46px;transform:translateX(-50%);max-width:1500px;
      padding:14px 30px;border-radius:14px;background:rgba(12,20,16,.86);color:#fff;
      font:600 31px/1.38 "Avenir Next","Helvetica Neue",system-ui,sans-serif;text-align:center;
      box-shadow:0 6px 24px rgba(0,0,0,.25);transition:opacity .18s}
    #__chap{left:50%;top:16px;transform:translateX(-50%);padding:8px 18px;border-radius:999px;
      background:rgba(23,62,50,.92);color:#d9edbb;font:700 19px/1 "Avenir Next",system-ui,sans-serif;
      letter-spacing:.3px;box-shadow:0 4px 14px rgba(0,0,0,.18)}`;
  const mount = () => {
    if (document.getElementById("__cap")) return;
    const style = document.createElement("style");
    style.textContent = css;
    const cap = Object.assign(document.createElement("div"), { id: "__cap", popover: "manual" });
    cap.style.opacity = "0";
    const chap = Object.assign(document.createElement("div"), { id: "__chap", popover: "manual", textContent: chapter });
    document.documentElement.append(style, chap, cap);
    const raise = () => {
      for (const el of [chap, cap]) {
        try {
          if (el.matches(":popover-open")) el.hidePopover();
          el.showPopover();
        } catch {}
      }
    };
    raise();
    let modal = null;
    const tick = async () => {
      const open = document.querySelector("dialog:modal");
      if (open !== modal) {
        modal = open;
        raise();
      }
      const t0 = await window.__sceneStart();
      if (t0) {
        const t = (Date.now() - t0) / 1000;
        const c = captions.find((x) => t >= x.start && t < x.end + 0.15);
        cap.textContent = c ? c.text : "";
        cap.style.opacity = c ? "1" : "0";
      }
      setTimeout(tick, 80);
    };
    tick();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
}

async function grafanaState(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const secret = execFileSync("kubectl", [
    "--context", "devops-crm-eks", "-n", "monitoring", "get", "secret", "grafana-admin",
    "-o", "jsonpath={.data.admin-password}",
  ]).toString();
  await page.goto("http://localhost:3002/login");
  await page.locator('input[name="user"]').fill("admin");
  await page.locator('input[name="password"]').fill(Buffer.from(secret, "base64").toString());
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const GRAFANA_DASHBOARD =
  "http://localhost:3002/d/devops-crm-overview/devops-crm-service-overview?orgId=1&from=now-30m&to=now&var-namespace=crm&kiosk";

async function record(browser, scene, grafana) {
  const timing = JSON.parse(readFileSync(`${AUDIO}${scene.id}.json`, "utf8"));
  const dir = `${SCENES}${scene.id}-raw/`;
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: W, height: H } },
    storageState: grafana,
    locale: "en-IN",
  });
  let start = 0;
  await ctx.exposeBinding("__sceneStart", () => start);
  await ctx.addInitScript(captionRuntime, { captions: timing.captions, chapter: chapters[scene.id] });
  const page = await ctx.newPage();
  const created = Date.now();

  const overlay = { captions: timing.captions, chapter: chapters[scene.id] };
  // setContent does not count as a navigation, so mount the captions explicitly as well.
  const mountCaptions = () => page.evaluate(captionRuntime, overlay).catch(() => {});
  const show = async (html) => {
    await page.setContent(html, { waitUntil: "load" });
    await mountCaptions();
  };
  // Panning slides scroll for most of the narration.
  if (scene.kind === "slide") await show(slideHtml(scene.slide, { seconds: Math.max(4, timing.total - 4) }));
  else if (scene.kind === "terminal") {
    const capture = readFileSync(`${ROOT}captures/${scene.capture}.txt`, "utf8");
    await show(terminalHtml(capture, chapters[scene.id]));
  } else {
    const url = scene.url === "RUN_URL" ? process.env.RUN_URL : scene.url;
    if (!url) throw new Error(`${scene.id}: set RUN_URL`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    await mountCaptions();
  }
  await page.waitForTimeout(400);
  start = Date.now();
  if (scene.kind === "terminal") {
    const starts = timing.sentences.map((s) => s.start);
    await page.evaluate(([ms, st]) => { window.play(ms, st); }, [timing.total * 1000 - 1500, starts]);
  }

  const at = async (i) => {
    const wait = timing.sentences[i].start * 1000 - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
  };
  const helpers = {
    page,
    at,
    slide: (name) => show(slideHtml(name)),
    // Grafana keeps polling, so networkidle can stall; "load" plus a short settle is enough.
    grafana: (p) => p.goto(GRAFANA_DASHBOARD, { timeout: 10000 }).catch(() => {}),
  };
  if (scene.run) await scene.run(helpers);
  const remaining = timing.total * 1000 - (Date.now() - start);
  if (remaining > 0) await page.waitForTimeout(remaining);
  const length = (Date.now() - start) / 1000;
  const video = page.video();
  await ctx.close();
  const target = `${SCENES}${scene.id}.webm`;
  renameSync(await video.path(), target);
  const meta = { id: scene.id, offset: (start - created) / 1000, length, narration: timing.total };
  writeFileSync(`${SCENES}${scene.id}.json`, JSON.stringify(meta, null, 2));
  console.log(`${scene.id.padEnd(22)} recorded ${length.toFixed(1)} s (narration ${timing.total.toFixed(1)} s)`);
}

const only = process.argv.slice(2);
const todo = scenes.filter((s) => !only.length || only.some((p) => s.id.startsWith(p)));
const browser = await chromium.launch();
try {
  const needsGrafana = todo.some((s) => s.id.startsWith("s18"));
  const grafana = needsGrafana ? await grafanaState(browser) : undefined;
  for (const scene of todo) {
    if (!existsSync(`${AUDIO}${scene.id}.json`)) throw new Error(`run voice.mjs for ${scene.id} first`);
    await record(browser, scene, grafana);
  }
} finally {
  await browser.close();
}
