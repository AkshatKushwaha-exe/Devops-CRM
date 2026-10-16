// HTML for slide and terminal scenes, styled with the CRM's own palette.
import { readFileSync } from "node:fs";

const EVIDENCE = new URL("../docs/evidence/", import.meta.url).pathname;
const img = (path) => `data:image/jpeg;base64,${readFileSync(EVIDENCE + path).toString("base64")}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const base = `
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:1920px;height:1080px;overflow:hidden}
  body{font-family:"Avenir Next","Helvetica Neue",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
`;

const title = `
<style>${base}
  body{background:radial-gradient(1200px 700px at 78% 18%,#2b5e49 0%,#173e32 55%,#10291f 100%);color:#fff}
  .wrap{position:absolute;inset:0;padding:150px 160px}
  .eyebrow{color:#a8c97a;font-weight:700;letter-spacing:4px;font-size:22px}
  h1{font-size:150px;line-height:1;margin:26px 0 18px;font-weight:800;letter-spacing:-3px}
  h1 span{color:#a8c97a}
  .sub{font-size:44px;color:#d9edbb;font-weight:500}
  .who{margin-top:70px;font-size:32px;color:#e9f1e2}
  .who b{font-weight:700}
  .links{margin-top:22px;font-size:24px;color:#b8cec2;line-height:1.7}
  .stack{position:absolute;left:160px;right:160px;bottom:200px;display:flex;flex-wrap:wrap;gap:14px}
  .stack span{border:1px solid #4f7d68;color:#d9edbb;border-radius:999px;padding:10px 20px;font-size:21px;font-weight:600}
</style>
<div class="wrap">
  <div class="eyebrow">SESSION 21 · FINAL DEVOPS CAPSTONE</div>
  <h1>DevOps CRM<span>.</span></h1>
  <div class="sub">From a Git commit to Kubernetes on AWS, automatically</div>
  <div class="who"><b>Akshat Kushwaha</b></div>
  <div class="links">github.com/AkshatKushwaha-exe/Devops-CRM<br>devops-crm-471212951.ap-south-1.elb.amazonaws.com</div>
</div>
<div class="stack">${[
  "React + Vite", "FastAPI", "PostgreSQL + Alembic", "Docker", "GitHub Actions", "Trivy",
  "GHCR", "Terraform", "Amazon EKS", "Helm", "ALB Ingress", "HPA", "Prometheus", "Grafana",
].map((t) => `<span>${t}</span>`).join("")}</div>`;

const box = (title, lines, cls = "") =>
  `<div class="box ${cls}"><div class="bt">${title}</div>${lines.map((l) => `<div>${l}</div>`).join("")}</div>`;

const architecture = `
<style>${base}
  body{background:#f7f8f5;color:#263a31}
  h2{position:absolute;left:120px;top:84px;font-size:50px;font-weight:800;letter-spacing:-1px}
  h2 span{color:#5d8a4a}
  .lane{position:absolute;left:120px;right:120px;border-radius:26px;padding:24px 30px}
  .ci{top:168px;height:262px;background:#fff;border:2px solid #e3e8dc}
  .aws{top:486px;height:410px;background:#eef4e6;border:2px dashed #a8c97a}
  .lt{font-size:18px;font-weight:800;letter-spacing:3px;color:#7a8c80;margin-bottom:16px}
  .row{display:flex;gap:18px;align-items:stretch}
  .box{flex:1;background:#fff;border:2px solid #dfe6d8;border-radius:16px;padding:14px 18px;font-size:19px;line-height:1.42;color:#4b5f55}
  .box .bt{font-size:22px;font-weight:800;color:#173e32;margin-bottom:4px;white-space:nowrap}
  .dark{background:#173e32;border-color:#173e32;color:#cfe3c4}.dark .bt{color:#fff}
  .arrow{align-self:center;font-size:34px;color:#5d8a4a;font-weight:800}
  .note{position:absolute;right:150px;top:442px;font-size:20px;font-weight:700;color:#5d8a4a}
</style>
<h2>How it fits together<span>.</span></h2>
<div class="lane ci"><div class="lt">GITHUB</div><div class="row">
  ${box("Commit", ["pull request", "→ main"])}<div class="arrow">→</div>
  ${box("Tests & lint", ["pytest · vitest", "Playwright · Ruff"])}<div class="arrow">→</div>
  ${box("Images", ["backend + frontend", "amd64 + arm64"])}<div class="arrow">→</div>
  ${box("Trivy gate", ["fail on HIGH /", "CRITICAL"])}<div class="arrow">→</div>
  ${box("GHCR", ["tag = commit SHA"])}<div class="arrow">→</div>
  ${box("Deploy", ["OIDC → Helm", "migrations · checks"], "dark")}
</div></div>
<div class="note">↓ helm upgrade --install, short-lived AWS credentials</div>
<div class="lane aws"><div class="lt">AWS · AP-SOUTH-1 · TERRAFORM</div><div class="row">
  ${box("Users", ["browser on any", "device"])}<div class="arrow">→</div>
  ${box("Application Load Balancer", ["Ingress:", "/api → backend", "/ → frontend"])}<div class="arrow">→</div>
  ${box("Amazon EKS 1.36", ["2 × m7i-flex nodes", "frontend: Nginx × 2", "backend: FastAPI × 2–6 (HPA)", "migration Job per release"], "dark")}<div class="arrow">→</div>
  ${box("PostgreSQL", ["StatefulSet", "encrypted gp3 EBS", "volume"])}
</div><div class="row" style="margin-top:22px">
  ${box("VPC", ["2 AZs · public + private subnets · NAT"])}
  ${box("Observability", ["Prometheus scrapes /metrics · Grafana dashboard · alerts"])}
  ${box("Security", ["non-root images · read-only FS · namespace-scoped deploy role"])}
</div></div>`;

const steps = [
  "Application", "Git commit", "CI pipeline", "Docker images", "Security scan", "Registry",
  "Terraform", "Kubernetes", "Helm", "Ingress", "Autoscaling", "Monitoring", "Troubleshooting",
];
const summary = `
<style>${base}
  body{background:radial-gradient(1200px 700px at 80% 10%,#2b5e49 0%,#173e32 55%,#10291f 100%);color:#fff}
  h2{position:absolute;left:150px;top:110px;font-size:64px;font-weight:800;letter-spacing:-1px}
  h2 span{color:#a8c97a}
  .grid{position:absolute;left:150px;top:230px;display:grid;grid-template-columns:repeat(3,480px);gap:18px 30px}
  .s{display:flex;align-items:center;gap:16px;font-size:30px;font-weight:600;color:#e9f1e2}
  .s i{width:40px;height:40px;border-radius:50%;background:#a8c97a;color:#173e32;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:24px}
  .td{position:absolute;left:150px;right:150px;bottom:300px;background:rgba(0,0,0,.25);border-radius:18px;padding:26px 32px;font-size:27px;color:#d9edbb}
  .td code{font-family:Menlo,monospace;color:#fff;font-size:25px}
  .repo{position:absolute;left:150px;bottom:240px;font-size:24px;color:#b8cec2}
</style>
<h2>Commit to production, end to end<span>.</span></h2>
<div class="grid">${steps.map((s) => `<div class="s"><i>✓</i>${s}</div>`).join("")}</div>
<div class="td">Clean up after evaluation: <code>AWS_PROFILE=devops-crm bash scripts/teardown-aws.sh</code> &nbsp;→ helm uninstall, then <code>terraform destroy</code></div>
<div class="repo">github.com/AkshatKushwaha-exe/Devops-CRM · docs/SUBMISSION.md maps every requirement to its evidence</div>`;

const shot = (file, label) =>
  `<figure><img src="${img(file)}"><figcaption>${label}</figcaption></figure>`;
const console_ = () => `
<style>${base}
  body{background:#232f3e}
  .g{position:absolute;inset:70px 70px 150px;display:grid;grid-template-columns:1fr 1fr;gap:26px}
  figure{background:#fff;border-radius:14px;overflow:hidden;position:relative;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
  figcaption{position:absolute;left:14px;top:14px;background:#ff9900;color:#232f3e;font-weight:800;font-size:22px;padding:7px 14px;border-radius:8px}
</style>
<div class="g">
  ${shot("phase-5-aws/console-eks-cluster.jpg", "EKS cluster · Active · 1.36")}
  ${shot("phase-5-aws/console-eks-nodegroup.jpg", "Managed node group · 2 nodes")}
  ${shot("phase-5-aws/console-vpc.jpg", "VPC devops-crm · ap-south-1")}
  ${shot("phase-5-aws/console-subnets.jpg", "2 public + 2 private subnets · 2 AZs")}
</div>`;

// GitHub job summaries are only visible when signed in, so these scenes pan across
// screenshots of the live-demo run taken in the signed-in browser.
const pan = (file, caption, seconds) => `
<style>${base}
  body{background:#0d1117}
  .frame{position:absolute;left:150px;right:150px;top:84px;bottom:150px;overflow:hidden;border-radius:14px;
    border:1px solid #30363d;box-shadow:0 18px 50px rgba(0,0,0,.5);background:#0d1117}
  .frame img{width:100%;display:block;animation:pan ${seconds}s ease-in-out 1.2s forwards}
  @keyframes pan{to{transform:translateY(calc(-100% + 846px))}}
  .src{position:absolute;left:150px;top:28px;color:#8b949e;font:600 20px "Avenir Next",system-ui}
</style>
<div class="src">${caption}</div>
<div class="frame"><img src="${img(file)}"></div>`;

export function slideHtml(name, opts = {}) {
  const pages = {
    title,
    architecture,
    summary,
    console: console_(),
    trivy: pan("phase-6-cd/demo-trivy-gates-and-publish.jpg", "GitHub Actions · run 38931035243 · commit 104715a", opts.seconds ?? 18),
    deploy: pan("phase-6-cd/demo-deploy-summary.jpg", "GitHub Actions · run 38931035243 · Deploy to EKS", opts.seconds ?? 6),
  };
  if (!pages[name]) throw new Error(`unknown slide ${name}`);
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${pages[name]}</body></html>`;
}

// Capture format: "$ command" lines are typed, "# note" lines are dim comments, "@@ N" waits for
// narration sentence N to start, and everything else is output.
export function terminalHtml(text, chapter) {
  const blocks = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (/^@@ \d+$/.test(line)) blocks.push({ cmd: null, out: [], sync: Number(line.slice(3)) });
    else if (line.startsWith("$ ")) blocks.push({ cmd: line.slice(2), out: [] });
    else if (blocks.length) blocks[blocks.length - 1].out.push(line);
    else blocks.push({ cmd: null, out: [line] });
  }
  for (const b of blocks) while (b.out.length && b.out[b.out.length - 1].trim() === "") b.out.pop();
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
  body{background:linear-gradient(135deg,#0f1f18,#173e32);}
  .win{position:absolute;left:90px;right:90px;top:90px;bottom:168px;background:#0d1512;border-radius:16px;
    box-shadow:0 20px 60px rgba(0,0,0,.45);overflow:hidden;border:1px solid #2a3d33}
  .bar{height:46px;background:#1b2a23;display:flex;align-items:center;padding:0 18px;gap:10px}
  .bar i{width:14px;height:14px;border-radius:50%;display:block}
  .bar span{margin-left:16px;color:#9fb5a8;font:600 18px Menlo,monospace}
  pre{position:absolute;left:0;right:0;top:46px;bottom:0;padding:22px 30px;overflow:hidden;
    font:22px/1.42 Menlo,"SF Mono",monospace;color:#d6e2da;white-space:pre}
  .p{color:#a8c97a;font-weight:700}.c{color:#ffffff}.d{color:#6f8a7c}
  .ok{color:#8fd16a}.bad{color:#ff8a80}.warn{color:#ffd166}
  .cur{display:inline-block;width:12px;height:24px;background:#a8c97a;vertical-align:-4px;animation:b 1s steps(1) infinite}
  @keyframes b{50%{opacity:0}}
</style></head><body>
<div class="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>akshat@devops-crm — ${esc(chapter)}</span></div><pre id="t"></pre></div>
<script>
const blocks = ${JSON.stringify(blocks)};
const el = document.getElementById("t");
const esc = (s) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const color = (l) => {
  const e = esc(l);
  if (l.startsWith("# ")) return '<span class="d">'+e+'</span>';
  if (/\\b(FAILED|Error|ErrImagePull|ImagePullBackOff|not found|refused|<unset>|No resources found)\\b/.test(l)) return '<span class="bad">'+e+'</span>';
  if (/\\b(PASSED|passed|Running|Ready|Healthy|deployed|Succeeded|UP|successfully|Valid|clean|ok)\\b/.test(l)) return '<span class="ok">'+e+'</span>';
  return e;
};
let html = "";
const render = (extra = "") => { el.innerHTML = html + extra + '<span class="cur"></span>'; el.scrollTop = el.scrollHeight; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
window.play = async (totalMs, starts = []) => {
  // Split the script at "@@ N" markers; each segment ends when the next marked sentence starts
  // (the last at totalMs), and is paced against that absolute deadline.
  const t0 = performance.now();
  const segments = [[]];
  for (const b of blocks) (b.sync !== undefined ? segments.push(Object.assign([], { sync: b.sync })) : segments[segments.length - 1].push(b));
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    if (seg.sync !== undefined) { const wait = t0 + starts[seg.sync] * 1000 - performance.now(); if (wait > 0) await sleep(wait); }
    const next = segments[s + 1];
    const end = next ? t0 + starts[next.sync] * 1000 - 250 : t0 + totalMs;
    await playSegment(seg, end);
  }
  render();
};
async function playSegment(segBlocks, deadline) {
  const left = () => Math.max(0, deadline - performance.now());
  const chars = segBlocks.reduce((n, b) => n + (b.cmd ? b.cmd.length : 0), 0);
  let lines = segBlocks.reduce((n, b) => n + b.out.length, 0);
  // Commands get at most 45% of the time, between 12 and 30 ms per character.
  const typeMs = Math.max(12, Math.min(30, (left() * 0.45) / Math.max(chars, 1)));
  for (const b of segBlocks) {
    if (b.cmd) {
      let typed = "";
      const step = Math.max(1, Math.round(16 / typeMs)); // type several characters per frame when fast
      for (let i = 0; i < b.cmd.length; i += step) {
        typed = b.cmd.slice(0, i + step);
        render('<span class="p">$ </span><span class="c">'+esc(typed)+'</span>');
        await sleep(typeMs * step);
      }
      html += '<span class="p">$ </span><span class="c">'+esc(b.cmd)+'</span>\\n';
      render(); await sleep(Math.min(300, left() / 10));
    }
    for (const l of b.out) {
      html += color(l) + "\\n"; render();
      lines -= 1;
      await sleep(Math.min(240, left() / Math.max(lines + 2, 1)));
    }
    html += "\\n";
  }
}
render();
</script></body></html>`;
}
