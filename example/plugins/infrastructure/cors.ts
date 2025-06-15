import cors from "@fastify/cors";
import { appPlugin } from "../../../lib/app-plugin.ts";

export const corsPlugin = appPlugin({
  name: "cors",
  async configure(fastify) {
    /**
     * This plugins enables the use of CORS.
     *
     * @see {@link https://github.com/fastify/fastify-cors}
     */
    await fastify.register(cors, {
      methods: ["GET", "POST", "PUT", "DELETE"],
    });
  },
});
