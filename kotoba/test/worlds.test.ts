import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  createScene,
  setSceneStatus,
  getScene,
  listScenes,
  createAsset,
  listAssets,
  createPortal,
  listPortals,
  coverage,
} from "../src/index.js";

describe("worlds kotoba", () => {
  let e: any;
  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:worlds.etzhayyim.com" });
  });

  describe("scene authoring + publish", () => {
    it("creates scenes (start draft), publishes, reads, searches", async () => {
      expect((await createScene(e, { sceneId: "SC-1", title: "Forest Glade", description: "a calm woodland", tags: ["nature"], authorDid: "did:web:alice" })).status).toBe("created");
      expect((await getScene(e, { sceneId: "SC-1" })).scene?.status).toBe("draft");
      expect((await setSceneStatus(e, { sceneId: "SC-1", status: "published" })).newStatus).toBe("published");
      expect((await getScene(e, { sceneId: "SC-1" })).scene?.publishedAt).toBeTruthy();
      expect((await setSceneStatus(e, { sceneId: "SC-1", status: "wormhole" as any })).status).toBe("rejected");
      expect((await setSceneStatus(e, { sceneId: "GHOST", status: "published" })).status).toBe("notFound");
      expect((await listScenes(e, { status: "published", tag: "nature" })).total).toBe(1);
      expect((await listScenes(e, { q: "woodland" })).total).toBe(1);
    });
  });

  describe("assets + portals FK to scene", () => {
    beforeEach(async () => {
      await createScene(e, { sceneId: "SC-1", title: "Hub" });
      await createScene(e, { sceneId: "SC-2", title: "Cavern" });
    });
    it("creates assets (FK→scene, type validated), rejects missing scene", async () => {
      expect((await createAsset(e, { assetId: "A-1", sceneId: "SC-1", name: "tree.glb", assetType: "model", uri: "ipfs://x", format: "glb" })).status).toBe("created");
      expect((await createAsset(e, { assetId: "A-X", sceneId: "SC-1", name: "x", assetType: "hologram" as any })).status).toBe("rejected"); // type
      expect((await createAsset(e, { assetId: "A-G", sceneId: "GHOST", name: "g", assetType: "model" })).status).toBe("sceneNotFound");
      expect((await listAssets(e, { sceneId: "SC-1", assetType: "model" })).total).toBe(1);
    });
    it("creates portals (FK→source + optional FK→target / external URI)", async () => {
      expect((await createPortal(e, { portalId: "P-1", sceneId: "SC-1", targetSceneId: "SC-2", label: "to cavern" })).status).toBe("created");
      expect((await createPortal(e, { portalId: "P-2", sceneId: "SC-1", targetWorldUri: "https://other.world/x" })).status).toBe("created");
      expect((await createPortal(e, { portalId: "P-X", sceneId: "SC-1" })).status).toBe("rejected"); // no target
      expect((await createPortal(e, { portalId: "P-G", sceneId: "GHOST", targetWorldUri: "x" })).status).toBe("sceneNotFound");
      expect((await createPortal(e, { portalId: "P-T", sceneId: "SC-1", targetSceneId: "GHOST" })).status).toBe("targetNotFound");
      expect((await listPortals(e, { sceneId: "SC-1" })).total).toBe(2);
      expect((await listPortals(e, { targetSceneId: "SC-2" })).total).toBe(1);
    });
    it("coverage rolls up scenes/assets/portals by status/type", async () => {
      await setSceneStatus(e, { sceneId: "SC-1", status: "published" });
      await createAsset(e, { assetId: "A-1", sceneId: "SC-1", name: "rock", assetType: "model" });
      await createAsset(e, { assetId: "A-2", sceneId: "SC-1", name: "grass", assetType: "texture" });
      await createPortal(e, { portalId: "P-1", sceneId: "SC-1", targetSceneId: "SC-2" });
      const cov = await coverage(e);
      expect(cov.sceneCount).toBe(2);
      expect(cov.assetCount).toBe(2);
      expect(cov.portalCount).toBe(1);
      expect(cov.scenesByStatus?.published).toBe(1);
      expect(cov.scenesByStatus?.draft).toBe(1);
      expect(cov.assetsByType?.model).toBe(1);
    });
  });
});
