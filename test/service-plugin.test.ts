import { test } from "node:test";
import assert from "node:assert/strict";
import { servicePlugin } from "../lib/service-plugin.ts";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp, createLocator } from "../lib/di.ts";
import fastify from "fastify";

test("should expose props after createApp()", async () => {
  const simple = servicePlugin({
    name: "simple",
    expose: () => ({ foo: "bar" }),
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { simple },
    },
    configure(fastify, { services }) {
      assert.equal(services.simple.foo, "bar");
    },
  });

  await createApp({ serverOptions: {}, rootPlugin: root });
});

test("should not register application outside booting", async (t) => {
  const app = fastify();

  const service = servicePlugin({
    name: "service",
    expose: () => ({ test: 1 }),
  });

  const locator = createLocator();
  await t.assert.rejects(
    () => service.register(app, locator),
    new Error("You can only register a service plugin during booting.")
  );

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { service },
    },
    configure(fastify, deps) {},
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  await t.assert.rejects(
    () => service.register(app, locator),
    new Error("You can only register a service plugin during booting.")
  );
});

test("should inject dependencies into expose()", async () => {
  const a = servicePlugin({
    name: "A",
    expose: () => ({ value: 42 }),
  });

  const b = servicePlugin({
    name: "B",
    dependencies: { a },
    expose: ({ a }) => ({ double: a.value * 2 }),
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { b },
    },
    configure(fastify, { services }) {
      assert.equal(services.b.double, 84);
    },
  });

  await createApp({ serverOptions: {}, rootPlugin: root });
});

test("should not register a service more than once on the same encapsulation context", async (t) => {
  const dependent = servicePlugin({
    name: "dependent",
    lifecycle: "transient",
    expose: () => {},
  });

  const dependent2 = servicePlugin({
    name: "dependent",
    lifecycle: "transient",
    expose: () => {},
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { dependent, dependent2 },
    },
    configure() {},
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "Service plugin 'dependent' is already registered in this context. Use 'singleton' lifecycle to allow reuse."
    )
  );
});

test("should not register a service in configure", async (t) => {
  const singleton = servicePlugin({
    name: "singleton",
    expose: () => {
      return { n: 1 };
    },
  });

  const root = appPlugin({
    name: "root",
    async configure(app) {
      await singleton.register(app, createLocator());
    },
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "You can only inject a service plugin, not register it manually."
    )
  );
});

test("should freeze the service instance to prevent mutation", async () => {
  const service = servicePlugin({
    name: "frozen-service",
    expose: () => ({ message: "hello" }),
  });

  assert.ok(Object.isFrozen(service));

  assert.equal(service.name, "frozen-service");
  assert.throws(() => {
    (service as any).name = "hacked";
  }, /Cannot set property name/);

  assert.throws(() => {
    (service as any).register = "hacked";
  }, /Cannot assign to read only property/);
});

test("should respect singleton vs transient lifecycle", async () => {
  let singletonInitCount = 0;
  let transientInitCount = 0;

  const singletonService = servicePlugin({
    name: "singletonService",
    lifecycle: "singleton",
    expose: () => {
      singletonInitCount++;
      return { id: 1 };
    },
  });

  const transientService = servicePlugin({
    name: "transientService",
    lifecycle: "transient",
    expose: () => {
      transientInitCount++;
      return { id: 1 };
    },
  });

  const pluginA = appPlugin({
    name: "pluginA",
    dependencies: {
      services: {
        singletonService,
        transientService,
      },
    },
  });

  const pluginB = appPlugin({
    name: "pluginB",
    dependencies: {
      services: {
        singletonService,
        transientService,
      },
    },
  });

  const root = appPlugin({
    name: "root",
    childPlugins: [pluginA, pluginB],
    configure() {},
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  assert.equal(singletonInitCount, 1);
  assert.equal(transientInitCount, 2);
});

test("should call onClose with exposed props on shutdown", async (t) => {
  let closedProps: any = null;
  const closableService = servicePlugin({
    name: "closable",
    expose: () => ({ token: "abc123" }),
    onClose: async (props) => {
      closedProps = props;
    },
  });

  const app = await createApp({
    serverOptions: {},
    rootPlugin: appPlugin({
      dependencies: {
        services: {
          closableService,
        },
      },
      name: "root",
    }),
  });

  assert.deepEqual(closedProps, null);

  await app.close();

  assert.deepEqual(closedProps, { token: "abc123" });
});
