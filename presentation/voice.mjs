// Narrate every scene with a macOS voice, one sentence at a time, and record exact timings so
// captions (on screen and in the .srt) line up with the speech.
//   node presentation/voice.mjs            # all scenes
//   node presentation/voice.mjs s03 s10    # only scenes whose id starts with these prefixes
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { scenes } from "./storyboard.mjs";

const OUT = new URL("./output/audio/", import.meta.url).pathname;
const VOICE = process.env.VOICE || "Rishi";
const RATE = process.env.RATE || "172"; // words per minute
const LEAD = 0.7; // silence before the first sentence of a scene
const GAP = 0.4; // between sentences
const TAIL = 1.0; // after the last sentence
const CAPTION_MAX = 92; // characters per caption line pair

// Captions keep the written form; the voice gets phonetic spellings.
const SPEECH = [
  [/\/api\b/g, "slash A P I"],
  [/\/metrics\b/g, "slash metrics"],
  [/localhost:3000/g, "localhost three thousand"],
  [/₹2,40,000/g, "two lakh forty thousand rupees"],
  [/\bamd64\b/g, "A M D 64"],
  [/\barm64\b/g, "ARM 64"],
  [/\bCVEs\b/g, "C V Es"],
  [/\bSHA\b/g, "shah"],
  [/\bOIDC\b/g, "O I D C"],
  [/\bEKS\b/g, "E K S"],
  [/\bEBS\b/g, "E B S"],
  [/\bVPC\b/g, "V P C"],
  [/\bCRM\b/g, "C R M"],
  [/\bAPI\b/g, "A P I"],
  [/\bFastAPI\b/g, "Fast A P I"],
  [/\bNginx\b/g, "engine X"],
  [/\bPostgreSQL\b/g, "Postgres"],
  [/\bpytest\b/g, "pie test"],
  [/\bm7i-flex\b/g, "M 7 I flex"],
  [/\bStatefulSet\b/g, "Stateful Set"],
  [/\bServiceMonitor\b/g, "Service Monitor"],
  [/\bImagePullBackOff\b/g, "Image Pull Back Off"],
  [/\bClusterIP\b/g, "Cluster I P"],
  [/\bAWS\b/g, "A W S"],
  [/\bUI\b/g, "U I"],
  [/\bREST\b/g, "rest"],
  [/60%/g, "sixty percent"],
];
const spoken = (text) => SPEECH.reduce((t, [re, to]) => t.replace(re, to), text);

const duration = (file) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
      .toString()
      .trim(),
  );

// Split a long sentence into caption chunks at punctuation, each up to CAPTION_MAX chars.
function chunks(sentence) {
  if (sentence.length <= CAPTION_MAX) return [sentence];
  const parts = sentence.split(/(?<=[,:;.])\s+/);
  const out = [];
  let current = "";
  for (const part of parts) {
    if (current && (current + " " + part).length > CAPTION_MAX) {
      out.push(current);
      current = part;
    } else current = current ? `${current} ${part}` : part;
  }
  if (current) out.push(current);
  // A single clause can still be too long: split it on word boundaries.
  return out.flatMap((c) => {
    if (c.length <= CAPTION_MAX * 1.25) return [c];
    const words = c.split(" ");
    const half = Math.ceil(words.length / 2);
    return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
  });
}

mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
for (const scene of scenes.filter((s) => !only.length || only.some((p) => s.id.startsWith(p)))) {
  let t = LEAD;
  const files = [];
  const sentences = [];
  const captions = [];
  scene.narration.forEach((text, i) => {
    const file = `${OUT}${scene.id}-${i}.aiff`;
    execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", file, spoken(text)]);
    const d = duration(file);
    sentences.push({ text, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    const parts = chunks(text);
    const total = parts.reduce((n, p) => n + p.length, 0);
    let c = t;
    for (const p of parts) {
      const len = (d * p.length) / total;
      captions.push({ text: p, start: +c.toFixed(3), end: +(c + len).toFixed(3) });
      c += len;
    }
    files.push({ file, start: t });
    t += d + GAP;
  });
  const total = +(t - GAP + TAIL).toFixed(3);

  // Mix the sentences onto a silent track at their start times.
  const args = ["-y", "-v", "error", "-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo"];
  files.forEach(({ file }) => args.push("-i", file));
  const delays = files
    .map(({ start }, i) => `[${i + 1}:a]aresample=48000,adelay=${Math.round(start * 1000)}:all=1[a${i}]`)
    .join(";");
  const mix = `[0:a]${files.map((_, i) => `[a${i}]`).join("")}amix=inputs=${files.length + 1}:normalize=0:duration=first[out]`;
  args.push("-filter_complex", `${delays};${mix}`, "-map", "[out]", "-ac", "2", "-ar", "48000", `${OUT}${scene.id}.wav`);
  execFileSync("ffmpeg", args);

  writeFileSync(`${OUT}${scene.id}.json`, JSON.stringify({ id: scene.id, total, sentences, captions }, null, 2));
  console.log(`${scene.id.padEnd(22)} ${total.toFixed(1).padStart(5)} s  ${captions.length} captions`);
}
