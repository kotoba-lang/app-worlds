// worlds.etzhayyim.com — Worlds Scene & Asset Management Platform
// Thin-edge dispatcher: business logic in AgentGateway MCP + pod-side LangServer.
// 8 methods: createScene / listScenes / getScene / publishScene /
//            createAsset / listAssets / createPortal / listPortals

interface Fetcher { fetch(req: Request): Promise<Response>; }
interface Env {
  AGENTGATEWAY_MCP_ROUTER_URL?: string;
  MCP_ROUTER_URL?: string;
  ASSETS?: Fetcher;
  APP_NANOID?: string;
}
interface ExportedHandler<E> { fetch(req: Request, env: E): Promise<Response>; }

const ACTOR_DID = "did:web:worlds.etzhayyim.com";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/_app/meta") {
      return json({
        ok: true,
        actor: ACTOR_DID,
        nanoid: env.APP_NANOID ?? "cvs4f8cg",
        execution: "edge-proxy+agentgateway-mcp+langserver",
        bpmn: "60-apps/etzhayyim-project-worlds/bpmn",
        methods: [
          "createScene", "listScenes", "getScene", "publishScene",
          "createAsset", "listAssets", "createPortal", "listPortals",
        ],
      });
    }

    if (url.pathname.startsWith("/xrpc/")) {
      if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*", "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization", "access-control-max-age": "86400",
      } });
      if (req.method !== "POST") return noStore({ error: "MethodNotAllowed" }, 405);
      const nsid = url.pathname.slice("/xrpc/".length);
      if (!nsid) return noStore({ error: "Missing XRPC method" }, 400);
      const input: unknown = await req.json().catch(() => ({}));
      return proxyToMcp(req, env, nsid, input);
    }

    if (env.ASSETS) return env.ASSETS.fetch(req);

    return json({ error: "NotFound" }, 404);
  },
} satisfies ExportedHandler<Env>;

function mcpRouterUrl(env: Env): string {
  const configured = env.AGENTGATEWAY_MCP_ROUTER_URL?.trim()
    ? env.AGENTGATEWAY_MCP_ROUTER_URL : env.MCP_ROUTER_URL?.trim()
      ? env.MCP_ROUTER_URL : "https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message";
  return configured.replace(/\/+$/, "");
}

async function proxyToMcp(req: Request, env: Env, nsid: string, input: unknown): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.set("content-type", "application/json");
  headers.set("x-etzhayyim-bff", "sveltekit-edge-bff"); // Preserve the deployed router contract.
  headers.set("x-etzhayyim-xrpc-method", nsid);
  const res = await fetch(mcpRouterUrl(env), {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call",
      params: { name: nsid, arguments: input } }),
  });
  const text = await res.text();
  let payload: unknown = text;
  try { payload = text ? JSON.parse(text) : null; } catch { /* Preserve text payload. */ }
  if (!res.ok) return noStore({ error: "MCP router request failed", upstream: payload }, res.status);
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = payload.error as { message?: string } | null;
    return noStore({ error: error?.message ?? "MCP router returned an error", upstream: payload }, 502);
  }
  const result = payload && typeof payload === "object" && "result" in payload ? payload.result : payload;
  const structured = result && typeof result === "object" && "structuredContent" in result
    ? result.structuredContent : result;
  return noStore(structured ?? {});
}

function noStore(data: unknown, status = 200): Response {
  const res = json(data, status);
  res.headers.set("cache-control", "no-store");
  return res;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
