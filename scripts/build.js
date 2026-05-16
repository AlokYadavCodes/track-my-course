const fs = require("fs-extra");
const path = require("path");

const browsers = ["chrome", "firefox"];

const staticSrcDirs = ["background", "content", "pages", "shared", "styles"];

browsers.forEach((browser) => {
    const distPath = path.join("dist", browser);
    const distSrcPath = path.join(distPath, "src");

    // clean destination folder
    fs.emptyDirSync(distPath);

    // copy static src directories
    staticSrcDirs.forEach((dir) => {
        fs.copySync(path.join("src", dir), path.join(distSrcPath, dir));
    });

    // copy popup directory's dist files
    const popupDistSrc = path.join("src", "popup", "dist");
    const popupDistDest = path.join(distSrcPath, "popup");
    fs.copySync(popupDistSrc, popupDistDest);

    // copy icons directory
    fs.copySync("icons", path.join(distPath, "icons"));

    // copy the correct manifest
    const manifestSrc = path.join("manifests", `manifest.${browser}.json`);
    const manifestDest = path.join(distPath, "manifest.json");
    fs.copyFileSync(manifestSrc, manifestDest);

    console.log(`✅ ${browser} build created at ${distPath}`);
});
