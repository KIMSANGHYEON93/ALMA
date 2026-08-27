/**
 * VIVARA Phase 1 Playwright Smoke Audit
 * - Logs in as test1@alma.com
 * - Visits all major routes
 * - Captures console errors/warnings, page errors, network failures
 * - Takes screenshot per route
 * - Writes JSON report to /tmp/vivara-audit/phase1/playwright-smoke/report.json
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT_DIR = "/tmp/vivara-audit/phase1/playwright-smoke";
const SHOTS_DIR = path.join(OUT_DIR, "screenshots");
const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:8000";
const EMAIL = process.env.AUDIT_EMAIL || "test1@alma.com";
const PASSWORD = process.env.AUDIT_PASSWORD || "testpass123";

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
  { name: "ontology-import", url: "/ontology/import", requiresAuth: true },
  { name: "ontology-insights", url: "/ontology/insights", requiresAuth: true },
  { name: "ontology-automations", url: "/ontology/automations", requiresAuth: true },
];

/**
 * 개발 환경 노이즈 필터 — Next.js RSC 프리페치가 네비게이션 전환에서
 * 항상 ERR_ABORTED로 끝나는 것은 실제 에러가 아니므로 제외한다.
 */
function isNoiseRequest(url, failure) {
  if (url.includes("_rsc=")) return true; // RSC prefetch abort
  if (url.includes("webpack.hot-update")) return true; // HMR
  if (failure && /aborted/i.test(failure)) {
    // Abort from our own cleanup — not a real error
    return true;
  }
  return false;
}

function isNoiseConsole(text) {
  if (!text) return false;
  if (text.includes("Failed to fetch RSC payload")) return true;
  if (text.includes("Fast Refresh")) return true;
  if (text.includes("webpack-internal")) return true;
  return false;
}

function attachListeners(page, bucket) {
  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if ((type === "error" || type === "warning") && !isNoiseConsole(text)) {
      bucket.console.push({ type, text });
    }
  });
  page.on("pageerror", (err) => {
    bucket.pageErrors.push(String(err && err.message ? err.message : err));
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure() ? req.failure().errorText : null;
    if (isNoiseRequest(req.url(), failure)) return;
    bucket.requestFailed.push({
      url: req.url(),
      method: req.method(),
      failure,
    });
  });
  page.on("response", async (res) => {
    const status = res.status();
    if (status >= 400 && res.url().startsWith(API_URL)) {
      let body = "";
      try {
        body = await res.text();
      } catch {}
      bucket.httpErrors.push({
        url: res.url(),
        status,
        body: body.slice(0, 300),
      });
    }
  });
}

async function loginViaApi(page) {
  const res = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
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
  return access_token;
}

(async () => {
  const start = Date.now();
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    routes: [],
    summary: {
      totalRoutes: ROUTES.length,
      routesWithErrors: 0,
      totalConsoleErrors: 0,
      totalPageErrors: 0,
      totalRequestFailed: 0,
      totalHttpErrors: 0,
    },
  };

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await loginViaApi(page);
  } catch (e) {
    report.loginError = String(e);
    console.error("LOGIN ERROR:", e);
  }

  for (const route of ROUTES) {
    const bucket = {
      name: route.name,
      url: route.url,
      console: [],
      pageErrors: [],
      requestFailed: [],
      httpErrors: [],
      status: "ok",
      loadMs: 0,
      finalUrl: null,
    };
    attachListeners(page, bucket);
    const t0 = Date.now();
    try {
      await page.goto(`${BASE_URL}${route.url}`, {
        waitUntil: "load",
        timeout: 15000,
      });
      // Let hydration + initial data fetches settle
      await page.waitForTimeout(1500);
      bucket.finalUrl = page.url();
      await page.screenshot({
        path: path.join(SHOTS_DIR, `${route.name}.png`),
        fullPage: true,
      });
    } catch (e) {
      bucket.status = "navigation-failed";
      bucket.pageErrors.push(String(e && e.message ? e.message : e));
    }
    bucket.loadMs = Date.now() - t0;
    page.removeAllListeners("console");
    page.removeAllListeners("pageerror");
    page.removeAllListeners("requestfailed");
    page.removeAllListeners("response");

    if (
      bucket.console.length ||
      bucket.pageErrors.length ||
      bucket.requestFailed.length ||
      bucket.httpErrors.length ||
      bucket.status !== "ok"
    ) {
      report.summary.routesWithErrors++;
    }
    report.summary.totalConsoleErrors += bucket.console.length;
    report.summary.totalPageErrors += bucket.pageErrors.length;
    report.summary.totalRequestFailed += bucket.requestFailed.length;
    report.summary.totalHttpErrors += bucket.httpErrors.length;
    report.routes.push(bucket);

    console.log(
      `[${route.name}] ${bucket.loadMs}ms  console=${bucket.console.length}  pageErr=${bucket.pageErrors.length}  reqFail=${bucket.requestFailed.length}  http4xx5xx=${bucket.httpErrors.length}  final=${bucket.finalUrl}`
    );
  }

  await browser.close();
  report.durationMs = Date.now() - start;
  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(`\n=== DONE in ${report.durationMs}ms ===`);
  console.log(
    `Routes with errors: ${report.summary.routesWithErrors}/${report.summary.totalRoutes}`
  );
  console.log(
    `Console: ${report.summary.totalConsoleErrors}  PageErr: ${report.summary.totalPageErrors}  ReqFail: ${report.summary.totalRequestFailed}  HTTP4xx/5xx: ${report.summary.totalHttpErrors}`
  );
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
