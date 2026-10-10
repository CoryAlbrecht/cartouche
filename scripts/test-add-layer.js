import electron from 'electron';
const { app } = electron;
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('headless');

app.whenReady().then(async () => {
  try {
    const { addLayer, addLayers } = await import('../dist-electron/main/ApiFunctions-AJ4dKDfa.js');
    const { projectStore } = await import('../dist-electron/main/ProjectStore-B0HglZ0m.js');

    console.log('--- TEST 1: Add Shapefile without custom name/id ---');
    const layer1 = await addLayer({
      sourceType: 'vector',
      filePath: path.resolve(__dirname, '../../test/files/ne_10m_lakes.shp')
    });

    console.log('Layer 1 Name:', layer1.name);
    console.log('Layer 1 ID:', layer1.id);
    console.log('Layer 1 GeometryKind:', layer1.geometryKind);
    console.log('Layer 1 CRS:', layer1.crs);
    console.log('Layer 1 FileType:', layer1.fileType?.id);
    console.log('ProjectStore Root Children Count:', projectStore.getRootGroup().getChildCount());

    console.log('\n--- TEST 2: Add with custom name and ID ---');
    const layer2 = await addLayer({
      sourceType: 'vector',
      filePath: path.resolve(__dirname, '../../test/files/ne_10m_coastline.shp'),
      layerName: 'My Coastline',
      layerId: 'custom_coastline_id'
    });

    console.log('Layer 2 Name:', layer2.name);
    console.log('Layer 2 ID:', layer2.id);
    console.log('ProjectStore Root Children Count:', projectStore.getRootGroup().getChildCount());

    console.log('\n--- TEST 3: Verification of Store Structure ---');
    const children = projectStore.getRootGroup().getAllChildren();
    for (const child of children) {
      console.log('Child in rootGroup:', child.name, '(', child.id, ')');
    }

    projectStore.closeProject();
    console.log('\nSUCCESS! All tests passed.');
    app.quit();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    app.exit(1);
    process.exit(1);
  }
});
