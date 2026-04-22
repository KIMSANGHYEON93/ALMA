const fs = require("fs");
const path = require("path");

const dir = path.resolve(__dirname, "audit-reports");
const files = fs.readdirSync(dir).filter((f) => f.startsWith("a11y-report-")).sort();
const latest = files[files.length - 1];
const r = JSON.parse(fs.readFileSync(path.join(dir, latest), "utf8"));

for (const route of r.routes) {
  if (!route.violations.length) continue;
  console.log(`\n=== ${route.name} (${route.url}) ===`);
  for (const v of route.violations) {
    console.log(`  ${v.id} [${v.impact}] nodeCount=${v.nodeCount}`);
    v.nodes.forEach((n, i) => {
      console.log(`    #${i + 1} target: ${JSON.stringify(n.target)}`);
      console.log(`        html: ${n.html.slice(0, 160)}`);
      console.log(`        failure: ${n.failureSummary.replace(/\n/g, " | ").slice(0, 220)}`);
    });
  }
}
