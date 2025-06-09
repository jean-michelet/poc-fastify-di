import type { ServicePluginInstance } from "../../../lib/service-plugin.ts";
import type { Post } from "./post.d.ts";

interface PostRepository {
    findAll: () => Post[]
}

export type PostRepositoryPlugin = ServicePluginInstance<PostRepository>
