/**
 * @file types.ts
 * @module main/worker/types
 * @description Domain types and IPC message definitions for the Geospatial Worker utility process communication protocol.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */

import type { BoundingBox, GeometryKind, ProjectCrs, QueryExtentFeature } from '@shared/types';


/**
 * @typedef {Object} GeospatialLayerMetadata
 * @property {string} layerId - Unique layer identifier.
 * @property {string} name - Human-readable layer title.
 * @property {BoundingBox} extent - Geographic bounding envelope [minX, minY, maxX, maxY].
 * @property {number} featureCount - Total count of spatial features in the dataset.
 * @property {ProjectCrs} [crs] - Resolved coordinate reference system metadata.
 * @property {GeometryKind} geometryKind - Mapped GIS geometry kind.
 */
export interface GeospatialLayerMetadata {
  layerId: string;
  name: string;
  extent: BoundingBox;
  featureCount: number;
  crs?: ProjectCrs;
  geometryKind: GeometryKind;
}

/**
 * @typedef {Object} GeospatialQueryResult
 * @property {string} layerId - Unique layer identifier.
 * @property {QueryExtentFeature[]} features - Intersecting spatial feature records.
 */
export interface GeospatialQueryResult {
  layerId: string;
  features: QueryExtentFeature[];
}

/**
 * @typedef {Object} RehydrateLayerSpec
 * @property {string} layerId - Unique layer identifier.
 * @property {string} filePath - Absolute file path to spatial dataset on disk.
 */
export interface RehydrateLayerSpec {
  layerId: string;
  filePath: string;
}

/**
 * @typedef {Object} RehydrateResult
 * @property {string[]} rehydrated - Array of successfully opened layer IDs.
 * @property {Array<{ layerId: string; error: string }>} failed - Array of layer IDs and failure reasons.
 */
export interface RehydrateResult {
  rehydrated: string[];
  failed: Array<{ layerId: string; error: string }>;
}

/**
 * @typedef {Object} OpenDatasetRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'openDataset'} type - Request message discriminator.
 * @property {string} layerId - Target layer UUID.
 * @property {string} filePath - Absolute file path to dataset.
 */
export interface OpenDatasetRequest {
  id: string;
  type: 'openDataset';
  layerId: string;
  filePath: string;
}

/**
 * @typedef {Object} QueryExtentRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'queryExtent'} type - Request message discriminator.
 * @property {string} layerId - Target layer UUID.
 * @property {BoundingBox} [extent] - Spatial query bounding box extent.
 * @property {string} [targetProjection] - Coordinate reference system of input bounding box.
 */
export interface QueryExtentRequest {
  id: string;
  type: 'queryExtent';
  layerId: string;
  extent?: BoundingBox;
  targetProjection?: string;
}

/**
 * @typedef {Object} CloseDatasetRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'closeDataset'} type - Request message discriminator.
 * @property {string} layerId - Target layer UUID.
 */
export interface CloseDatasetRequest {
  id: string;
  type: 'closeDataset';
  layerId: string;
}

/**
 * @typedef {Object} CloseAllRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'closeAll'} type - Request message discriminator.
 */
export interface CloseAllRequest {
  id: string;
  type: 'closeAll';
}

/**
 * @typedef {Object} RehydrateRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'rehydrate'} type - Request message discriminator.
 * @property {RehydrateLayerSpec[]} layers - Array of layer specifications to rehydrate.
 */
export interface RehydrateRequest {
  id: string;
  type: 'rehydrate';
  layers: RehydrateLayerSpec[];
}

/**
 * @typedef {Object} PingRequest
 * @property {string} id - Unique correlation identifier.
 * @property {'ping'} type - Request message discriminator.
 */
export interface PingRequest {
  id: string;
  type: 'ping';
}

/**
 * @typedef {OpenDatasetRequest | QueryExtentRequest | CloseDatasetRequest | CloseAllRequest | RehydrateRequest | PingRequest} WorkerRequest
 * Discriminated union of all request messages dispatched from Main to the Geospatial Worker.
 */
export type WorkerRequest =
  | OpenDatasetRequest
  | QueryExtentRequest
  | CloseDatasetRequest
  | CloseAllRequest
  | RehydrateRequest
  | PingRequest;

/**
 * Distributive omit helper creating request payload types without correlation identifier.
 */
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

/**
 * Request payload union before correlation identifier assignment.
 */
export type WorkerRequestPayload = DistributiveOmit<WorkerRequest, 'id'>;

/**
 * @typedef {Object} WorkerResponse
 * @template T
 * @property {string} id - Correlation identifier matching the original request.
 * @property {boolean} success - True if operation completed successfully.
 * @property {T} [result] - Payload returned upon success.
 * @property {string} [error] - Error message if operation failed.
 */
export interface WorkerResponse<T = unknown> {
  id: string;
  success: boolean;
  result?: T;
  error?: string;
}

