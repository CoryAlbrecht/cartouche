# Cartouche

A modern, high-performance desktop Geographic Information System (GIS) application built with Electron. Designed as an agile, web-tech-powered alternative to traditional desktop GIS tools like QGIS.

## Project Structure

```
cartouche/
├── .gitignore             # Git ignore rules for node_modules, build outputs
├── package.json           # App manifest and dependency configuration
├── README.md              # Project overview and instructions
└── src/
    ├── main/
    │   ├── main.js        # Electron main process (window lifecycle, IPC)
    │   └── preload.js     # Secure context bridge between main and renderer
    └── renderer/
        ├── index.html     # GIS workbench layout (layers panel, map canvas, inspector)
        ├── styles.css     # Modern dark desktop GIS workstation theme
        └── renderer.js    # UI interactivity and coordinate tracking
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

From within the `cartouche` directory, install dependencies:

```bash
npm install
```

### Running the Application

To launch the desktop application in development mode:

```bash
npm start
```
