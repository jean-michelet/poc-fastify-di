import test, { type TestContext } from "node:test";

import { createTestApp } from "../../../example/test-app.ts";

test("GET /api with no login", async (t: TestContext) => {
  const app = await createTestApp(t);

  const res = await app.inject({
    url: "/api",
  });

  t.assert.deepStrictEqual(JSON.parse(res.payload), {
    message: "You must be authenticated to access this route.",
  });
});

test("GET /api with cookie", async (t: TestContext) => {
  const app = await createTestApp(t);

  const res = await app.injectWithLogin("basic@example.com", {
    url: "/api",
  });

  t.assert.equal(res.statusCode, 200);
  t.assert.deepStrictEqual(JSON.parse(res.body), {
    message: "Welcome!",
  });
});
