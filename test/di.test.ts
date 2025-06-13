import test, { type TestContext } from "node:test";
import { createApp } from "../lib/di.ts";
import { appPlugin } from "../lib/app-plugin.ts";

test("hooks", async (t: TestContext) => {
  t.plan(4);

  const app: any = await createApp({
    onFastifyCreated(fastify: any) {
      fastify.decorate("x", 1);
      t.assert.strictEqual(fastify.x++, 1);
    },
    onRootRegistered(fastify: any) {
      t.assert.strictEqual(fastify.x++, 2);
    },
    rootPlugin: appPlugin({
      name: "app-plugin",
      configure(fastify: any) {
        t.assert.strictEqual(fastify.x, 2);
        fastify.x = 10 // Encapsulated so doesn't have any repercussion on higher level
      },
    }),
  });

  t.after(() => app.close());

  t.assert.strictEqual(app.x, 3);
});
