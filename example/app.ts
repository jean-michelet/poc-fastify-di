import { createApp } from "../lib/di.ts";
import { inMemoryPostsRepository } from "./plugins/posts/in-memory-posts-repository.ts";
import { createPostsRoutes } from "./plugins/posts/posts.routes.ts";

const app = await createApp({
  serverOptions: {},
  rootPlugin: createPostsRoutes(inMemoryPostsRepository),
});

const { body, statusCode } = await app.inject({
  url: "/posts",
});

console.log(statusCode, JSON.parse(body));
