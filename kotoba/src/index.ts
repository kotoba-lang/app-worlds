/**
 * worlds kotoba — barrel.
 *
 * Per ADR-2606011400. Virtual-worlds authoring (scene → asset + portal) on the
 * etzhayyim substrate (AT PDS records; no RW).
 *
 *   scene  : createScene / setSceneStatus (draft→published→archived) / getScene / listScenes (title+desc search)
 *   asset  : createAsset (FK→scene, assetType enum) / listAssets
 *   portal : createPortal (FK→source scene + optional FK→target scene / external URI) / listPortals
 *   coverage
 *
 * (a) content-authoring product (webpage/kami/pptx cluster). First-party user-
 * authored scenes/assets/portals; published scenes form a public directory. No
 * generation compute (contrast `voxelforge` (b)).
 */

export * from "./types.js";
export {
  createScene,
  setSceneStatus,
  getScene,
  listScenes,
  createAsset,
  listAssets,
  createPortal,
  listPortals,
  coverage,
} from "./registry.js";
