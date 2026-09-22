# Cartouche Initial Example & Preview Dataset Reference

This document records the provenance, schemas, and geometric coordinates of the initial demonstration dataset previously used during the initial proof-of-concept and UI prototype of Cartouche. This data is archived here for use in future automated tests, visual regression suites, and documentation examples.

---

## 1. Muon Particle Detector Stations (Point Vector Layer)

The point layer represented high-energy physics observatories and muon tomography experiments worldwide:

### Layer Metadata
- **Layer ID**: `layer-poi-stations`
- **Name**: `Muon Detector Stations`
- **Geometry Kind**: `Point`
- **Color**: `#10b981` (Emerald Green)
- **CRS**: `EPSG:4326` (WGS 84 geographic coordinates)

### Feature Records
| ID | Facility Name | Longitude (°E) | Latitude (°N) | Elevation (m) | Status | Flux Rate | Context / Real-World Research |
|---|---|---|---|---|---|---|---|
| **101** | Gran Sasso Observatory | `13.57` | `42.45` | 963 | Active | `1.24/cm²/min` | INFN Laboratori Nazionali del Gran Sasso (Italy), underground particle astrophysics laboratory beneath the Apennine Mountains. |
| **102** | Kamioka Neutrino Lab | `137.31` | `36.42` | 350 | Active | `1.18/cm²/min` | Super-Kamiokande / Kamioka Observatory (Hida, Gifu, Japan), underground neutrino and cosmic ray detector. |
| **103** | Pyramid of Khafre Array | `31.13` | `29.97` | 75 | Scanning | `1.42/cm²/min` | Giza Plateau (Egypt), site of cosmic-ray muon tomography experiments detecting internal voids and chambers in Egyptian pyramids. |
| **104** | Mt. Vesuvius Muon Unit | `14.42` | `40.82` | 1281 | Active | `1.30/cm²/min` | Vesuvius volcano (Campania, Italy), muon radiography telescope array scanning the internal volcanic conduit and crater density. |
| **105** | CERN Beamline Tracker | `6.05` | `46.23` | 430 | Calibrating | `3.89/cm²/min` | European Organization for Nuclear Research (Geneva, Switzerland / France border), Large Hadron Collider (LHC) muon spectrometer trackers. |

---

## 2. Sample Continental Outline Polygons (Administrative Boundaries)

The continental boundaries were defined using simplified polygons in geographic coordinates (`EPSG:4326` [Longitude, Latitude]):

### Layer Metadata
- **Layer ID**: `layer-admin-boundaries`
- **Name**: `Administrative Boundaries`
- **Geometry Kind**: `Polygon`
- **Color**: `#e07a5f` (Terracotta)
- **Opacity**: `0.7`

### Coordinate Rings
1. **Eurasia Sample Region**:
   ```json
   [[-10, 36], [0, 43], [15, 45], [30, 42], [45, 40], [60, 55], [35, 68], [10, 62], [-5, 58], [-10, 36]]
   ```
2. **Africa Sample Region**:
   ```json
   [[-17, 15], [-5, 36], [32, 31], [50, 12], [40, -10], [28, -34], [18, -34], [10, 0], [-17, 15]]
   ```
3. **Americas Sample Region**:
   ```json
   [[-125, 48], [-75, 45], [-80, 25], [-60, -5], [-40, -10], [-55, -35], [-70, -55], [-75, -20], [-105, 20], [-120, 35], [-125, 48]]
   ```
4. **East Asia Sample Region**:
   ```json
   [[100, 20], [120, 22], [135, 35], [145, 45], [130, 50], [110, 40], [100, 20]]
   ```

---

## 3. Placeholder Tile & Line Layers

- **OpenStreetMap Carto**:
  - `layer-osm-tiles`, Raster web map tile service reference (`#3b82f6`).
- **Major Waterways & Rivers**:
  - `layer-waterways`, LineString hydrographic network layer reference (`#38bdf8`).
