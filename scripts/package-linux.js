import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// 1. Ensure electron-builder has built linux-unpacked
const unpackedDir = path.join(projectRoot, "release", "linux-unpacked");
if (!fs.existsSync(unpackedDir)) {
  console.log("==> Running electron-builder to generate linux-unpacked...");
  execSync("npx electron-builder build --linux dir", {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

// 2. Prepare staging directory
const stagingDir = path.join(projectRoot, "release", "staging");
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}

const targetShareDir = path.join(
  stagingDir,
  "usr",
  "local",
  "share",
  "cartouche"
);
const binDir = path.join(targetShareDir, "bin");
const libDir = path.join(targetShareDir, "lib");
const shareDir = path.join(targetShareDir, "share");
const appsDir = path.join(shareDir, "applications");
const iconsDir = path.join(shareDir, "icons", "hicolor", "scalable", "apps");
const sysBinDir = path.join(stagingDir, "usr", "local", "bin");
const sysAppsDir = path.join(stagingDir, "usr", "share", "applications");

const icon512Dir = path.join(shareDir, "icons", "hicolor", "512x512", "apps");
const sysIcon512Dir = path.join(
  stagingDir,
  "usr",
  "share",
  "icons",
  "hicolor",
  "512x512",
  "apps"
);

fs.mkdirSync(binDir, { recursive: true });
fs.mkdirSync(libDir, { recursive: true });
fs.mkdirSync(appsDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });
fs.mkdirSync(icon512Dir, { recursive: true });
fs.mkdirSync(sysBinDir, { recursive: true });
fs.mkdirSync(sysAppsDir, { recursive: true });
fs.mkdirSync(sysIcon512Dir, { recursive: true });

// Copy unpacked app files into /usr/local/share/cartouche/lib
console.log("==> Copying app files to /usr/local/share/cartouche/lib...");
fs.cpSync(unpackedDir, libDir, { recursive: true });

// Create launcher script in /usr/local/share/cartouche/bin/cartouche
const launcherScriptPath = path.join(binDir, "cartouche");
const launcherContent = `#!/bin/bash
exec /usr/local/share/cartouche/lib/cartouche --no-sandbox "$@"
`;
fs.writeFileSync(launcherScriptPath, launcherContent, { mode: 0o755 });

// Create convenience symlink in /usr/local/bin/cartouche -> /usr/local/share/cartouche/bin/cartouche
const sysSymlinkPath = path.join(sysBinDir, "cartouche");
if (fs.existsSync(sysSymlinkPath)) fs.unlinkSync(sysSymlinkPath);
fs.symlinkSync("/usr/local/share/cartouche/bin/cartouche", sysSymlinkPath);

// Copy logo SVG and PNG icons to hicolor icon directories
const logoSvgSrc = path.join(projectRoot, "assets", "svg", "logo.svg");
const iconPngSrc = path.join(projectRoot, "assets", "icon.png");

if (fs.existsSync(logoSvgSrc)) {
  fs.copyFileSync(logoSvgSrc, path.join(iconsDir, "cartouche.svg"));
}
if (fs.existsSync(iconPngSrc)) {
  fs.copyFileSync(iconPngSrc, path.join(icon512Dir, "cartouche.png"));
  fs.copyFileSync(iconPngSrc, path.join(sysIcon512Dir, "cartouche.png"));
}

// Create desktop entry file
const desktopContent = `[Desktop Entry]
Name=Cartouche
Exec=/usr/local/share/cartouche/bin/cartouche %U
Terminal=false
Type=Application
Icon=cartouche
StartupWMClass=cartouche
Comment=Cartouche Desktop GIS Application
Categories=Graphics;Science;Geoscience;
`;
fs.writeFileSync(path.join(appsDir, "cartouche.desktop"), desktopContent);
fs.writeFileSync(path.join(sysAppsDir, "cartouche.desktop"), desktopContent);

// Find fpm executable (system 'fpm' or electron-builder cached fpm)
let fpmPath = "";
try {
  fpmPath = execSync("which fpm", { encoding: "utf8" }).trim();
} catch {
  // Fallback to electron-builder cached fpm
  fpmPath = execSync(
    "find ~/.cache/electron-builder/fpm* -maxdepth 2 -name fpm -type f 2>/dev/null | head -n 1",
    { encoding: "utf8" }
  ).trim();
}

if (!fpmPath || !fs.existsSync(fpmPath)) {
  console.log(
    "==> fpm not found, downloading electron-builder fpm dependency..."
  );
  try {
    execSync("npx electron-builder build --linux deb", {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } catch {
    // Ignore build errors if deb target incomplete; we only need fpm download
  }
  fpmPath = execSync(
    "find ~/.cache/electron-builder/fpm* -maxdepth 2 -name fpm -type f 2>/dev/null | head -n 1",
    { encoding: "utf8" }
  ).trim();
}

if (!fpmPath || !fs.existsSync(fpmPath)) {
  throw new Error(
    "fpm executable not found. Please install fpm (gem install fpm) or install system dependencies."
  );
}

const pkgVersion =
  JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"))).version
  || "0.1.0";
const releaseDir = path.join(projectRoot, "release");

// Build .deb package
console.log("==> Building .deb package with fpm...");
const debCmd = `"${fpmPath}" -s dir -t deb -n cartouche -v "${pkgVersion}" \
  -m "Cory Albrecht <cory@hanfastolfe.com>" \
  --description "Cartouche Desktop GIS Application" \
  --license MIT \
  --category "Graphics;Science;Geoscience" \
  -d "libgtk-3-0" -d "libnotify4" -d "libnss3" -d "libxss1" -d "libasound2" -d "libc6" \
  -p "${path.join(releaseDir, `cartouche_${pkgVersion}_amd64.deb`)}" \
  --force \
  -C "${stagingDir}" .`;
execSync(debCmd, { stdio: "inherit" });

// Build .rpm package
console.log("==> Building .rpm package with fpm...");
const rpmCmd = `"${fpmPath}" -s dir -t rpm -n cartouche -v "${pkgVersion}" \
  -m "Cory Albrecht <cory@hanfastolfe.com>" \
  --description "Cartouche Desktop GIS Application" \
  --license MIT \
  --category "Graphics;Science;Geoscience" \
  -d "gtk3" -d "libnotify" -d "nss" -d "libXScrnSaver" -d "alsa-lib" -d "glibc" \
  -p "${path.join(releaseDir, `cartouche-${pkgVersion}.x86_64.rpm`)}" \
  --force \
  -C "${stagingDir}" .`;
execSync(rpmCmd, { stdio: "inherit" });

console.log("==> Packaging complete! Output files generated in release/:");
console.log(
  `    - ${path.join(releaseDir, `cartouche_${pkgVersion}_amd64.deb`)}`
);
console.log(
  `    - ${path.join(releaseDir, `cartouche-${pkgVersion}.x86_64.rpm`)}`
);
