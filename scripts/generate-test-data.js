/**
 * @file generate-test-data.js
 * @module scripts/generate-test-data
 * @description Regenerates the small, repository-tracked test datasets in `tests/data/` from the full source datasets (Natural Earth extracts and the timeline GeoPackage) kept outside the repository. Every feature, FID, attribute and layer name is preserved; only geometry detail is reduced (topology-preserving simplification plus coordinate rounding), so feature counts and attribute-driven assertions match the full datasets while the files stay small enough to commit.
 *
 * Usage:
 *   node scripts/generate-test-data.js [sourceDir]
 * `sourceDir` defaults to `../test/files` (the workspace dataset directory). Output always goes to `tests/data/`.
 * Also writes `tests/data/project-4.cproj`, a copy of the workspace `test/projects/project-1/project-4.cproj` whose layer sources are rewritten to these files by relative path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link DATASETS}
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import gdal from 'gdal-async';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

/**
 * @typedef {Object} DatasetSpec
 * @property {string} file - Source and output file name.
 * @property {string} driver - GDAL vector driver used to write the output.
 * @property {number} tolerance - Topology-preserving simplification tolerance in layer units (degrees for EPSG:4326).
 */

/**
 * @description Datasets opened by the test suite, with the simplification applied to each.
 * @type {DatasetSpec[]}
 */
export const DATASETS = [
  { file: 'ne_10m_lakes.shp', driver: 'ESRI Shapefile', tolerance: 0.01 },
  { file: 'ne_10m_lakes_north_america.shp', driver: 'ESRI Shapefile', tolerance: 0.01 },
  { file: 'ne_10m_lakes_north_america.geojson', driver: 'GeoJSON', tolerance: 0.01 },
  { file: 'ne_10m_rivers_lake_centerline_scale_rank.geojson', driver: 'GeoJSON', tolerance: 0.01 },
  { file: 'ne_10m_coastline.shp', driver: 'ESRI Shapefile', tolerance: 0.05 },
  { file: 'timeline_level_0_borders.shp', driver: 'ESRI Shapefile', tolerance: 0.05 },
  { file: 'timeline_level_0.gpkg', driver: 'GPKG', tolerance: 0.05 },
  { file: 'timeline_level_0-3.gpkg', driver: 'GPKG', tolerance: 0.05 },
];

/**
 * @description Coordinate resolution (degrees) that output geometries are rounded to via `ogr2ogr -xyRes`.
 * @type {string}
 */
const XY_RESOLUTION = '0.00001';

/**
 * @description Shapefile sidecar extensions written by GDAL alongside the `.shp`.
 * @type {string[]}
 */
const SHAPEFILE_SIDECARS = ['.shp', '.shx', '.dbf', '.prj', '.cpg'];

/**
 * @description Lists the files that make up a dataset: the shapefile sidecar set for `.shp`, otherwise the single file. Datasets sharing a stem (e.g. `x.shp` and `x.geojson`) are kept apart.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @param {string} outPath - Output dataset path.
 * @returns {string[]} Absolute paths of the dataset's files that exist on disk.
 */
function datasetFiles(outPath) {
  const files = outPath.endsWith('.shp')
    ? SHAPEFILE_SIDECARS.map((ext) => outPath.replace(/\.shp$/, ext))
    : [outPath];
  return files.filter((f) => fs.existsSync(f));
}

/**
 * @description Copies one dataset with `ogr2ogr` semantics: every feature, FID, attribute (nulls included) and layer name preserved; geometry simplified with topology preservation and rounded to {@link XY_RESOLUTION}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @param {DatasetSpec} spec - Dataset to copy.
 * @param {string} sourceDir - Directory holding the full source dataset.
 * @param {string} outDir - Destination directory.
 * @returns {{ file: string, features: number, bytes: number }} Summary of the written dataset.
 * @throws {Error} When the source dataset is missing.
 */
function copyDataset(spec, sourceDir, outDir) {
  const srcPath = path.join(sourceDir, spec.file);
  if (!fs.existsSync(srcPath)) throw new Error(`Missing source dataset: ${srcPath}`);
  const outPath = path.join(outDir, spec.file);
  for (const f of datasetFiles(outPath)) fs.rmSync(f);
  const src = gdal.open(srcPath);
  const args = ['-f', spec.driver, '-simplify', String(spec.tolerance), '-xyRes', XY_RESOLUTION];
  if (spec.driver === 'GPKG') args.push('-preserve_fid');
  if (spec.driver === 'ESRI Shapefile') args.push('-lco', 'ENCODING=UTF-8');
  gdal.vectorTranslate(outPath, src, args).close();
  src.close();
  const written = gdal.open(outPath);
  const features = written.layers.get(0).features.count();
  written.close();
  const bytes = datasetFiles(outPath).reduce((sum, f) => sum + fs.statSync(f).size, 0);
  return { file: spec.file, features, bytes };
}

/**
 * @description Writes `tests/data/project-4.cproj` from the workspace copy, rewriting absolute layer sources to bare file names resolved against the project directory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @param {string} sourceDir - Directory holding the full source datasets.
 * @param {string} outDir - Destination directory.
 * @returns {void}
 * @throws {Error} When the workspace project file is missing.
 */
function copyProject(sourceDir, outDir) {
  const projectPath = path.resolve(sourceDir, '../projects/project-1/project-4.cproj');
  if (!fs.existsSync(projectPath)) throw new Error(`Missing source project: ${projectPath}`);
  const xml = fs
    .readFileSync(projectPath, 'utf8')
    .replace(/<source>[^<]*[\\/]([^\\/<]+)<\/source>/g, '<source>$1</source>');
  fs.writeFileSync(path.join(outDir, 'project-4.cproj'), xml);
}

/**
 * @description Entry point: regenerates every dataset and the project copy, printing a size summary.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @returns {void}
 */
function main() {
  const sourceDir = path.resolve(process.argv[2] ?? path.join(projectRoot, '../test/files'));
  const outDir = path.join(projectRoot, 'tests/data');
  fs.mkdirSync(outDir, { recursive: true });
  for (const spec of DATASETS) {
    const r = copyDataset(spec, sourceDir, outDir);
    console.log(`[generate-test-data] ${r.file}: ${r.features} features, ${(r.bytes / 1024).toFixed(0)} KiB`);
  }
  copyProject(sourceDir, outDir);
  console.log('[generate-test-data] project-4.cproj');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
