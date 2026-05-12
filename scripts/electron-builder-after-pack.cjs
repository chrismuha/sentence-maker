const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (process.platform !== "darwin") {
    return;
  }

  const appOutDir = context && context.appOutDir ? context.appOutDir : null;
  if (!appOutDir || !fs.existsSync(appOutDir)) {
    return;
  }

  const appBundle = path.join(appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const target = fs.existsSync(appBundle) ? appBundle : appOutDir;

  try {
    execFileSync("find", [target, "-name", "._*", "-delete"], { stdio: "ignore" });
  } catch {
    // Non-fatal; continue to xattr cleanup.
  }

  try {
    execFileSync("xattr", ["-cr", target], { stdio: "ignore" });
    console.log(`  • afterPack sanitized macOS metadata in ${target}`);
  } catch (error) {
    console.warn("  • warning: afterPack could not clear macOS metadata", error?.message || "");
  }
};
