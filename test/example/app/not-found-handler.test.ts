import { it, type TestContext } from "node:test";
import { createTestApp } from "../../../example/test-app.ts";

it("should call notFoundHandler", async (t: TestContext) => {
  const app = await createTestApp(t);

  const res = await app.inject({
    method: "GET",
    url: "/this-route-does-not-exist",
  });

  t.assert.strictEqual(res.statusCode, 404);
  t.assert.deepStrictEqual(JSON.parse(res.payload), { message: "Not Found" });
});

it("should be rate limited", async (t: TestContext) => {
  const app = await createTestApp(t);

  for (let i = 0; i < 3; i++) {
    const res = await app.inject({
      method: "GET",
      url: "/this-route-does-not-exist",
    });

    t.assert.strictEqual(res.statusCode, 404, `Iteration ${i}`);
  }

  const res = await app.inject({
    method: "GET",
    url: "/this-route-does-not-exist",
  });

  t.assert.strictEqual(res.statusCode, 429, "Expected 429");
});
