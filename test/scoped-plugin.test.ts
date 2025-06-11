import { test } from "node:test";
import assert from "node:assert/strict";
import fastify, { type FastifyRequest } from "fastify";

import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
import { scopedPlugin } from "../lib/scoped-plugin.ts";
import { servicePlugin } from "../lib/service-plugin.ts";

test("should inject request dependency with get method", async () => {
  const userPlugin = scopedPlugin({
    name: "user",
    expose(req) {
      return {
        id: req.headers["x-user-id"] as string,
      };
    },
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      scopedServices: { userPlugin },
    },
    configure(fastify, { scopedServices }) {
      fastify.get("/", async (req) => {
        const user = scopedServices.userPlugin.get(req);
        return { userId: user.id };
      });
    },
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });

  const res = await app.inject({
    method: "GET",
    url: "/",
    headers: { "x-user-id": "alice" },
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { userId: "alice" });
});

test("should call expose only once per request", async () => {
  let callCount = 0;
  const plugin = scopedPlugin({
    name: "memoized",
    expose(req) {
      callCount++;
      return {
        foo: true,
      };
    },
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      scopedServices: { plugin },
    },
    configure(fastify, { scopedServices }) {
      fastify.get("/", async (req) => {
        scopedServices.plugin.get(req);
        scopedServices.plugin.get(req);
        return scopedServices.plugin.get(req);
      });
    },
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });

  await app.inject({
    method: "GET",
    url: "/",
    headers: { "x-user-id": "alice" },
  });

  assert.equal(callCount, 1);
});

test("should support promise and sync functions", async (t) => {
  const sync = scopedPlugin({
    name: "sync",
    expose() {
      return {
        isAsync: false,
      };
    },
  });

  const promise = scopedPlugin({
    name: "promise",
    async expose() {
      return {
        isAsync: true,
      };
    },
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      scopedServices: { sync, promise },
    },
    configure(fastify, { scopedServices }) {
      fastify.get("/", async (req) => {
        t.assert.equal(scopedServices.sync.get(req) instanceof Promise, false);
        t.assert.equal(
          scopedServices.promise.get(req) instanceof Promise,
          false
        );

        return {};
      });
    },
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });

  await app.inject({
    method: "GET",
    url: "/",
  });
});

test("should resolve dependencies", async () => {
  const service = servicePlugin({
    name: "service",
    expose: () => ({ fromDep: 1 }),
  });

  const plugin = scopedPlugin({
    name: "user",
    dependencies: {
      service,
    },
    expose(_, { service }) {
      return {
        num: service.fromDep,
      };
    },
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      scopedServices: { plugin },
    },
    configure(fastify, { scopedServices }) {
      fastify.get("/", async (req) => {
        const props = scopedServices.plugin.get(req);
        return { num: props.num };
      });
    },
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });

  const res = await app.inject({
    method: "GET",
    url: "/",
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { num: 1 });
});

test("should throw if request plugin is registered outside boot", async () => {
  const app = fastify();

  const userPlugin = scopedPlugin({
    name: "user",
    expose: () => ({ id: "test" }),
  });

  await assert.rejects(
    () => userPlugin.register(app),
    new Error("You can only register a scoped plugin during booting.")
  );
});

test("should throw if .get() is called before Fastify is ready", async () => {
  const plugin = scopedPlugin({
    name: "user",
    expose: () => ({ id: "unauthorized" }),
  });

  assert.throws(
    () => plugin.get({} as FastifyRequest),
    new Error('Cannot call .get() for "user" before Fastify is ready')
  );
});

test("should not register a scoped service more than once", async (t) => {
  const dependent = scopedPlugin({
    name: "dependent",
    expose: () => {},
  });

  const dependent2 = scopedPlugin({
    name: "dependent",
    expose: () => {},
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      scopedServices: { dependent, dependent2 },
    },
    configure() {},
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "Scoped service plugin with the name 'dependent' has already been registered on this encapsulation context."
    )
  );
});

test("should not register the same scoped plugin twice", async (t) => {
  const scoped = scopedPlugin({
    name: "scoped",
    expose() {
      return {
        x: 1,
      };
    },
  });

  const child = appPlugin({
    name: "child",
    dependencies: {
      scopedServices: {
        scoped,
      },
    },
  });

  const sibling = appPlugin({
    name: "sibling",
    dependencies: {
      scopedServices: {
        scoped,
      },
    },
  });

  const root = appPlugin({
    name: "root",
    childPlugins: [child, sibling],
  });

  const app = await createApp({ serverOptions: {}, rootPlugin: root });
});
