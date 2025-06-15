import fastifySensible from "@fastify/sensible";
import { appPlugin } from "../../../lib/app-plugin.ts";

export const sensiblePlugin = appPlugin({
  name: "sensible",
  encapsulate: false,
  configure(fastify) {
    /**
     * This plugin adds some utilities to handle http errors
     *
     * @see {@link https://github.com/fastify/fastify-sensible}
     */
    fastify.register(fastifySensible);
  },
});
