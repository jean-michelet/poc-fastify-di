import { test } from "node:test";
import assert from "node:assert/strict";
import { servicePlugin } from "../lib/service-plugin.ts";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
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

test("should not register application plugin twice", async (t) => {
  const app = fastify();

  const service = servicePlugin({
    name: "service",
    expose: () => ({ test: 1 }),
  });

  await t.assert.rejects(
    () => service.register(app),
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
    () => service.register(app),
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

test("should throw if props accessed before service registration", async () => {
  const unsafe = servicePlugin({
    name: "unsafe",
    expose: () => ({ secret: 123 }),
  });

  assert.throws(() => {
    const _ = unsafe.props.secret;
  }, new Error(`Cannot access props for service "unsafe" as it has not been registered yet.`));
});

test("should throw if props accessed outside boot phase", async () => {
  const unsafe = servicePlugin({
    name: "unsafe",
    expose: () => ({ secret: 123 }),
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { unsafe },
    },
    configure(fastify, { services }) {
      assert.equal(services.unsafe.secret, 123);
    },
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  assert.throws(() => {
    const _ = unsafe.props.secret;
  }, new Error(`Cannot access props for service "unsafe" outside of Fastify boot phase.`));
});

test("should not register a service more than once o nthe same encapsulation context", async (t) => {
  const dependent = servicePlugin({
    name: "dependent",
    expose: () => {},
  });

  const dependent2 = servicePlugin({
    name: "dependent",
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
      "Service plugin with the name 'dependent' has already been registered on this encapsulation context."
    )
  );
});

test("should not register a service in configure", async (t) => {
  let count = 0;

  const singleton = servicePlugin({
    name: "singleton",
    expose: () => {
      count++;
      return { n: count };
    },
  });

  const root = appPlugin({
    name: "root",
    async configure(app) {
      await singleton.register(app);
    },
  });

  await t.assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      "You can only inject service plugin as dependency, not registering it manually."
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
    (service as any).props = "hacked";
  }, /Cannot set property props/);

  assert.throws(() => {
    (service as any).register = "hacked";
  }, /Cannot assign to read only property/);
});

test("forTesting()", async () => {
  const dep = servicePlugin({
    name: "dep",
    expose: () => ({ value: 10 }),
  });

  const main = servicePlugin({
    name: "main",
    dependencies: { dep },
    expose: ({ dep }) => ({ double: dep.value * 2 }),
  });

  const result = await main.forTesting();
  assert.deepEqual(result, { double: 20 });
});

test("forTesting() after registration should throw", async () => {
  const service = servicePlugin({
    name: "late",
    expose: () => ({ val: true }),
  });

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { service },
    },
    configure() {},
  });

  await createApp({ serverOptions: {}, rootPlugin: root });

  await assert.rejects(
    () => service.forTesting(),
    new Error(
      "forTesting() method can only be used before booting the application."
    )
  );
});

test("Cannot register once forTesting() has been called", async () => {
  const service = servicePlugin({
    name: "service",
    expose: () => ({ val: true }),
  });

  await service.forTesting();

  const root = appPlugin({
    name: "root",
    dependencies: {
      services: { service },
    },
    configure() {},
  });

  await assert.rejects(
    () => createApp({ serverOptions: {}, rootPlugin: root }),
    new Error(
      `Impossible to register service plugin 'service' because 'forTesting' method has been called.`
    )
  );
});

test("props can be accessed in test mode", async () => {
  const service = servicePlugin({
    name: "testable",
    expose: () => ({ val: 42 }),
  });

  await service.forTesting();
  assert.equal(service.props.val, 42);
});

test("should detect circular reference in test mode", async () => {
  const serviceC = servicePlugin({
    name: "serviceC",
    expose: () => ({
      runC: () => "C executed",
    }),
  });

  const serviceB = servicePlugin({
    name: "serviceB",
    dependencies: { serviceC },
    expose: ({ serviceC }) => ({
      runB: () => serviceC.runC(),
    }),
  });

  const serviceA = servicePlugin({
    name: "serviceA",
    dependencies: { serviceB },
    expose: ({ serviceB }) => ({
      runA: () => serviceB.runB(),
    }),
  });

  const serviceCWithCycle = servicePlugin({
    name: "serviceC",
    dependencies: { serviceA },
    expose: ({ serviceA }) => ({
      runC: () => serviceA.runA(),
    }),
  });

  await assert.rejects(
    () => serviceCWithCycle.forTesting(),
    new Error(
      "Circular dependency detected: serviceC -> serviceA -> serviceB -> serviceC"
    )
  );
});
