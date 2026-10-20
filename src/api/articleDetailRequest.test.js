import test from "node:test";
import assert from "node:assert/strict";
import { createArticleDetailRequest } from "./articleDetailRequest.js";

const setup = () => {
    let token = "account-a-token";
    const calls = [];
    const api = { get: (path, options) => {
        let resolve;
        let reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        calls.push({ path, options, resolve, reject });
        return promise;
    } };
    return { calls, load: createArticleDetailRequest(api, () => token),
        setToken: value => { token = value; } };
};

test("the same account shares simultaneous reads of the same article", () => {
    const { load, calls } = setup();
    assert.equal(load(10), load("10"));
    assert.equal(calls.length, 1);
});

test("switching accounts keeps article requests and authorization separate", () => {
    const { load, calls, setToken } = setup();
    const first = load(10);
    setToken("account-b-token");
    assert.notEqual(load(10), first);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.headers.Authorization, "Bearer account-a-token");
    assert.equal(calls[1].options.headers.Authorization, "Bearer account-b-token");
});

test("different articles have separate requests", () => {
    const { load, calls } = setup();
    assert.notEqual(load(10), load(11));
    assert.deepEqual(calls.map(call => call.path), ["/articles/10", "/articles/11"]);
});

test("logging out starts a guest request without reusing an account response", () => {
    const { load, calls, setToken } = setup();
    const authenticated = load(10);
    setToken(null);
    assert.notEqual(load(10), authenticated);
    assert.equal(calls[1].options.headers.Authorization, false);
});

test("completed responses are released so later reads fetch the current count", async () => {
    const { load, calls } = setup();
    const first = load(10);
    calls[0].resolve({ data: { viewCount: 1 } });
    await first;
    assert.notEqual(load(10), first);
    assert.equal(calls.length, 2);
});

test("failed requests are released so retrying makes a new request", async () => {
    const { load, calls } = setup();
    const first = load(10);
    calls[0].reject(new Error("network unavailable"));
    await assert.rejects(first, /network unavailable/);
    assert.notEqual(load(10), first);
    assert.equal(calls.length, 2);
});
