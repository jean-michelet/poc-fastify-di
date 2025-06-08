import { test, type TestContext } from "node:test";
import { servicePlugin } from "../lib/service-plugin.ts";
import fastify from "fastify";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";

test("should throw if servicePlugin is registered outside boot", async (t) => {
  const app = fastify();

  const service = servicePlugin({
    name: "service",
    expose: () => ({ test: 1 }),
  });

  const root = appPlugin({
    name: "root",
    services: { service },
    configure(fastify, deps) {},
  });

  await t.assert.rejects(
    () => root.register(app),
    new Error("You can only register an application plugin during booting.")
  );

  await createApp({ serverOptions: {}, rootPlugin: root });

  await t.assert.rejects(
    () => root.register(app),
    new Error("You can only register an application plugin during booting.")
  );
});

test("should not register the same plugin twice (awaited)", async (t) => {
  let count = 0;
  const a = appPlugin({
    name: "a",
    configure(fastify, deps) {
      count++;
    },
  });

  const root = appPlugin({
    name: "root",
    async configure(fastify, deps) {
      await a.register(fastify);
      await a.register(fastify);
    },
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  t.assert.equal(count, 1);
});

test("should not register the same plugin twice (not-awaited)", async (t) => {
  let count = 0;
  const a = appPlugin({
    name: "a",
    configure(fastify, deps) {
      count++;
    },
  });

  const root = appPlugin({
    name: "root",
    configure(fastify, deps) {
      a.register(fastify);
      a.register(fastify);
    },
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  t.assert.equal(count, 1);
});

test("should propagate options in app plugins", async (t: TestContext) => {
  const a = appPlugin({
    name: "a",
    configure(fastify, deps, opts) {
      fastify.get("/", async () => {
        return {
          hello: "world",
        };
      });
    },
    opts: {
      prefix: "/bar",
    },
  });

  const root = appPlugin({
    name: "root",
    async configure(fastify, deps, opts) {
      await a.register(fastify);
    },
    opts: {
      prefix: "/foo",
    },
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });

  const { body, statusCode } = await app.inject({
    url: "/foo/bar",
  });

  t.assert.strictEqual(statusCode, 200);
  t.assert.deepStrictEqual(
    body,
    JSON.stringify({
      hello: "world",
    })
  );
});

