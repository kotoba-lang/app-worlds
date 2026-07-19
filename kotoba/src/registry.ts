/**
 * worlds kotoba — scene + asset + portal authoring registries + coverage.
 * AT PDS records (no RW). Assets FK→scene; portals FK→source scene (+ optional
 * FK→target scene). First-party user-authored creative content.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  ASSET_COLLECTION,
  ASSET_TYPES,
  PORTAL_COLLECTION,
  SCENE_COLLECTION,
  SCENE_STATUSES,
  assetDidFor,
  assetRkey,
  portalDidFor,
  portalRkey,
  sceneDidFor,
  sceneRkey,
  type AssetRecord,
  type AssetView,
  type CoverageInput,
  type CoverageOutput,
  type CreateAssetInput,
  type CreateAssetOutput,
  type CreatePortalInput,
  type CreatePortalOutput,
  type CreateSceneInput,
  type CreateSceneOutput,
  type GetSceneInput,
  type GetSceneOutput,
  type ListAssetsInput,
  type ListAssetsOutput,
  type ListPortalsInput,
  type ListPortalsOutput,
  type ListScenesInput,
  type ListScenesOutput,
  type PortalRecord,
  type PortalView,
  type SceneRecord,
  type SceneView,
  type SetSceneStatusInput,
  type SetSceneStatusOutput,
} from "./types.js";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

async function exists(e: Etzhayyim, collection: string, rkey: string): Promise<boolean> {
  const resp = await e.read({ collection, rkey }).catch(() => ({ records: [] }));
  return Boolean(resp.records[0]?.value);
}

async function scanAll<T>(e: Etzhayyim, collection: string, maxScan: number, onRow: (v: T) => void): Promise<number> {
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      onRow(r.value);
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return scanned;
}

// ─── Scene ──────────────────────────────────────────────────────────

export async function createScene(e: Etzhayyim, input: CreateSceneInput): Promise<CreateSceneOutput> {
  if (!input.sceneId || !input.title) return { status: "rejected", error: "missingRequiredFields" };
  const rkey = sceneRkey(input.sceneId);
  const existing = await e.read<SceneRecord>({ collection: SCENE_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", sceneUri: existing.records[0].uri, did: existing.records[0].value.did, sceneId: input.sceneId };
  }
  const did = sceneDidFor(input.sceneId);
  const now = new Date().toISOString();
  const record: SceneRecord = {
    did,
    sceneId: input.sceneId,
    title: input.title,
    description: input.description,
    status: "draft",
    tags: input.tags,
    authorDid: input.authorDid,
    createdAt: now,
    updatedAt: now,
  };
  const receipt = await e.write({ collection: SCENE_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "created", sceneUri: receipt.uri, did, sceneId: input.sceneId };
}

export async function setSceneStatus(e: Etzhayyim, input: SetSceneStatusInput): Promise<SetSceneStatusOutput> {
  if (!input.sceneId || !SCENE_STATUSES.has(input.status)) return { status: "rejected", error: "invalidStatus" };
  const rkey = sceneRkey(input.sceneId);
  const resp = await e.read<SceneRecord>({ collection: SCENE_COLLECTION, rkey }).catch(() => ({ records: [] }));
  const scene = resp.records[0]?.value;
  if (!scene) return { status: "notFound", error: "sceneNotFound" };
  const now = new Date().toISOString();
  const updated: SceneRecord = {
    ...scene,
    status: input.status,
    publishedAt: input.status === "published" ? input.publishedAt ?? scene.publishedAt ?? now : scene.publishedAt,
    updatedAt: now,
  };
  await e.write({ collection: SCENE_COLLECTION, record: updated as unknown as Record<string, unknown>, rkey });
  return { status: "updated", sceneId: input.sceneId, newStatus: input.status };
}

export async function getScene(e: Etzhayyim, input: GetSceneInput): Promise<GetSceneOutput> {
  if (!input.sceneId) return { error: "invalidSceneId" };
  const resp = await e.read<SceneRecord>({ collection: SCENE_COLLECTION, rkey: sceneRkey(input.sceneId) }).catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { scene: { ...r.value, sceneUri: r.uri } };
}

export async function listScenes(e: Etzhayyim, input: ListScenesInput = {}): Promise<ListScenesOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<SceneRecord>({ collection: SCENE_COLLECTION, cursor: input.cursor, limit });
  const q = input.q?.toLowerCase();
  const items: SceneView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.status && v.status !== input.status) return false;
      if (input.tag && !(v.tags ?? []).includes(input.tag)) return false;
      if (input.authorDid && v.authorDid !== input.authorDid) return false;
      if (q) {
        const hay = [v.title, v.description ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, sceneUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Asset ──────────────────────────────────────────────────────────

export async function createAsset(e: Etzhayyim, input: CreateAssetInput): Promise<CreateAssetOutput> {
  if (!input.assetId || !input.sceneId || !input.name) return { status: "rejected", error: "missingRequiredFields" };
  if (!ASSET_TYPES.has(input.assetType)) return { status: "rejected", error: "invalidAssetType" };
  if (!(await exists(e, SCENE_COLLECTION, sceneRkey(input.sceneId)))) {
    return { status: "sceneNotFound", error: `sceneNotFound:${input.sceneId}` };
  }
  const rkey = assetRkey(input.assetId);
  const existing = await e.read<AssetRecord>({ collection: ASSET_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", assetUri: existing.records[0].uri, did: existing.records[0].value.did, assetId: input.assetId };
  }
  const did = assetDidFor(input.assetId);
  const record: AssetRecord = {
    did,
    assetId: input.assetId,
    sceneId: input.sceneId,
    name: input.name,
    assetType: input.assetType,
    uri: input.uri,
    format: input.format,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: ASSET_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "created", assetUri: receipt.uri, did, assetId: input.assetId };
}

export async function listAssets(e: Etzhayyim, input: ListAssetsInput = {}): Promise<ListAssetsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<AssetRecord>({ collection: ASSET_COLLECTION, cursor: input.cursor, limit });
  const items: AssetView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.sceneId && v.sceneId !== input.sceneId) return false;
      if (input.assetType && v.assetType !== input.assetType) return false;
      return true;
    })
    .map((r) => ({ ...r.value, assetUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Portal ─────────────────────────────────────────────────────────

export async function createPortal(e: Etzhayyim, input: CreatePortalInput): Promise<CreatePortalOutput> {
  if (!input.portalId || !input.sceneId) return { status: "rejected", error: "missingRequiredFields" };
  if (!input.targetSceneId && !input.targetWorldUri) return { status: "rejected", error: "targetRequired" };
  if (!(await exists(e, SCENE_COLLECTION, sceneRkey(input.sceneId)))) {
    return { status: "sceneNotFound", error: `sceneNotFound:${input.sceneId}` };
  }
  if (input.targetSceneId && !(await exists(e, SCENE_COLLECTION, sceneRkey(input.targetSceneId)))) {
    return { status: "targetNotFound", error: `targetNotFound:${input.targetSceneId}` };
  }
  const rkey = portalRkey(input.portalId);
  const existing = await e.read<PortalRecord>({ collection: PORTAL_COLLECTION, rkey }).catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { status: "alreadyExists", portalUri: existing.records[0].uri, did: existing.records[0].value.did, portalId: input.portalId };
  }
  const did = portalDidFor(input.portalId);
  const record: PortalRecord = {
    did,
    portalId: input.portalId,
    sceneId: input.sceneId,
    targetSceneId: input.targetSceneId,
    targetWorldUri: input.targetWorldUri,
    label: input.label,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({ collection: PORTAL_COLLECTION, record: record as unknown as Record<string, unknown>, rkey });
  return { status: "created", portalUri: receipt.uri, did, portalId: input.portalId };
}

export async function listPortals(e: Etzhayyim, input: ListPortalsInput = {}): Promise<ListPortalsOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<PortalRecord>({ collection: PORTAL_COLLECTION, cursor: input.cursor, limit });
  const items: PortalView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.sceneId && v.sceneId !== input.sceneId) return false;
      if (input.targetSceneId && v.targetSceneId !== input.targetSceneId) return false;
      return true;
    })
    .map((r) => ({ ...r.value, portalUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Coverage ───────────────────────────────────────────────────────

export async function coverage(e: Etzhayyim, input: CoverageInput = {}): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const scenesByStatus: Record<string, number> = {};
  const assetsByType: Record<string, number> = {};
  const sceneCount = await scanAll<SceneRecord>(e, SCENE_COLLECTION, maxScan, (v) => {
    scenesByStatus[v.status] = (scenesByStatus[v.status] ?? 0) + 1;
  });
  const assetCount = await scanAll<AssetRecord>(e, ASSET_COLLECTION, maxScan, (v) => {
    assetsByType[v.assetType] = (assetsByType[v.assetType] ?? 0) + 1;
  });
  const portalCount = await scanAll<PortalRecord>(e, PORTAL_COLLECTION, maxScan, () => {});
  return {
    sceneCount,
    assetCount,
    portalCount,
    scenesByStatus,
    assetsByType,
    truncated: sceneCount >= maxScan || assetCount >= maxScan || portalCount >= maxScan,
  };
}
