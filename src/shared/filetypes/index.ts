/**
 * @file index.ts
 * @module shared/filetypes
 * @description Built-in geospatial raster, vector, project, and tabular format definitions for the Cartouche File Types Registry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */

import type { FileTypeDescriptor } from '@shared/types';

/**
 * @description Built-in geospatial raster, vector, project, style, and tabular format definitions.
 * Isomorphic metadata safe for import across both Node.js Main and browser/React Renderer processes.
 *
 * @type {FileTypeDescriptor[]}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-29
 * @since 0.1.0-dev
 */
export const BUILTIN_FILE_TYPES: FileTypeDescriptor[] = [
  // ==========================================
  // VECTOR FORMATS (OGR)
  // ==========================================
  {
    id: 'geopackage-vector',
    name: 'OGC GeoPackage Vector',
    category: 'vector',
    primaryExtensions: ['.gpkg'],
    accessoryExtensions: ['.gpkg-wal', '.gpkg-shm'],
    mimeType: 'application/geopackage+sqlite3',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
      },
      {
        offset: 68,
        bytes: [0x47, 0x50, 0x4b, 0x47] // 'GPKG' application id
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'flatgeobuf',
    name: 'FlatGeobuf Vector',
    category: 'vector',
    primaryExtensions: ['.fgb'],
    accessoryExtensions: [],
    mimeType: 'application/vnd.flatgeobuf',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x66, 0x67, 0x62, 0x03, 0x66, 0x67, 0x62, 0x00]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'esri-shapefile',
    name: 'ESRI Shapefile',
    category: 'vector',
    primaryExtensions: ['.shp'],
    accessoryExtensions: ['.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx', '.qix'],
    mimeType: 'application/x-shapefile',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x00, 0x00, 0x27, 0x0a] // Big-endian integer 9994
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'geojson',
    name: 'GeoJSON',
    category: 'vector',
    primaryExtensions: ['.geojson', '.json'],
    accessoryExtensions: [],
    mimeType: 'application/geo+json',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'topojson',
    name: 'TopoJSON',
    category: 'vector',
    primaryExtensions: ['.topojson', '.json'],
    accessoryExtensions: [],
    mimeType: 'application/json',
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },
  {
    id: 'gpx',
    name: 'GPS Exchange Format (GPX)',
    category: 'vector',
    primaryExtensions: ['.gpx'],
    accessoryExtensions: [],
    mimeType: 'application/gpx+xml',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'kml',
    name: 'Keyhole Markup Language (KML)',
    category: 'vector',
    primaryExtensions: ['.kml'],
    accessoryExtensions: [],
    mimeType: 'application/vnd.google-earth.kml+xml',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'kmz',
    name: 'Compressed Keyhole Markup Language (KMZ)',
    category: 'vector',
    primaryExtensions: ['.kmz'],
    accessoryExtensions: [],
    mimeType: 'application/vnd.google-earth.kmz',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x50, 0x4b, 0x03, 0x04] // Standard ZIP archive
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'gml',
    name: 'Geography Markup Language (GML)',
    category: 'vector',
    primaryExtensions: ['.gml'],
    accessoryExtensions: ['.xsd'],
    mimeType: 'application/gml+xml',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'autocad-dxf',
    name: 'AutoCAD DXF',
    category: 'vector',
    primaryExtensions: ['.dxf'],
    accessoryExtensions: [],
    mimeType: 'application/dxf',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'autocad-dwg',
    name: 'AutoCAD DWG',
    category: 'vector',
    primaryExtensions: ['.dwg'],
    accessoryExtensions: [],
    mimeType: 'application/acad',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x41, 0x43] // Starts with 'AC'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },
  {
    id: 'mapinfo-tab',
    name: 'MapInfo TAB File',
    category: 'vector',
    primaryExtensions: ['.tab'],
    accessoryExtensions: ['.dat', '.id', '.map', '.ind'],
    mimeType: 'application/octet-stream',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'mapinfo-mif',
    name: 'MapInfo MIF/MID',
    category: 'vector',
    primaryExtensions: ['.mif'],
    accessoryExtensions: ['.mid'],
    mimeType: 'text/plain',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'sqlite-spatialite',
    name: 'SQLite / SpatiaLite',
    category: 'vector',
    primaryExtensions: ['.sqlite', '.db'],
    accessoryExtensions: ['.sqlite-wal', '.sqlite-shm'],
    mimeType: 'application/vnd.sqlite3',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'mbtiles-vector',
    name: 'MBTiles Vector Tiles',
    category: 'vector',
    primaryExtensions: ['.mbtiles'],
    accessoryExtensions: ['.mbtiles-wal', '.mbtiles-shm'],
    mimeType: 'application/vnd.mapbox-vector-tile',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
      },
      {
        offset: 68,
        bytes: [0x6d, 0x62, 0x74, 0x78] // 'mbtx' application id
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'osm-pbf',
    name: 'OpenStreetMap Protobuf (PBF)',
    category: 'vector',
    primaryExtensions: ['.pbf'],
    accessoryExtensions: ['.osm.pbf'],
    mimeType: 'application/x-protobuf',
    magicNumbers: [
      {
        offset: 4,
        bytes: [0x4f, 0x53, 0x4d, 0x48, 0x65, 0x61, 0x64, 0x65, 0x72] // 'OSMHeader'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },
  {
    id: 'osm-xml',
    name: 'OpenStreetMap XML',
    category: 'vector',
    primaryExtensions: ['.osm'],
    accessoryExtensions: [],
    mimeType: 'application/xml',
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },
  {
    id: 'microstation-dgn',
    name: 'MicroStation DGN',
    category: 'vector',
    primaryExtensions: ['.dgn'],
    accessoryExtensions: [],
    mimeType: 'application/x-dgn',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x08, 0x05] // DGN v7
      },
      {
        offset: 0,
        bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // DGN v8 OLE CFBF container
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'esri-filegdb',
    name: 'ESRI File Geodatabase',
    category: 'vector',
    primaryExtensions: ['.gdb'],
    accessoryExtensions: [],
    isDirectoryContainer: true,
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },
  {
    id: 'esri-personal-gdb',
    name: 'ESRI Personal Geodatabase',
    category: 'vector',
    primaryExtensions: ['.mdb'],
    accessoryExtensions: [],
    mimeType: 'application/x-msaccess',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x00, 0x01, 0x00, 0x00, 0x53, 0x74, 0x61, 0x6e, 0x64, 0x61, 0x72, 0x64, 0x20, 0x4a, 0x65, 0x74, 0x20, 0x44, 0x42] // 'Standard Jet DB'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:vector'
  },

  // ==========================================
  // RASTER FORMATS (GDAL)
  // ==========================================
  {
    id: 'geotiff',
    name: 'GeoTIFF / Cloud Optimized GeoTIFF',
    category: 'raster',
    primaryExtensions: ['.tif', '.tiff'],
    accessoryExtensions: ['.tfw', '.tif.aux.xml', '.ovr'],
    mimeType: 'image/tiff',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x49, 0x49, 0x2a, 0x00] // Little-endian standard TIFF ('II*')
      },
      {
        offset: 0,
        bytes: [0x4d, 0x4d, 0x00, 0x2a] // Big-endian standard TIFF ('MM*')
      },
      {
        offset: 0,
        bytes: [0x49, 0x49, 0x2b, 0x00] // Little-endian BigTIFF ('II+')
      },
      {
        offset: 0,
        bytes: [0x4d, 0x4d, 0x00, 0x2b] // Big-endian BigTIFF ('MM+')
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'geopackage-raster',
    name: 'OGC GeoPackage Raster Tiles',
    category: 'raster',
    primaryExtensions: ['.gpkg'],
    accessoryExtensions: ['.gpkg-wal', '.gpkg-shm'],
    mimeType: 'application/geopackage+sqlite3',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
      },
      {
        offset: 68,
        bytes: [0x47, 0x50, 0x4b, 0x47]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'mbtiles-raster',
    name: 'MBTiles Raster Tiles',
    category: 'raster',
    primaryExtensions: ['.mbtiles'],
    accessoryExtensions: ['.mbtiles-wal', '.mbtiles-shm'],
    mimeType: 'application/vnd.sqlite3',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]
      },
      {
        offset: 68,
        bytes: [0x6d, 0x62, 0x74, 0x78]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'png',
    name: 'Portable Network Graphics (PNG)',
    category: 'raster',
    primaryExtensions: ['.png'],
    accessoryExtensions: ['.pgw', '.png.aux.xml'],
    mimeType: 'image/png',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'jpeg',
    name: 'JPEG Imagery',
    category: 'raster',
    primaryExtensions: ['.jpg', '.jpeg'],
    accessoryExtensions: ['.jgw', '.jpg.aux.xml', '.jpeg.aux.xml'],
    mimeType: 'image/jpeg',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0xff, 0xd8, 0xff]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'webp',
    name: 'WebP Imagery',
    category: 'raster',
    primaryExtensions: ['.webp'],
    accessoryExtensions: ['.wld', '.webp.aux.xml'],
    mimeType: 'image/webp',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x52, 0x49, 0x46, 0x46] // 'RIFF'
      },
      {
        offset: 8,
        bytes: [0x57, 0x45, 0x42, 0x50] // 'WEBP'
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'gif',
    name: 'Graphics Interchange Format (GIF)',
    category: 'raster',
    primaryExtensions: ['.gif'],
    accessoryExtensions: ['.gfw', '.gif.aux.xml'],
    mimeType: 'image/gif',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] // 'GIF87a'
      },
      {
        offset: 0,
        bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] // 'GIF89a'
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'bmp',
    name: 'Windows Bitmap (BMP)',
    category: 'raster',
    primaryExtensions: ['.bmp'],
    accessoryExtensions: ['.bpw', '.bmp.aux.xml'],
    mimeType: 'image/bmp',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x42, 0x4d] // 'BM'
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'jpeg2000',
    name: 'JPEG 2000',
    category: 'raster',
    primaryExtensions: ['.jp2', '.j2k', '.jpf'],
    accessoryExtensions: ['.j2w', '.jp2.aux.xml'],
    mimeType: 'image/jp2',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x00, 0x00, 0x00, 0x0c, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a] // JP2 signature box
      },
      {
        offset: 0,
        bytes: [0xff, 0x4f, 0xff, 0x51] // Raw J2K codestream
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'erdas-imagine',
    name: 'Erdas Imagine (HFA)',
    category: 'raster',
    primaryExtensions: ['.img'],
    accessoryExtensions: ['.ige', '.rrd', '.img.aux.xml'],
    mimeType: 'application/octet-stream',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x45, 0x48, 0x46, 0x41, 0x5f, 0x45, 0x52, 0x44, 0x41, 0x53] // 'EHFA_ERDAS'
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'netcdf',
    name: 'Network Common Data Form (NetCDF)',
    category: 'raster',
    primaryExtensions: ['.nc', '.nc4'],
    accessoryExtensions: [],
    mimeType: 'application/x-netcdf',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x43, 0x44, 0x46, 0x01] // Classic NetCDF-1
      },
      {
        offset: 0,
        bytes: [0x43, 0x44, 0x46, 0x02] // 64-bit offset NetCDF-2
      },
      {
        offset: 0,
        bytes: [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a] // NetCDF-4 (HDF5 container)
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'hdf5',
    name: 'Hierarchical Data Format 5 (HDF5)',
    category: 'raster',
    primaryExtensions: ['.h5', '.hdf5'],
    accessoryExtensions: [],
    mimeType: 'application/x-hdf5',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'hdf4',
    name: 'Hierarchical Data Format 4 (HDF4)',
    category: 'raster',
    primaryExtensions: ['.hdf', '.h4'],
    accessoryExtensions: [],
    mimeType: 'application/x-hdf',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x0e, 0x03, 0x13, 0x01]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'fits',
    name: 'Flexible Image Transport System (FITS)',
    category: 'raster',
    primaryExtensions: ['.fits', '.fit'],
    accessoryExtensions: [],
    mimeType: 'application/fits',
    magicNumbers: [
      {
        offset: 0,
        // ASCII: "SIMPLE  =                    T"
        bytes: [
          0x53, 0x49, 0x4d, 0x50, 0x4c, 0x45, 0x20, 0x20, 0x3d, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20,
          0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x54
        ]
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'pcidsk',
    name: 'PCIDSK Database',
    category: 'raster',
    primaryExtensions: ['.pix'],
    accessoryExtensions: [],
    mimeType: 'application/octet-stream',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x50, 0x43, 0x49, 0x44, 0x53, 0x4b, 0x20, 0x20] // 'PCIDSK  '
      }
    ],
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'mrsid',
    name: 'Multi-resolution Seamless Image Database (MrSID)',
    category: 'raster',
    primaryExtensions: ['.sid'],
    accessoryExtensions: ['.sdw'],
    mimeType: 'image/x-mrsid',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x6d, 0x73, 0x69, 0x64] // 'msid'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:raster'
  },
  {
    id: 'ecw',
    name: 'Enhanced Compression Wavelet (ECW)',
    category: 'raster',
    primaryExtensions: ['.ecw'],
    accessoryExtensions: ['.eww'],
    mimeType: 'image/ecw',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x65, 0x63, 0x77, 0x73] // 'ecws'
      },
      {
        offset: 0,
        bytes: [0x65, 0x63, 0x77, 0x70] // 'ecwp'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:raster'
  },
  {
    id: 'vrt',
    name: 'GDAL Virtual Format (VRT)',
    category: 'raster',
    primaryExtensions: ['.vrt'],
    accessoryExtensions: [],
    mimeType: 'application/xml',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'arcinfo-ascii-grid',
    name: 'Arc/Info ASCII Grid',
    category: 'raster',
    primaryExtensions: ['.asc', '.grd'],
    accessoryExtensions: ['.prj'],
    mimeType: 'text/plain',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'envi-hdr',
    name: 'ENVI Labelled Raster',
    category: 'raster',
    primaryExtensions: ['.dat', '.bin', '.raw', '.bil', '.bip', '.bsq'],
    accessoryExtensions: ['.hdr'],
    mimeType: 'application/octet-stream',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:raster'
  },
  {
    id: 'usgs-dem',
    name: 'USGS ASCII DEM',
    category: 'raster',
    primaryExtensions: ['.dem'],
    accessoryExtensions: [],
    mimeType: 'text/plain',
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:raster'
  },
  {
    id: 'dted',
    name: 'Digital Terrain Elevation Data (DTED)',
    category: 'raster',
    primaryExtensions: ['.dt0', '.dt1', '.dt2'],
    accessoryExtensions: [],
    mimeType: 'application/octet-stream',
    magicNumbers: [
      {
        offset: 0,
        bytes: [0x56, 0x4f, 0x4c] // 'VOL'
      },
      {
        offset: 0,
        bytes: [0x55, 0x48, 0x4c] // 'UHL'
      }
    ],
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:raster'
  },
  {
    id: 'srtm-hgt',
    name: 'SRTM Elevation Grid',
    category: 'raster',
    primaryExtensions: ['.hgt'],
    accessoryExtensions: [],
    mimeType: 'application/octet-stream',
    canRead: true,
    canWrite: false,
    loaderId: 'gdal:raster'
  },

  // ==========================================
  // TABULAR / DELIMITED FORMATS
  // ==========================================
  {
    id: 'delimited-csv',
    name: 'Comma-Separated Values (CSV)',
    category: 'tabular',
    primaryExtensions: ['.csv'],
    accessoryExtensions: ['.csvt', '.prj'],
    mimeType: 'text/csv',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },
  {
    id: 'delimited-tsv',
    name: 'Tab-Separated Values (TSV)',
    category: 'tabular',
    primaryExtensions: ['.tsv'],
    accessoryExtensions: ['.csvt', '.prj'],
    mimeType: 'text/tab-separated-values',
    canRead: true,
    canWrite: true,
    loaderId: 'gdal:vector'
  },

  // ==========================================
  // PROJECT FORMATS
  // ==========================================
  {
    id: 'cartouche-xml',
    name: 'Cartouche Project (XML)',
    category: 'project',
    primaryExtensions: ['.cproj', '.cartouche', '.xml'],
    accessoryExtensions: [],
    mimeType: 'application/x-cartouche-project+xml',
    canRead: true,
    canWrite: true,
    loaderId: 'project:cartouche-xml'
  },
  {
    id: 'cartouche-bundled',
    name: 'Cartouche Bundled Project',
    category: 'project',
    primaryExtensions: ['.cprojz', '.cartzp', '.zip'],
    accessoryExtensions: [],
    mimeType: 'application/x-cartouche-project+zip',
    canRead: false,
    canWrite: false,
    loaderId: 'project:cartouche-bundled'
  },

  // ==========================================
  // STYLE FORMATS
  // ==========================================
  {
    id: 'sld',
    name: 'OGC SLD Style',
    category: 'style',
    primaryExtensions: ['.sld', '.se'],
    accessoryExtensions: [],
    mimeType: 'application/vnd.ogc.sld+xml',
    canRead: true,
    canWrite: true,
    loaderId: 'style:sld'
  },
  {
    id: 'ol-flat-style',
    name: 'OpenLayers Flat Style',
    category: 'style',
    primaryExtensions: ['.json'],
    accessoryExtensions: [],
    mimeType: 'application/json',
    canRead: true,
    canWrite: true,
    loaderId: 'style:openlayers'
  }
];
