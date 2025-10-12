const fs = require("fs-extra");
const path = require("path");

// Get target browser from env variable, or build both if not set
const target = process.env.TARGET_BROWSER; // "chrome" or "firefox"
const browsers = target ? [target] : ["chrome", "firefox"];

browsers.forEach((browser) => {
    const distPath = path.join("dist", browser);

    // 1. Clean destination folder
    fs.emptyDirSync(distPath);

    // 2. Copy required directories
    fs.copySync("src", path.join(distPath, "src"));
    fs.copySync("icons", path.join(distPath, "icons"));

    // 3. Copy the correct manifest
    const manifestSrc = path.join("manifests", `manifest.${browser}.json`);
    const manifestDest = path.join(distPath, "manifest.json");
    fs.copyFileSync(manifestSrc, manifestDest);

    console.log(`✅ ${browser} build created at ${distPath}`);
});
