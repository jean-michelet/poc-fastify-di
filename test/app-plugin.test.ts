import { test, type TestContext } from "node:test";
import { servicePlugin } from "../lib/service-plugin.ts";
import fastify from "fastify";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
import { scopedPlugin } from "../lib/scoped-plugin.ts";

test("should throw if servicePlugin is registered outside boot", async (t) => {
  const app = fastify();

  const service = servicePlugin({
    name: "service",
    expose: () => ({ test: 1 }),
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { service },
    },
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

test("should not allow to register plugin manually", async (t) => {
  let count = 0;
  const child = appPlugin({
    name: "child",
    configure(fastify, deps) {
      count++;
    },
  });

  const root = appPlugin({
    name: "root",
    async configure(fastify, deps) {
      await child.register(fastify);
    },
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "You can only inject a child plugin, not registering it manually."
    )
  );
});

test("should not register the same plugin twice", async (t) => {
  let count = 0;
  const a = appPlugin({
    name: "a",
    configure(fastify, deps) {
      count++;
    },
  });

  const root = appPlugin({
    name: "root",
    childPlugins: [a, a],
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  t.assert.equal(count, 1);
});

test("should propagate options in children app plugins", async (t: TestContext) => {
  const child = appPlugin({
    name: "child",
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
    childPlugins: [child],
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

test("should not register a scoped service more than once", async (t) => {
  const child = appPlugin({
    name: "child",
  });

  const child2 = appPlugin({
    name: "child",
  });

  const root = appPlugin({
    name: "root",
    childPlugins: [child, child2],
    configure() {},
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "Application plugin with the name 'child' has already been registered on this encapsulation context."
    )
  );
});
