import { createApp } from "../lib/di.ts";
import { inMemoryPostsRepository } from "./plugins/posts/in-memory-posts-repository.ts";
import { createPostsRoutes } from "./plugins/posts/posts.routes.ts";


const app = await createApp({ serverOptions: {}, rootPlugin: createPostsRoutes(inMemoryPostsRepository) });
console.log(app.printPlugins());

const { body, statusCode } = await app.inject({
  url: "/",
});

console.log(body, statusCode);
