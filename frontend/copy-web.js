// Copies the web assets into www/ so Capacitor bundles ONLY the app
// (not node_modules / android / config). Run via:  npm run build:web
const fs = require("fs");
const path = require("path");

const root = __dirname;
const out = path.join(root, "www");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// single files
for (const f of ["index.html"]) {
  fs.copyFileSync(path.join(root, f), path.join(out, f));
}
// directories
for (const d of ["css", "js"]) {
  fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
}

console.log("✓ web assets copied to www/");
