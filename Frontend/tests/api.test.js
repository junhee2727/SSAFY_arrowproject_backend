import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function client(fetch) {
  const events = [];
  const source = readFileSync(new URL("../js/api.js", import.meta.url), "utf8")
    .replaceAll("import.meta.url", '"http://localhost:8081/enjoytrip/js/api.js"')
    .replace("export class", "class")
    .replace("export async function", "async function");
  const context = { URL, fetch, document: { dispatchEvent: (event) => events.push(event.type) }, CustomEvent: class { constructor(type) { this.type = type; } } };
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.request = apiRequest;`, context);
  return { request: context.request, events };
}

test("API calls retain the WAR context and send same-origin session credentials", async () => {
  let received;
  const { request } = client(async (url, options) => {
    received = { url: String(url), options };
    return { status: 201, ok: true, json: async () => ({ data: { id: "member-1" } }) };
  });
  const user = await request("members/register", { method: "POST", body: { name: "한글" } });
  assert.equal(user.id, "member-1");
  assert.equal(received.url, "http://localhost:8081/enjoytrip/api/members/register");
  assert.equal(received.options.credentials, "same-origin");
  assert.equal(received.options.headers["X-Requested-With"], "EnjoyTrip");
  assert.equal(JSON.parse(received.options.body).name, "한글");
});

test("204 success does not attempt JSON parsing", async () => {
  const { request } = client(async () => ({ status: 204, json: () => { throw Error("must not parse"); } }));
  assert.equal(await request("auth/logout", { method: "POST" }), null);
});

test("expired sessions notify the UI and preserve the server error", async () => {
  const { request, events } = client(async () => ({ status: 401, ok: false, json: async () => ({ error: { code: "LOGIN_REQUIRED", message: "로그인이 필요합니다." } }) }));
  await assert.rejects(request("members/me"), (error) => error.status === 401 && error.code === "LOGIN_REQUIRED");
  assert.deepEqual(events, ["auth:expired"]);
});

test("network and non-JSON failures never fall back to local data", async () => {
  const offline = client(async () => { throw Error("offline"); });
  await assert.rejects(offline.request("posts"), (error) => error.code === "NETWORK_ERROR");
  const invalid = client(async () => ({ status: 404, json: async () => { throw Error("HTML"); } }));
  await assert.rejects(invalid.request("posts"), (error) => error.code === "INVALID_RESPONSE");
});
