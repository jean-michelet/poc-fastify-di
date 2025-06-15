import fastifyUnderPressure, { type FastifyUnderPressureOptions } from "@fastify/under-pressure";
import { appPlugin } from "../../../lib/app-plugin.ts";
import { knexPlugin } from "./knex.ts";
import fp from 'fastify-plugin'

export const underPressurePlugin = appPlugin({
  name: "under-pressure",
  encapsulate: false,
  dependencies: {
    services: {
      knex: knexPlugin,
    },
  },
  async configure(fastify, { services }) {
    /**
     * A Fastify plugin for mesuring process load and automatically
     * handle of "Service Unavailable"
     *
     * @see {@link https://github.com/fastify/under-pressure}
     *
     * Video on the topic: Do not thrash the event loop
     * @see {@link https://www.youtube.com/watch?v=VI29mUA8n9w}
     */
    await fastify.register(fp(fastifyUnderPressure), {
      maxEventLoopDelay: 1000,
      maxHeapUsedBytes: 100_000_000,
      maxRssBytes: 1_000_000_000,
      maxEventLoopUtilization: 0.98,
      message: "The server is under pressure, retry later!",
      retryAfter: 50,
      healthCheck: async () => {
        try {
          await services.knex.raw("SELECT 1");
          return true;
          /* c8 ignore start */
        } catch (err) {
          fastify.log.error(err, "healthCheck has failed");
          throw new Error("Database connection is not available");
        }
        /* c8 ignore stop */
      },
      healthCheckInterval: 5000,
    } satisfies FastifyUnderPressureOptions);
  },
});
