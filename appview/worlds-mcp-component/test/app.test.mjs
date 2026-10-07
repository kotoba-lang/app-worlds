import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.ts';

const method = 'com.etzhayyim.apps.worlds.listScenes';
const request = (body = '{}') => new Request(`https://worlds.test/xrpc/${method}?ignored=query`, {
  method: 'POST', headers: { authorization: 'Bearer fixture', host: 'worlds.test' }, body,
});
async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test('configured MCP router receives tools/call and caller authorization', async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://mcp.fixture/router');
    assert.equal(init.method, 'POST');
    const headers = new Headers(init.headers);
    assert.equal(headers.get('authorization'), 'Bearer fixture');
    assert.equal(headers.get('host'), null);
    assert.equal(headers.get('x-etzhayyim-xrpc-method'), method);
    assert.equal(headers.get('x-internal-secret'), null);
    const body = JSON.parse(init.body);
    assert.equal(body.jsonrpc, '2.0');
    assert.equal(body.method, 'tools/call');
    assert.equal(typeof body.id, 'string');
    assert.deepEqual(body.params, { name: method, arguments: { scene: 'fixture' } });
    return Response.json({ result: { structuredContent: { scenes: ['fixture'] } } });
  }, async () => {
    const res = await app.fetch(request('{"scene":"fixture"}'), { AGENTGATEWAY_MCP_ROUTER_URL: 'https://mcp.fixture/router///' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await res.json(), { scenes: ['fixture'] });
  });
});

test('fallback router configuration and original invalid-JSON behavior', async () => {
  for (const [env, expected] of [
    [{ AGENTGATEWAY_MCP_ROUTER_URL: ' ', MCP_ROUTER_URL: 'https://fallback.fixture/' }, 'https://fallback.fixture'],
    [{}, 'https://mcp.etzhayyim.com/xrpc/com.etzhayyim.mcp.message'],
  ]) {
    await withFetch(async (url, init) => {
      assert.equal(url, expected);
      assert.deepEqual(JSON.parse(init.body).params.arguments, {});
      return Response.json({ result: { value: 1 } });
    }, async () => assert.deepEqual(await (await app.fetch(request('invalid'), env)).json(), { value: 1 }));
  }
});

test('HTTP and MCP errors retain status and cannot masquerade as successful results', async () => {
  for (const [response, status, message] of [
    [Response.json({ problem: 'fixture' }, { status: 403 }), 403, 'MCP router request failed'],
    [Response.json({ error: { message: 'tool refused' } }), 502, 'tool refused'],
  ]) {
    await withFetch(async () => response, async () => {
      const res = await app.fetch(request(), {});
      assert.equal(res.status, status);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal((await res.json()).error, message);
    });
  }
});

test('XRPC preflight and unsupported methods stay out of static assets', async () => {
  const env = { ASSETS: { fetch: () => { throw new Error('XRPC reached assets'); } } };
  const options = await app.fetch(new Request(`https://worlds.test/xrpc/${method}`, { method: 'OPTIONS' }), env);
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-methods'), 'POST,OPTIONS');
  const get = await app.fetch(new Request(`https://worlds.test/xrpc/${method}`), env);
  assert.equal(get.status, 405);
});

test('static request is forwarded unchanged and metadata remains available', async () => {
  const req = new Request('https://worlds.test/vendor/kotoba-ui.css');
  const res = await app.fetch(req, { ASSETS: { fetch: async (r) => {
    assert.equal(r, req); return new Response('fixture css');
  } } });
  assert.equal(await res.text(), 'fixture css');
  assert.equal((await (await app.fetch(new Request('https://worlds.test/health'), {})).json()).actor, 'did:web:worlds.etzhayyim.com');
});
