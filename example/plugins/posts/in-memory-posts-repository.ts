import { servicePlugin } from "../../../lib/service-plugin.ts";
import type { Post } from "./post.d.ts";
import type { PostRepositoryPlugin } from "./posts-repository.port.ts";

export const inMemoryPostsRepository: PostRepositoryPlugin = servicePlugin({
  name: "postsRepo",
  expose: () => {
    const state: Post[] = [{ id: 1, title: "my post" }];
    return {
      findAll: () => {
        return state;
      },
    };
  },
});
