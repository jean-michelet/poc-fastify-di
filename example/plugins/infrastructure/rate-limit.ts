import fastifyRateLimit from "@fastify/rate-limit";
import fp from 'fastify-plugin'
import { appPlugin } from "../../../lib/app-plugin.ts";
import { configPlugin } from "./config.ts";

export const rateLimitPlugin = appPlugin({
  name: "rate-limit",
  encapsulate: false,
  dependencies: {
    services: {
      config: configPlugin,
    },
  },
  async configure(fastify, { services: { config } }) {
    /**
     * This plugins is low overhead rate limiter for your routes.
     *
     * @see {@link https://github.com/fastify/fastify-rate-limit}
     */
    await fastify.register(fp(fastifyRateLimit), {
      max: config.RATE_LIMIT_MAX,
      timeWindow: "1 minute",
    });
  },
});
