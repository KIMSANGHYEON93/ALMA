/**
 * VIVARA A11y Audit (axe-core)
 * - Logs in via API
 * - Visits each protected route
 * - Injects axe-core and runs WCAG 2.1 AA checks
 * - Reports violations by route and by rule
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:8000";
const EMAIL = process.env.AUDIT_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;
const AXE_PATH = path.resolve(__dirname, "node_modules/axe-core/axe.min.js");

if (!EMAIL || !PASSWORD) {
  console.error("Set AUDIT_EMAIL and AUDIT_PASSWORD env vars");
  process.exit(1);
}

const ROUTES = [
  { name: "home", url: "/", requiresAuth: false },
  { name: "login", url: "/login", requiresAuth: false },
  { name: "chat", url: "/chat", requiresAuth: true },
  { name: "settings", url: "/settings", requiresAuth: true },
  { name: "goals", url: "/goals", requiresAuth: true },
  { name: "habits", url: "/habits", requiresAuth: true },
  { name: "habits-analytics", url: "/habits/analytics", requiresAuth: true },
  { name: "insights", url: "/insights", requiresAuth: true },
  { name: "knowledge", url: "/knowledge", requiresAuth: true },
  { name: "automations", url: "/automations", requiresAuth: true },
  { name: "ontology", url: "/ontology", requiresAuth: true },
  { name: "ontology-graph", url: "/ontology/graph", requiresAuth: true },
];

async function loginViaApi(page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  const { access_token, refresh_token } = await res.json();
  await page.goto(BASE_URL);
  await page.evaluate(
    ({ at, rt }) => {
      localStorage.setItem("alma_access_token", at);
      localStorage.setItem("alma_refresh_token", rt);
      document.cookie = `alma_access_token=${at}; path=/; SameSite=Lax; max-age=86400`;
    },
    { at: access_token, rt: refresh_token }
  );
}

async function runAxe(page) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    // WCAG 2.1 AA + best practice rules
    // @ts-expect-error — axe injected
    const results = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
      resultTypes: ["violations"],
    });
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 3).map((n) => ({
        target: n.target,
        html: n.html.slice(0, 200),
        failureSummary: n.failureSummary,
      })),
      nodeCount: v.nodes.length,
    }));
  });
}

(async () => {
  const report = {
    startedAt: new Date().toISOString(),
    routes: [],
    ruleFrequency: {},
    summary: { totalViolations: 0, totalNodes: 0 },
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await loginViaApi(page);
  } catch (e) {
    report.loginError = String(e);
    console.error("LOGIN ERROR:", e);
    process.exit(1);
  }

  for (const route of ROUTES) {
    const bucket = { name: route.name, url: route.url, violations: [] };
    try {
      await page.goto(`${BASE_URL}${route.url}`, {
        waitUntil: "load",
        timeout: 15000,
      });
      await page.waitForTimeout(1500); // let hydration settle
      const violations = await runAxe(page);
      bucket.violations = violations;
      const nodeTotal = violations.reduce((s, v) => s + v.nodeCount, 0);
      report.summary.totalViolations += violations.length;
      report.summary.totalNodes += nodeTotal;
      violations.forEach((v) => {
        report.ruleFrequency[v.id] = (report.ruleFrequency[v.id] || 0) + v.nodeCount;
      });
      console.log(
        `[${route.name}] violations=${violations.length} nodes=${nodeTotal}` +
          (violations.length
            ? ` :: ${violations.map((v) => `${v.id}(${v.nodeCount})`).join(", ")}`
            : "")
      );
    } catch (e) {
      bucket.error = String(e && e.message ? e.message : e);
      console.log(`[${route.name}] ERROR: ${bucket.error}`);
    }
    report.routes.push(bucket);
  }

  await browser.close();

  const outDir = path.resolve(__dirname, "../audit-reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `a11y-report-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n=== Summary ===");
  console.log(`Total unique violations across routes: ${report.summary.totalViolations}`);
  console.log(`Total affected nodes: ${report.summary.totalNodes}`);
  console.log("\nTop rules by frequency:");
  const sorted = Object.entries(report.ruleFrequency).sort((a, b) => b[1] - a[1]);
  sorted.slice(0, 15).forEach(([rule, count]) => {
    console.log(`  ${rule}: ${count}`);
  });
  console.log(`\nReport saved: ${outPath}`);
})();
