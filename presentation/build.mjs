// Assemble the recorded scenes and narration into the final video with captions.
//   node presentation/build.mjs   → presentation/output/devops-crm-presentation.{mp4,srt,vtt}
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { scenes } from "./storyboard.mjs";

const OUT = new URL("./output/", import.meta.url).pathname;
const CLIPS = `${OUT}clips/`;
mkdirSync(CLIPS, { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
const probe = (file) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])
      .toString()
      .trim(),
  );

const stamp = (s, sep) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor(ms / 60000) % 60).padStart(2, "0");
  const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${h}:${m}:${sec}${sep}${String(ms % 1000).padStart(3, "0")}`;
};

const list = [];
const cues = [];
let offset = 0;
for (const scene of scenes) {
  const meta = `${OUT}scenes/${scene.id}.json`;
  if (!existsSync(meta)) {
    console.warn(`skipping ${scene.id}: not recorded yet`);
    continue;
  }
  const { offset: start, length } = JSON.parse(readFileSync(meta, "utf8"));
  const timing = JSON.parse(readFileSync(`${OUT}audio/${scene.id}.json`, "utf8"));
  const clip = `${CLIPS}${scene.id}.mp4`;
  ff([
    "-ss", start.toFixed(3), "-i", `${OUT}scenes/${scene.id}.webm`,
    "-i", `${OUT}audio/${scene.id}.wav`,
    "-filter_complex",
    `[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p,setpts=PTS-STARTPTS[v];` +
      `[1:a]apad,atrim=0:${length.toFixed(3)},asetpts=PTS-STARTPTS[a]`,
    "-map", "[v]", "-map", "[a]", "-t", length.toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-r", "30",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", clip,
  ]);
  const actual = probe(clip);
  for (const c of timing.captions) cues.push({ start: offset + c.start, end: offset + c.end, text: c.text });
  list.push(`file '${clip}'`);
  console.log(`${scene.id.padEnd(22)} ${actual.toFixed(1).padStart(5)} s  @ ${stamp(offset, ".")}`);
  offset += actual;
}

writeFileSync(`${CLIPS}list.txt`, list.join("\n") + "\n");
const joined = `${OUT}video-nosubs.mp4`;
ff(["-f", "concat", "-safe", "0", "-i", `${CLIPS}list.txt`, "-c", "copy", "-movflags", "+faststart", joined]);

const srt = cues.map((c, i) => `${i + 1}\n${stamp(c.start, ",")} --> ${stamp(c.end, ",")}\n${c.text}\n`).join("\n");
const vtt = "WEBVTT\n\n" + cues.map((c) => `${stamp(c.start, ".")} --> ${stamp(c.end, ".")}\n${c.text}\n`).join("\n");
writeFileSync(`${OUT}devops-crm-presentation.srt`, srt);
writeFileSync(`${OUT}devops-crm-presentation.vtt`, vtt);

// Captions are burned into the picture during recording; also ship them as a soft track.
const final = `${OUT}devops-crm-presentation.mp4`;
ff([
  "-i", joined, "-i", `${OUT}devops-crm-presentation.srt`,
  "-map", "0", "-map", "1", "-c", "copy", "-c:s", "mov_text",
  "-metadata:s:s:0", "language=eng", "-metadata:s:s:0", "title=English",
  "-metadata", "title=DevOps CRM — capstone presentation (Akshat Kushwaha)",
  "-movflags", "+faststart", final,
]);
console.log(`\n${final}\n${(probe(final) / 60).toFixed(2)} min, ${cues.length} captions`);
