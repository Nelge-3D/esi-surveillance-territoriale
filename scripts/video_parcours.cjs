// Enregistre une vidéo d'environ une minute du parcours utilisateur d'ESI.
// Le navigateur est piloté automatiquement ; des sous-titres et un curseur sont ajoutés à l'écran.
//
// Usage : node scripts/video_parcours.cjs <dossier de sortie> [url] [chemin de chrome.exe]
// Nécessite le paquet playwright-core et le ffmpeg de Playwright (npx playwright install ffmpeg).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const outDir = process.argv[2] || "docs";
const url = process.argv[3] || "https://esi-surveillance-territoriale.vercel.app/";
const executablePath = process.argv[4] || undefined;
const SIZE = { width: 1280, height: 720 };

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath, channel: executablePath ? undefined : "chrome" });
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: outDir, size: SIZE },
    locale: "fr-FR",
    // Position de l'agriculteur : dans la zone pilote, près d'Essassa.
    geolocation: { latitude: 0.415, longitude: 9.635, accuracy: 12 },
    permissions: ["geolocation"],
  });
  const started = Date.now();
  const page = await context.newPage();
  const wait = ms => page.waitForTimeout(ms);

  await page.goto(url, { waitUntil: "networkidle" });

  // Sous-titres et curseur visibles dans la vidéo.
  await page.addStyleTag({ content: `
    #v-caption{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;max-width:980px;padding:12px 22px;border-radius:12px;background:#0b1f16e8;color:#fff;font:600 21px/1.35 "Segoe UI",Arial,sans-serif;text-align:center;box-shadow:0 6px 24px #0006;transition:opacity .35s}
    #v-cursor{position:fixed;z-index:100000;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#ffd54a;border:3px solid #fff;box-shadow:0 0 0 2px #0008;pointer-events:none;transition:transform .15s}
    #v-cursor.down{transform:scale(1.9);background:#ff8a3d}` });
  await page.evaluate(() => {
    const caption = Object.assign(document.createElement("div"), { id: "v-caption" });
    const cursor = Object.assign(document.createElement("div"), { id: "v-cursor" });
    cursor.style.left = "640px"; cursor.style.top = "600px";
    document.body.append(caption, cursor);
    document.addEventListener("mousemove", e => { cursor.style.left = e.clientX + "px"; cursor.style.top = e.clientY + "px"; }, true);
    document.addEventListener("mousedown", () => cursor.classList.add("down"), true);
    document.addEventListener("mouseup", () => setTimeout(() => cursor.classList.remove("down"), 220), true);
  });
  const say = text => page.evaluate(t => { document.getElementById("v-caption").textContent = t; }, text);
  const click = async (locator, pause = 300) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    await wait(pause);
    await page.mouse.down(); await wait(90); await page.mouse.up();
  };
  const hover = async (locator, steps = 30) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  };

  // Plan 1 - accueil (0:00 à 0:07)
  const intro = (Date.now() - started) / 1000; // durée du chargement, à couper au montage
  await say("E.S.I, Earth Surface Intelligence : la surveillance territoriale propulsée par NISAR et les SIG.");
  await wait(4200);
  await click(page.locator(".m-welcome-actions button").first());
  await wait(1500);

  // Plan 2 - Orus analyse (0:07 à 0:17)
  await say("Orus, notre agent d'analyse radar, compare trois images NISAR et repère les pertes de couvert.");
  await click(page.getByRole("button", { name: "Lancer Orus" }));
  await page.locator(".m-list button").first().waitFor({ timeout: 15000 });
  await wait(1200);

  // Plan 3 - zones classées et légende (0:17 à 0:25)
  await say("Il classe chaque zone : à surveiller, à vérifier, confirmée sur le terrain.");
  await hover(page.locator(".m-list button").nth(0));
  await wait(1000);
  await hover(page.locator(".m-list button").nth(1));
  await wait(900);
  await hover(page.locator(".m-legend"), 30);
  await wait(2300);

  // Plan 4 - zone prioritaire, vue radar puis vue réelle (0:25 à 0:38)
  await say("L'écogarde ouvre la zone prioritaire, compare la vue radar et la vue réelle...");
  await click(page.getByRole("button", { name: /Ouvrir la zone prioritaire/ }));
  await wait(2600);
  await click(page.getByRole("button", { name: "Vue réelle (Esri)" }));
  await wait(2300);
  await click(page.getByRole("button", { name: "Vue radar NISAR" }));
  await wait(1200);
  await say("... et consulte le score de suspicion avant de se rendre sur place.");
  await hover(page.locator(".m-side .m-card").first());
  await page.mouse.wheel(0, 520);
  await wait(2400);

  // Plan 5 - scanner ma plantation (0:38 à 0:52)
  await say("L'agriculteur enregistre sa position. Orus scanne 5 et 20 kilomètres autour de sa plantation.");
  await click(page.getByRole("button", { name: "Protection des plantations" }));
  await wait(1200);
  await click(page.getByRole("button", { name: "Scanner ma position" }));
  await page.locator(".m-vig").waitFor({ timeout: 15000 });
  await wait(2800);

  // Plan 6 - risque et détection (0:52 à 1:00)
  await say("Il détecte les migrations d'éléphants et indique si la plantation est en zone à risque.");
  await hover(page.locator(".m-vig"));
  await wait(2000);
  await click(page.locator(".m-eleph.near").first());
  await wait(3400);
  await say("E.S.I - Earth Surface Intelligence");
  await wait(1400);

  const video = page.video();
  await context.close();
  const target = path.join(outDir, "ESI-parcours-utilisateur.webm");
  fs.rmSync(target, { force: true });
  fs.renameSync(await video.path(), target);
  await browser.close();
  console.log("intro", intro.toFixed(2));
  console.log("ok", target, Math.round(fs.statSync(target).size / 1024) + " Ko");
})().catch(error => { console.error(error); process.exit(1); });
