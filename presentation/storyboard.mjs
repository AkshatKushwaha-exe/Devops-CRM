// Scenes of the capstone presentation video, in order. Each scene has narration (one entry per
// sentence; Rishi reads them and the captions follow them) and one of three visual kinds:
//   slide    – HTML rendered locally
//   terminal – real command output from captures/<name>.txt, typed out on screen
//   browser  – a real page driven by Playwright; `run` can wait for a sentence with at(i)
export const APP = "http://devops-crm-471212951.ap-south-1.elb.amazonaws.com";
export const REPO = "https://github.com/AkshatKushwaha-exe/Devops-CRM";
export const GHCR = "https://github.com/AkshatKushwaha-exe/Devops-CRM/pkgs/container";

const slow = (page, y, steps = 12, pause = 90) =>
  (async () => {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, y / steps);
      await page.waitForTimeout(pause);
    }
  })();

async function typeInto(page, locator, text) {
  await locator.click();
  await locator.pressSequentially(text, { delay: 45 });
}

// GitHub run pages lazy-load job summaries behind "Load summary" buttons.
async function expandSummaries(page) {
  const buttons = page.getByRole("button", { name: "Load summary" });
  for (let i = 0; i < 20 && (await buttons.count()) > 0; i++) {
    await buttons.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function scrollToHeading(page, name) {
  await page
    .getByRole("heading", { name })
    .first()
    .evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "start" }))
    .catch(() => {});
  await page.waitForTimeout(700);
}

// Chapter labels shown in the top-left corner, matching the rubric's demo order.
export const chapters = {
  "s01-title": "DevOps CRM",
  "s02-architecture": "Architecture",
  "s03-application": "1 · Application",
  "s04-api": "2 · API",
  "s05-database": "3 · Database",
  "s06-tests": "Tests",
  "s07-docker": "6 · Docker",
  "s08-compose-browser": "6 · Docker Compose",
  "s09-commit": "4 · Git commit (live demo)",
  "s10-ci-running": "5 · CI pipeline",
  "s11-trivy": "7 · Security scan",
  "s12-ghcr": "8 · Registry",
  "s13-terraform": "9 · Terraform",
  "s14-deploy": "Continuous deployment",
  "s15-kubernetes": "10–12 · Kubernetes, Helm, Ingress",
  "s16-updated": "Deployment updated",
  "s17-autoscaling": "13 · Autoscaling",
  "s18-monitoring": "14 · Monitoring",
  "s19-troubleshooting": "15 · Troubleshooting",
  "s20-summary": "Summary",
};

export const scenes = [
  {
    id: "s01-title",
    kind: "slide",
    slide: "title",
    narration: [
      "Hi, I'm Akshat Kushwaha, and this is my DevOps capstone: DevOps CRM.",
      "It's a sales CRM that goes from a Git commit to Kubernetes on AWS, automatically.",
      "I'll walk through the application, the pipeline that tests, scans and ships it, the infrastructure it runs on, and how I monitor and troubleshoot it.",
    ],
  },
  {
    id: "s02-architecture",
    kind: "slide",
    slide: "architecture",
    narration: [
      "Here's the architecture.",
      "A React frontend served by Nginx, and a FastAPI backend, run on Amazon EKS, with PostgreSQL on an encrypted EBS volume.",
      "An AWS load balancer sends /api to the backend, and everything else to the frontend.",
      "GitHub Actions tests every change, builds and scans the images, publishes them, and deploys them with Helm. Prometheus and Grafana watch it all.",
    ],
  },
  {
    id: "s03-application",
    kind: "browser",
    url: `${APP}/#overview`,
    narration: [
      "This is the live application, running on AWS.",
      "The dashboard shows contacts, open deals, pipeline value and won revenue, all calculated by the API.",
      "I'll add a new contact, Ananya from Northwind Retail.",
      "Then I'll open a deal for her in the pipeline, worth ₹2,40,000.",
      "When I move the deal to Won, the dashboard is recalculated straight from PostgreSQL.",
    ],
    async run({ page, at }) {
      await at(1);
      await slow(page, 500, 10);
      await page.waitForTimeout(600);
      await slow(page, -500, 6);
      await at(2);
      await page.getByRole("link", { name: "Contacts", exact: true }).click();
      await page.waitForTimeout(700);
      await page.getByRole("button", { name: "Add contact", exact: true }).first().click();
      await page.getByLabel("Full name").pressSequentially("Ananya Iyer", { delay: 45 });
      await typeInto(page, page.getByLabel("Email address"), "ananya@northwind.example");
      await typeInto(page, page.getByLabel("Company", { exact: true }), "Northwind Retail");
      await page.getByRole("button", { name: "Create contact" }).click();
      await at(3);
      await page.getByRole("link", { name: "Pipeline", exact: true }).click();
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: "Add deal", exact: true }).click();
      await page.getByLabel("Deal title").pressSequentially("Analytics rollout", { delay: 45 });
      await page
        .getByRole("combobox", { name: /^Contact/ })
        .selectOption({ label: "Ananya Iyer · Northwind Retail" });
      await typeInto(page, page.getByLabel("Value (INR)"), "240000");
      await page.getByRole("button", { name: "Create deal", exact: true }).click();
      await at(4);
      await page.getByLabel("Stage for Analytics rollout").selectOption("won");
      await page.waitForTimeout(1200);
      await page.getByRole("link", { name: "Overview", exact: true }).click();
    },
  },
  {
    id: "s04-api",
    kind: "browser",
    url: `${APP}/api/docs`,
    narration: [
      "The backend is FastAPI.",
      "It has REST endpoints to create, read, update and delete contacts and deals, plus dashboard, health, readiness and metrics endpoints.",
      "In the interactive documentation, calling GET contacts returns the records we just created.",
    ],
    async run({ page, at }) {
      await page.waitForSelector(".opblock");
      await at(1);
      await slow(page, 700, 14, 110);
      await at(2);
      await slow(page, -700, 6);
      const op = page.locator(".opblock-get").filter({ hasText: "/api/contacts" }).first();
      await op.locator(".opblock-summary").click();
      await page.getByRole("button", { name: "Try it out" }).first().click();
      await page.getByRole("button", { name: "Execute" }).first().click();
      await page.waitForTimeout(800);
      await page.locator(".responses-wrapper .live-responses-table").first().scrollIntoViewIfNeeded();
    },
  },
  {
    id: "s05-database",
    kind: "terminal",
    capture: "database",
    narration: [
      "The data lives in PostgreSQL, running inside the cluster as a StatefulSet.",
      "The schema is created by Alembic migrations: here are the tables, the migration version, and the contacts we just added.",
    ],
  },
  {
    id: "s06-tests",
    kind: "terminal",
    capture: "tests",
    narration: [
      "Quality gates start with tests.",
      "37 pytest cases run against a throwaway database built by the real migrations, never the production one.",
      "10 frontend component tests and 2 Playwright browser tests cover the user flows, and Ruff and Prettier keep the code clean.",
    ],
  },
  {
    id: "s07-docker",
    kind: "terminal",
    capture: "docker",
    narration: [
      "Both services are containerized.",
      "The backend image runs as an unprivileged user on Alpine. The frontend is a multi-stage build: compiled with Node, then served by unprivileged Nginx, which also proxies /api.",
      "Docker Compose starts PostgreSQL, a one-shot migration step, the API and the UI, in order, using health checks.",
    ],
  },
  {
    id: "s08-compose-browser",
    kind: "browser",
    url: "http://localhost:3000/#overview",
    narration: ["And the whole stack is available at localhost:3000."],
    async run({ page }) {
      await page.waitForTimeout(800);
      await slow(page, 400, 8);
    },
  },
  {
    id: "s09-commit",
    kind: "terminal",
    capture: "commit",
    narration: [
      "Now the live demo.",
      "I'll change the brand accent from green to indigo: a small change in the stylesheet.",
      "I commit it, push it, and merge the pull request into main. From here, nothing is manual.",
    ],
  },
  {
    id: "s10-ci-running",
    kind: "browser",
    url: "RUN_URL",
    narration: [
      "The merge triggers GitHub Actions.",
      "Backend tests against a real PostgreSQL service, frontend tests, Playwright browser tests, and Helm and Terraform validation all run in parallel.",
      "If any of them fails, the pipeline stops here, and nothing is built or deployed.",
    ],
    async run({ page, at }) {
      await page.waitForTimeout(1500);
      await at(1);
      await page.mouse.move(1200, 600);
      await at(2);
      await page.reload();
    },
  },
  {
    id: "s11-trivy",
    kind: "slide",
    slide: "trivy",
    narration: [
      "Next, both images are built natively for amd64 and arm64, and Trivy scans every one of them.",
      "It checks the Alpine OS packages and every Python and JavaScript dependency against known CVE databases, and looks for leaked secrets.",
      "The gate fails on any high or critical finding, fixed or not.",
      "All four scans are clean. No component has a known high or critical vulnerability today, and if one is published tomorrow, the next build fails until the image or dependency is upgraded.",
    ],
  },
  {
    id: "s12-ghcr",
    kind: "browser",
    url: `${GHCR}/devops-crm-backend`,
    narration: [
      "Images that pass are published to GitHub Container Registry.",
      "They're tagged with the full commit SHA, never latest, so every deployment traces back to one exact commit.",
    ],
    async run({ page, at }) {
      await page.waitForTimeout(1000);
      await at(1);
      await slow(page, 300, 8);
    },
  },
  {
    id: "s13-terraform",
    kind: "browser",
    url: `${REPO}/blob/main/terraform/main.tf`,
    narration: [
      "The AWS infrastructure is Terraform.",
      "It builds a VPC across two availability zones, the EKS cluster, a managed node group of Free Tier m7i-flex instances, storage and load balancer integrations, and a GitHub OIDC role, so the pipeline deploys with short-lived credentials and no stored keys.",
      "Here it is in the AWS console in Mumbai: the cluster is active, with its node group, VPC and subnets.",
    ],
    async run({ page, at, slide }) {
      await page.waitForTimeout(1200);
      await slow(page, 1400, 30, 140);
      await at(2);
      await slide("console");
    },
  },
  {
    id: "s14-deploy",
    kind: "slide",
    slide: "deploy",
    narration: [
      "The last job deploys.",
      "Its AWS role can only be assumed by this repository's production environment, and inside the cluster it can only touch the crm namespace.",
      "It assumes that role, runs helm upgrade with the exact image SHA, waits for the database migration job and the rolling update, runs helm test, and finally checks through the load balancer that the new version is serving.",
    ],
  },
  {
    id: "s15-kubernetes",
    kind: "terminal",
    capture: "kubernetes",
    narration: [
      "In the cluster, two frontend and two backend pods are spread across both nodes, behind ClusterIP services.",
      "PostgreSQL runs as a StatefulSet with a persistent volume, the Ingress is backed by the load balancer, and the autoscaler is watching CPU.",
      "Helm keeps the release history, so rolling back is one command.",
    ],
  },
  {
    id: "s16-updated",
    kind: "browser",
    url: `${APP}/#overview`,
    narration: [
      "And here's the result: the live application now shows the indigo accent, and the footer shows the new build.",
      "Pods were replaced one at a time, so users saw no downtime.",
      "And if a release goes wrong, the same Deploy workflow rolls back to any previous build. I tested that too.",
    ],
    async run({ page, at }) {
      await page.waitForTimeout(1000);
      await at(1);
      await slow(page, 2000, 20, 80);
    },
  },
  {
    id: "s17-autoscaling",
    kind: "terminal",
    capture: "hpa",
    narration: [
      "To show autoscaling, I run a controlled load test inside the cluster.",
      "CPU climbs past the 60% target, and the horizontal pod autoscaler scales the API from 2 pods to 6.",
      "When the load stops, it scales back down.",
    ],
  },
  {
    id: "s18-monitoring",
    kind: "browser",
    url: "http://localhost:9091/targets?search=crm",
    narration: [
      "The backend exposes Prometheus metrics at /metrics, and a ServiceMonitor tells Prometheus to scrape every API pod. All targets are up.",
      "Four alert rules watch the error rate, latency, missing API pods, and pods stuck pulling images.",
      "Grafana turns that into a live dashboard: request rate, latency percentiles, error rate, CPU and memory per pod, and replica count.",
    ],
    async run({ page, at, grafana }) {
      await page.waitForTimeout(1200);
      await at(1);
      await page.goto("http://localhost:9091/alerts?search=crm", { timeout: 8000 }).catch(() => {});
      await at(2);
      await grafana(page);
      await page.waitForTimeout(3500);
      await slow(page, 900, 18, 120);
    },
  },
  {
    id: "s19-troubleshooting",
    kind: "terminal",
    capture: "troubleshooting",
    narration: [
      "Finally, troubleshooting, in an isolated namespace.",
      "First, a deployment with a mistyped image tag. The pods are stuck in ImagePullBackOff, and the events say the tag was not found. The fix is the real commit SHA.",
      "Second, a Service whose selector doesn't match its pods. The pods are healthy, but requests are refused because the service has no endpoints.",
      "Comparing the selector with the pod labels shows the mismatch, and a one-line patch fixes it.",
    ],
  },
  {
    id: "s20-summary",
    kind: "slide",
    slide: "summary",
    narration: [
      "So that's the full path: application, commit, pipeline, images, security scan, registry, Terraform, Kubernetes, Helm, ingress, autoscaling, monitoring and troubleshooting.",
      "After the evaluation, one script tears all of it down with terraform destroy.",
      "Thanks for watching.",
    ],
  },
];
