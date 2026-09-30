# Cartouche

A modern, high-performance desktop Geographic Information System (GIS) application built with Electron. Designed as an agile, web-tech-powered alternative to traditional desktop GIS tools like QGIS.

## Getting Started

### Downloading a Packaged Release

Pre-built binary desktop packages for Linux and Windows are available on the [GitHub Releases](https://github.com/CoryAlbrecht/cartouche/releases) page.

#### Prerequisites for Packaged Releases

- **Linux (`.deb` / `.rpm`)**: Standard desktop GUI runtime libraries (`libgtk-3-0` / `gtk3`, `libnss3`, `libasound2`, `libnotify4`, `libxss1`). Installing via your package manager (`apt` / `dnf`) automatically resolves any missing dependencies.
- **Windows (`.msi` / `.exe`)**: Microsoft Visual C++ 2015–2022 Redistributable (`x64`).

#### Installation & Launch Instructions

- **Debian / Ubuntu (`.deb`)**:

  ```bash
  sudo apt install ./cartouche_<version>_amd64.deb
  cartouche
  ```

- **Fedora / RHEL / openSUSE (`.rpm`)**:

  ```bash
  sudo dnf install ./cartouche-<version>.x86_64.rpm
  cartouche
  ```

- **Windows (`.msi` / `.exe`)**:

  Run `Cartouche-Installer.msi` or `.exe` and launch Cartouche from the Start Menu or desktop shortcut.

---

### Cloning & Building from Source (GitHub)

To set up a local development environment, build from source, or contribute to Cartouche:

#### Prerequisites for Building from Source

- **Node.js**: v20.0.0 or higher (v22+ recommended)
- **npm**: v10.0.0 or higher
- **Build Tools**: C++ compiler toolchain (`gcc`/`g++` and `make` on Linux; Visual Studio C++ Build Tools on Windows) for native module compilation (`better-sqlite3`).

#### Setup & Execution Instructions

1. **Clone the repository**:

   ```bash
   git clone https://github.com/CoryAlbrecht/cartouche.git
   cd cartouche/cartouche
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Rebuild native C++ modules**:

   ```bash
   npm run rebuild
   ```

4. **Launch in development mode**:

   ```bash
   npm start
   ```

5. **Package desktop installers**:

   ```bash
   # Compile TypeScript & Vite production assets
   npm run build

   # Package Linux installers (.deb & .rpm)
   npm run package:linux

   # Package Windows installers (.msi & NSIS .exe)
   npm run package:win
   ```
