import { servicePlugin } from "../lib/service-plugin.ts";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
import { requestPlugin } from "../lib/request-plugin.ts";

const a = servicePlugin({
  name: "a",
  expose() {
    return {
      ok: true,
    };
  },
});

const test = servicePlugin({
  name: "a",
  expose() {
    return {
      ok: true,
    };
  },
})

const props = await test.forTesting()

console.log("test", props);

const myRequestPlugin = requestPlugin({
  name: "request-plugin",
  dependencies: {
    a
  },
  expose(request, deps) {
    console.log(request.headers);
    return {
      foo: deps.a.ok,
    };
  },
});

const root = appPlugin({
  name: "root",
  services: {
    a,
  },
  requestDependencies: {
    myRequestPlugin,
  },
  async configure(fastify, deps, reqDeps, opts) {
    fastify.get("/", async (req) => {
      const props = reqDeps.myRequestPlugin.get(req);
      return props; // infered as { a: number }
    });
  },
});

const app = await createApp({ serverOptions: {}, rootPlugin: root });

const { body, statusCode } = await app.inject({
  url: "/",
});

console.log({ body, statusCode });
