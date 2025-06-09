# `fastify-di`

## Table of Contents

1. [Introduction](#introduction)
2. [Problems with Fastify Decorators](#problems-with-fastify-decorators)
3. [Why Build on Fastify Plugin System](#why-build-on-fastify-plugin-system)
4. [Creating Your App with `createApp`](#creating-your-app-with-createapp)
5. [Service Plugins](#service-plugins)
   - [Injecting a Service into Another Service](#injecting-a-service-into-another-service)
   - [Testing Service Plugins](#testing-service-plugins)
6. [Scoped Plugins](#scoped-plugins)
7. [Application Plugins](#application-plugins)
   - [Nested App Plugins with `childPlugins`](#nested-app-plugins-with-childplugins)
8. [Depending on Abstractions](#depending-on-abstractions)

## Introduction

`fastify-di` is an **explicit**, **type-safe** Dependency Injection component built on Fastify’s plugin system.

```ts
const config = servicePlugin({
  name: "config",
  expose: () => ({ dbClient: "postgre" }),
});

const session = scopedPlugin({
  name: "session",
  expose: (request) => {
    // Authentication logic...
    return { userId: 1 };
  },
});

const rootPlugin = appPlugin({
  name: "root",
  dependencies: {
    /**
     * Service plugins – singleton, encapsulated boot-time values
     */
    services: {
      config,
    },

    /**
     * Scoped plugins – per-request values
     */
    scopedServices: {
      session,
    },
  },

  /**
   * Application behavior – ordinary Fastify code
   *     TypeScript infers:
   *       services.config -> { dbClient: string }
   *       scopedServices.session.get(req) -> { userId: number }
   */
  configure(fastify, { services, scopedServices }) {
    fastify.get("/", (req) => {
      return {
        ...scopedServices.session.get(req),
        ...services.config,
      };
    });
  },
});

/**
 * Composition root: `createApp` wires every dependency in one place.
 */
const app = await createApp({
  serverOptions: {},
  rootPlugin,
});

const { body } = await app.inject({
  url: "/",
  method: "GET",
});

assert.deepStrictEqual(JSON.parse(body), {
  userId: 1,
  dbClient: "postgre",
});
```

## Problems with Fastify decorators

The following Fastify code is completely valid, yet contains multiple structural problems that affect maintainability, testability, and architectural clarity.

```ts
import fp from "fastify-plugin";

const dbPlugin = fp(
  async (fastify) => {
    fastify.decorate("db", dbInstance);
  },
  { name: "db" }
); // No override, available globally

const routesPlugin = async function (scopedFastify) {
  scopedFastify.get("/users", async () => {
    return scopedFastify.db.findAll();
  });
};

fastify.register(dbPlugin);
fastify.register(routesPlugin);
```

### Implicit Dependencies

The route handler for `/users` relies on the Fastify instance to retrieve `db`.
This is similar to the service locator pattern, where dependencies are pulled from a shared registry rather than explicitly declared.
This pattern hides the true requirements of a plugin and breaks inversion of control.
The dependency is not visible in the function signature and is not enforced at compile time for TypeScript users.

### Leaky Encapsulation

Fastify plugins are encapsulated hierarchically, but decorators defined at the root instance automatically propagate to all child scopes.
This means a plugin can appear to work because it inherits a decorator it never declared.
If that plugin is later reused in another part of the tree without the same parent context, it fails (hopefully not silently).

```ts
fastify.decorate("config", { foo: true });

const child = async (child) => {
  child.get("/config", () => child.config);
};

fastify.register(child);
```

This route will break if `child` is re-used under a different parent that does not define `config`.
Again, the dependency exists, but it is not expressed in any formal interface.

### Testing Complexity

When decorators are used, testing becomes cumbersome.
The only way to test a plugin is to instantiate and decorate the Fastify instance manually before registering any code that depends on it.
This requires to know and reproduce the decorator state of the production app.

```ts
import Fastify from "fastify";
import { test } from "node:test";
import assert from "node:assert/strict";

test("GET /users returns data", async () => {
  const app = Fastify();

  app.decorate("db", { findAll: () => [{ id: 1 }] });
  app.register(routesPlugin);

  const res = await app.inject({ method: "GET", url: "/users" });
  assert.deepEqual(JSON.parse(res.body), [{ id: 1 }]);
});
```

### Mitigations

Fastify provides two mechanisms to partially mitigate these issues.

First, [`fastify-plugin`](https://github.com/fastify/fastify-plugin) allows you to declare required decorators and dependencies during plugin definition.
This helps catch missing dependencies at boot time.

Second, [`getDecorator<T>()`](https://fastify.dev/docs/latest/Reference/Decorators/#getdecoratort-api) can
be used to retrieve decorators safely and fail early if they are missing.

These features can improve developer experience in legacy codebases by reducing the reliance
on runtime assumptions.
`getDecorator` also helps improving TypeScript inference.

However, they do not solve the underlying architectural problems caused by implicit access patterns, and depend heavily on the discipline and education of developers.

## Why Build on Fastify Plugin System

### Composition Root

It can be tempting to treat Fastify as just a fast HTTP router and manage services separately using a dependency injection container.
This might seem like a clean separation of concerns:
Fastify handles routes, and the container handles services and composition.

However, designing an application with proper structure requires a clear **composition root**, which is
a single entry point where all dependencies are created and wired together.

If you build a DI container and access it from inside your plugins, you are no longer following dependency injection.
You are using the **service locator** anti-pattern briefly mentioned earlier.

To avoid this, your entire Fastify app, including routes, should be wired through the container itself.
But doing this properly often requires significant effort, heavy abstractions, and is easy to get wrong.

We will return to this soon.

### How Plugin Encapsulation Makes Fastify Performant

Another problem with treating Fastify as just a fast HTTP router is that it overlooks how its performance is actually achieved.

Each plugin scopes its own routes, hooks, and request lifecycle handlers.
Routes are only aware of the context in which they are registered.
When a route is matched, only the hooks and handlers attached to that specific context are executed.
This minimizes overhead compared to global middlewares.

Example:

```ts
app.register(
  function users(scopedFastify) {
    scopedFastify.addHook("onRequest", async () =>
      console.log("Only on users routes")
    );
    scopedFastify.get("/", async () => {
      return [{ name: "Jean" }];
    });
  },
  {
    prefix: "/users",
  }
);

app.register(
  function posts(scopedFastify) {
    scopedFastify.addHook("onRequest", async () =>
      console.log("Only on posts routes")
    );
    scopedFastify.get("/", async () => {
      return [{ title: "Create safe Fastify applications!" }];
    });
  },
  {
    prefix: "/posts",
  }
);
```

### Stay Close to Fastify

Another approach is to use an architectural framework that compiles your high-level application into a Fastify one.
The problem with this model is that it hides what actually happens at runtime, you lose visibility into how plugins are registered,
how routes are scoped, whether encapsulation is preserved and probably many other things.

With `fastify-di`, there’s no mystery.
Every dependency is a Fastify plugin, and you use Fastify’s native methods to declare routes, hooks, and error handlers.
You stay close to the framework, and you always know how your application is composed.

## Creating your app with `createApp`

The `createApp` function serves as the **composition root** for your application.
It sets up the server and wires your root plugin:

```ts
import { createApp } from "fastify-di";
import { appPlugin } from "./app";

const app = await createApp({
  serverOptions: { logger: true },
  rootPlugin: appPlugin,
});

await app.listen({ port: 3000 });
```

All dependency services, request-scoped plugins, and application plugins are resolved from this root.

## Service Plugins

Service plugins are dependencies such as configuration objects, database clients, mailers, etc.

They are defined using `servicePlugin()`:

```ts
const configPlugin = servicePlugin({
  name: "config",
  expose: async () => ({ port: 3000 }),
});
```

The value returned by `expose` is resolved at registration and injected into all dependent plugins.


## Understanding Lifecycle: `singleton` vs `transient`

Service plugins can be instantiated either:

- **once globally** using `lifecycle: "singleton"` (default), or
- **once per dependent plugin** using `lifecycle: "transient"`.

Let’s compare the two in action.

```ts
let singletonInitCount = 0;
let transientInitCount = 0;

/**
 * Singleton service: only initialized once, shared across the app
 */
const singletonService = servicePlugin({
  name: "singletonService",
  lifecycle: "singleton",
  expose: () => {
    singletonInitCount++;
    return { id: 1 };
  },
});

/**
 * Transient service: re-initialized for each plugin that depends on it
 */
const transientService = servicePlugin({
  name: "transientService",
  lifecycle: "transient",
  expose: () => {
    transientInitCount++;
    return { id: 1 };
  },
});

/**
 * Two app plugins that each depend on both services
 */
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

/**
 * Root plugin wires everything together
 */
const root = appPlugin({
  name: "root",
  childPlugins: [pluginA, pluginB],
});

const app = await createApp({ serverOptions: {}, rootPlugin: root });

console.log("\nLifecycle counters:");
console.table([
  { Service: "singletonService", "Instances Created": singletonInitCount },
  { Service: "transientService", "Instances Created": transientInitCount },
]);

console.log("\nPlugin registration tree:");
console.log(app.printPlugins());
```

#### Example Output

```bash
Lifecycle counters:
┌─────────┬────────────────────┬───────────────────┐
│ (index) │ Service            │ Instances Created │
├─────────┼────────────────────┼───────────────────┤
│ 0       │ 'singletonService' │ 1                 │
│ 1       │ 'transientService' │ 2                 │
└─────────┴────────────────────┴───────────────────┘


Plugin registration tree:
root 7 ms
├── bound _after 2 ms
├─┬ root 2 ms
│ ├─┬ pluginA 1 ms
│ │ ├── singletonService 0 ms      // (singleton) Registered once and reused
│ │ ├── bound _after 0 ms
│ │ ├── transientService 0 ms      // (transient) Registered here
│ │ └── bound _after 0 ms
│ ├── bound _after 1 ms
│ ├─┬ pluginB 0 ms
│ │ ├── transientService 0 ms      // (transient) Registered again
│ │ └── bound _after 0 ms
│ └── bound _after 0 ms
└── bound _after 0 ms
```

### Injecting a Service into Another Service

You can compose services by declaring dependencies explicitly:

```ts
const foo = servicePlugin({
  name: "foo",
  expose: () => ({ x: true }),
});

const bar = servicePlugin({
  name: "bar",
  dependencies: {
    foo,
  },
  // TypeScript infers (parameter) foo: { x: boolean; }
  expose: ({ foo }) => {},
});

const root = appPlugin({
  name: "root",
  dependencies: {
    services: {
      bar,
    },
  },
});

const app = await createApp({ serverOptions: {}, rootPlugin: root });

console.log("\nPlugin registration tree:");
console.log(app.printPlugins());
```

#### Example Output

```bash
Plugin registration tree:
root 4 ms
├── bound _after 2 ms
├─┬ root 1 ms
│ ├─┬ bar 1 ms
│ │ ├── foo 0 ms // foo is a dependency and child plugin of bar
│ │ └── bound _after 0 ms
│ └── bound _after 0 ms
└── bound _after 0 ms
```

### Testing Service Plugins

Service plugins include a `.forTesting()` helper that retrieves the exposed object, allowing unit testing outside of the composition root:

```ts
test("configPlugin returns correct port", async (t) => {
  const config = await configPlugin.forTesting();
  t.assert.strictEqual(config.port, 3000);
});
```

If the service has dependencies, they will be resolved recursively.

## Scoped Plugins

Scoped plugins provide **per-request** values, such as authenticated user info.

The value they expose is computed per request.

```ts
const session = scopedPlugin({
  name: "session",
  expose: (request) => {
    // Authentication logic...
    return { id: 1 };
  },
});

const rootPlugin = appPlugin({
  name: "root",
  dependencies: {
    scopedServices: { session },
  },
  configure(fastify, { scopedServices }) {
    fastify.get("/", async (req) => {
      const user = scopedServices.session.get(req);
      return user;
    });
  },
});

const app = await createApp({
  serverOptions: {},
  rootPlugin,
});

const { body } = await app.inject({
  url: "/",
  method: "GET",
});

assert.deepStrictEqual(JSON.parse(body), {
  id: 1,
});
```

Internally, the `expose` function is used to build a `.get(request)` handler.
This gives you a consistent way to access per-request data inside any fastify handler giving you access to the request.

## Application Plugins

Application plugins allow you to create plugins that use native Fastify features like defining routes, hooks, error handlers and explicitly declare which services and scoped services they depend on.

They are always encapsulated:

```ts
const mainPlugin = appPlugin({
  name: "main",
  dependencies: {
    services: { config: configPlugin },
    scopedServices: { session: sessionPlugin },
  },
  configure(fastify, { services, scopedServices }) {
    fastify.get("/user", (req) => {
      // TS infers: { id: number; }
      const user = scopedServices.session.get(req);
      return user;
    });

    fastify.get("/config", () => services.config);
  },
});
```

### Nested App Plugins with `childPlugins`

App plugins can define child plugins. You can also use Fastify options like `prefix` for routing.

```ts
const child = appPlugin({
  name: "child",
  configure(fastify) {
    fastify.get("/", async () => {
      return { hello: "world" };
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

const { body } = await app.inject({
  url: "/foo/bar",
  method: "GET",
});

assert.deepStrictEqual(JSON.parse(body), { hello: "world" });
console.log(app.printPlugins())
```

#### Output
```bash
root 6 ms
├── bound _after 2 ms
├─┬ root 2 ms
│ ├─┬ child 1 ms
│ │ ├── bound _after 0 ms 
│ │ ├── bound _after 0 ms
│ │ ├── bound _after 0 ms // caused by route prefix
│ │ └── bound _after 0 ms // caused by route prefix
│ └── bound _after 0 ms
└── bound _after 1 ms
```


## Depending on Abstractions

A core principle of DI is **depending on abstractions, not implementations**.
This allows code to be reused, replaced, or tested more easily.

`fastify-di` provides a helper type `ServicePluginInstance<T>` to represent abstract service types.

### Define a Port (Interface)

```ts
interface PostRepository {
  findAll(): Post[];
}

export type PostRepositoryPlugin = ServicePluginInstance<PostRepository>;
```

### Create an Adapter (Implementation)

```ts
export const inMemoryPostsRepository: PostRepositoryPlugin = servicePlugin({
  name: "postsRepo",
  expose: () => {
    const state: Post[] = [{ id: 1, title: "hello" }];
    return { findAll: () => state };
  },
});
```

### Consume in an application plugin

Using a **factory**function, you can depends on abstractions and inject the dependencies when constructing the composite root:

```ts
export function createPostsRoutes(postRepository: PostRepositoryPlugin) {
  return appPlugin({
    name: "postsRoutes",
    dependencies: {
      services: { postRepository },
    },
    configure(app, { services }) {
      app.get("/posts", async () => {
        return services.postRepository.findAll();
      });
    },
  });
}
```

A concrete example is available in [./example](./example/).