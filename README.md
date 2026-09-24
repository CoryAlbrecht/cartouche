# Cartouche

A modern, high-performance desktop Geographic Information System (GIS) application built with Electron. Designed as an agile, web-tech-powered alternative to traditional desktop GIS tools like QGIS.

## Project Structure

```
cartouche
├── assets
│   ├── svg
│   └── xml
│       └── schemas
├── dist
│   ├── assets
│   └── src
│       └── renderer
├── dist-electron
│   ├── main
│   └── preload
├── node_modules
├── src
│   ├── main
│   │   ├── api
│   │   │   ├── edit
│   │   │   ├── layers
│   │   │   │   └── vector
│   │   │   └── project
│   │   └── shortcuts
│   ├── renderer
│   │   ├── components
│   │   │   └── common
│   │   ├── state
│   │   ├── styles
│   │   └── workbench
│   │       ├── panels
│   │       └── widgets
│   │           └── toolbars
│   └── shared
│       └── types
└── test
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
