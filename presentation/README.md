# Presentation video

The capstone walkthrough video is generated from code: Playwright records real pages (the live app on EKS, GitHub Actions, GHCR, Grafana, Prometheus), slides, and terminal scenes built from real command output. A macOS voice (Rishi) narrates, and captions are drawn on screen in sync and also shipped as `.srt`/`.vtt` and an embedded subtitle track.

| File | Role |
|---|---|
| `storyboard.mjs` | 20 scenes in the rubric's demo order: narration sentences, what to show, browser actions |
| `voice.mjs` | Narrates each sentence with `say`, measures it, writes `output/audio/<scene>.{wav,json}` with caption timings |
| `capture.sh` | Runs the real commands shown in terminal scenes and saves `captures/<name>.txt` |
| `pages.mjs` | HTML for the title, architecture, AWS console, and summary slides and the terminal renderer |
| `record.mjs` | Records each scene at 1920×1080 with captions in the browser's top layer |
| `build.mjs` | Trims and encodes scenes (H.264/AAC, 30 fps), concatenates them, and writes `.mp4`, `.srt`, `.vtt` |

```bash
node presentation/voice.mjs                     # narration + timings (all scenes or prefixes)
bash presentation/capture.sh database tests docker kubernetes hpa troubleshooting
RUN_URL=<actions run url> node presentation/record.mjs [s03 s10 ...]
node presentation/build.mjs                     # → presentation/output/devops-crm-presentation.mp4
```

Requirements: macOS `say` (voice *Rishi*), ffmpeg/ffprobe, the frontend's Playwright install, `kubectl` context `devops-crm-eks`, and port-forwards to Grafana (`:3002`) and Prometheus (`:9091`) for the monitoring scene. `output/` is git-ignored.
