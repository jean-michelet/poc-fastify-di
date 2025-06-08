import { test } from "node:test";
import assert from "node:assert/strict";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
import { requestPlugin } from "../lib/request-plugin.ts";
import fastify, { type FastifyRequest } from "fastify";
import { servicePlugin } from "../lib/service-plugin.ts";

test("should inject request dependency with get method", async () => {
  const userPlugin = requestPlugin({
    name: "user",
    expose(req) {
      return {
        id: req.headers["x-user-id"],
      };
    },
  });

  const root = appPlugin({
    name: "root",
    requestDependencies: { userPlugin },
    configure(fastify, _deps, reqDeps) {
      fastify.get("/", async (req) => {
        const user = reqDeps.userPlugin.get(req);
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

test("should resolve dependencies", async () => {
  const service = servicePlugin({
    name: "service",
    expose: () => ({ fromDep: 1 }),
  });

  const plugin = requestPlugin({
    name: "user",
    dependencies: {
      service,
    },
    expose(_, { service }) {
      return {
        num: service.fromDep
      };
    },
  });

  const root = appPlugin({
    name: "root",
    requestDependencies: { plugin },
    configure(fastify, _deps, reqDeps) {
      fastify.get("/", async (req) => {
        const props = reqDeps.plugin.get(req);
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

  const userPlugin = requestPlugin({
    name: "user",
    expose: () => ({ id: "test" }),
  });

  await assert.rejects(
    () => userPlugin.register(app),
    new Error("You can only register a request plugin during booting.")
  );
});

test("should throw if .get() is called before Fastify is ready", async () => {
  const plugin = requestPlugin({
    name: "user",
    expose: () => ({ id: "unauthorized" }),
  });

  assert.throws(
    () => plugin.get({} as FastifyRequest),
    new Error('Cannot call .get() for "user" before Fastify is ready')
  );
});
