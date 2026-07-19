/**
 * worlds kotoba — virtual-worlds authoring model: scene → asset + portal.
 *
 * Per ADR-2606011400 (Consensys pattern) + ADR-2605172400 (3-axis OR-test).
 *
 * AXIS NOTE: (a) content-authoring product (the webpage / kami / pptx creative-
 * content cluster). A scene/asset/portal is the USER'S OWN authored content held
 * in their OWN repo — first-party content, so the AT PDS record IS the canonical
 * store: no third-party PII custody, no settlement, no fulfillment liability.
 * Authoring (create) + publishing (status flip + public directory) are
 * first-party CRUD.
 *
 * Contrast `voxelforge` ((b)): that GENERATES 3D meshes via RunPod GPU (compute-
 * output bookkeeping). worlds MANAGES/composes user-authored scenes — no
 * generation compute, no RW/B2 bookkeeping.
 *
 * AT-Lexicon: no float. (Asset transforms, if added later, integerize as
 * milli-units / EMU.)
 *
 * Identity hierarchy:
 *   did:web:worlds.etzhayyim.com                          — controller
 *   did:web:worlds.etzhayyim.com:scene:{sceneId}          — a scene
 *   did:web:worlds.etzhayyim.com:asset:{assetId}          — an asset
 *   did:web:worlds.etzhayyim.com:portal:{portalId}        — a portal
 */

export const WORLDS_DID_PREFIX = "did:web:worlds.etzhayyim.com:" as const;

export const SCENE_COLLECTION = "com.etzhayyim.apps.worlds.scene";
export const ASSET_COLLECTION = "com.etzhayyim.apps.worlds.asset";
export const PORTAL_COLLECTION = "com.etzhayyim.apps.worlds.portal";

// ─── Enums ──────────────────────────────────────────────────────────

export type SceneStatus = "draft" | "published" | "archived";
export type AssetType = "model" | "texture" | "audio" | "material" | "script" | "other";

export const SCENE_STATUSES: ReadonlySet<string> = new Set(["draft", "published", "archived"]);
export const ASSET_TYPES: ReadonlySet<string> = new Set(["model", "texture", "audio", "material", "script", "other"]);

// ─── Scene ──────────────────────────────────────────────────────────

export interface SceneRecord {
  did: string;
  sceneId: string;
  title: string;
  description?: string;
  status: SceneStatus;
  tags?: string[];
  authorDid?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
export interface SceneView extends SceneRecord {
  sceneUri: string;
}
export interface CreateSceneInput {
  sceneId: string;
  title: string;
  description?: string;
  tags?: string[];
  authorDid?: string;
}
export interface CreateSceneOutput {
  status: "created" | "alreadyExists" | "rejected";
  sceneUri?: string;
  did?: string;
  sceneId?: string;
  error?: string;
}
export interface SetSceneStatusInput {
  sceneId: string;
  status: SceneStatus;
  publishedAt?: string;
}
export interface SetSceneStatusOutput {
  status: "updated" | "rejected" | "notFound";
  sceneId?: string;
  newStatus?: SceneStatus;
  error?: string;
}
export interface GetSceneInput {
  sceneId: string;
}
export interface GetSceneOutput {
  scene?: SceneView;
  error?: string;
}
export interface ListScenesInput {
  status?: SceneStatus;
  tag?: string;
  authorDid?: string;
  q?: string;
  limit?: number;
  cursor?: string;
}
export interface ListScenesOutput {
  items: SceneView[];
  cursor?: string;
  total: number;
}

// ─── Asset ──────────────────────────────────────────────────────────

export interface AssetRecord {
  did: string;
  assetId: string;
  /** FK → scene. */
  sceneId: string;
  name: string;
  assetType: AssetType;
  uri?: string;
  format?: string;
  createdAt: string;
}
export interface AssetView extends AssetRecord {
  assetUri: string;
}
export interface CreateAssetInput {
  assetId: string;
  sceneId: string;
  name: string;
  assetType: AssetType;
  uri?: string;
  format?: string;
}
export interface CreateAssetOutput {
  status: "created" | "alreadyExists" | "rejected" | "sceneNotFound";
  assetUri?: string;
  did?: string;
  assetId?: string;
  error?: string;
}
export interface ListAssetsInput {
  sceneId?: string;
  assetType?: AssetType;
  limit?: number;
  cursor?: string;
}
export interface ListAssetsOutput {
  items: AssetView[];
  cursor?: string;
  total: number;
}

// ─── Portal (link from a scene to another scene / world) ────────────

export interface PortalRecord {
  did: string;
  portalId: string;
  /** FK → source scene. */
  sceneId: string;
  /** FK → target scene (internal), optional. */
  targetSceneId?: string;
  /** External world URI, optional. */
  targetWorldUri?: string;
  label?: string;
  createdAt: string;
}
export interface PortalView extends PortalRecord {
  portalUri: string;
}
export interface CreatePortalInput {
  portalId: string;
  sceneId: string;
  targetSceneId?: string;
  targetWorldUri?: string;
  label?: string;
}
export interface CreatePortalOutput {
  status: "created" | "alreadyExists" | "rejected" | "sceneNotFound" | "targetNotFound";
  portalUri?: string;
  did?: string;
  portalId?: string;
  error?: string;
}
export interface ListPortalsInput {
  sceneId?: string;
  targetSceneId?: string;
  limit?: number;
  cursor?: string;
}
export interface ListPortalsOutput {
  items: PortalView[];
  cursor?: string;
  total: number;
}

// ─── Coverage ───────────────────────────────────────────────────────

export interface CoverageInput {
  maxScan?: number;
}
export interface CoverageOutput {
  sceneCount?: number;
  assetCount?: number;
  portalCount?: number;
  scenesByStatus?: Record<string, number>;
  assetsByType?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

export function sceneDidFor(id: string): string {
  return `${WORLDS_DID_PREFIX}scene:${id.toLowerCase()}`;
}
export function sceneRkey(id: string): string {
  return `scene-${id.toLowerCase()}`;
}
export function assetDidFor(id: string): string {
  return `${WORLDS_DID_PREFIX}asset:${id.toLowerCase()}`;
}
export function assetRkey(id: string): string {
  return `asset-${id.toLowerCase()}`;
}
export function portalDidFor(id: string): string {
  return `${WORLDS_DID_PREFIX}portal:${id.toLowerCase()}`;
}
export function portalRkey(id: string): string {
  return `portal-${id.toLowerCase()}`;
}
