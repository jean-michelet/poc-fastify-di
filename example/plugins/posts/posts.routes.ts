import { appPlugin } from "../../../lib/app-plugin.ts";
import { currentUser } from "../auth/current-user.scoped.service.ts";
import type { PostRepositoryPlugin } from "./posts-repository.port.ts";

export function createPostsRoutes(postRepository: PostRepositoryPlugin) {
  const postsRoutes = appPlugin({
    name: "postsRoutes",
    dependencies: {
      services: { postRepository },
      scopedServices: { currentUser },
    },
    configure: (app, { services, scopedServices }) => {
      const repo = services.postRepository;
      const currentUser = scopedServices.currentUser;

      app.get("/posts", async (req, reply) => {
        const { user } = await currentUser.get(req);
        if (!user) {
          reply.status(401);
          return { error: "Unauthorized" };
        }

        return repo.findAll();
      });
    },
  });
  
  return postsRoutes;
}
