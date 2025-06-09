import { createApp } from "../lib/di.ts";
import { servicePlugin } from "../lib/service-plugin.ts";
import { inMemoryPostsRepository } from "./plugins/posts/in-memory-posts-repository.ts";
import { createPostsRoutes } from "./plugins/posts/posts.routes.ts";

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

const app = await createApp({
  serverOptions: {},
  rootPlugin: createPostsRoutes(inMemoryPostsRepository),
});

const { body, statusCode } = await app.inject({
  url: "/posts",
});

console.log(statusCode, JSON.parse(body));
