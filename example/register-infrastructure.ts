import type { FastifyInstance } from "fastify";
import { type PluginLocator } from "../lib/di.ts";
import { globalErrorHandlerPlugin } from "./plugins/infrastructure/error-handler.ts";
import { rateLimitPlugin } from "./plugins/infrastructure/rate-limit.ts";
import { sessionPlugin } from "./plugins/infrastructure/session.ts";
import { underPressurePlugin } from "./plugins/infrastructure/under-pressure.ts";
import { corsPlugin } from "./plugins/infrastructure/cors.ts";

export async function registerInfrastructurePlugins(fastify: FastifyInstance, locator: PluginLocator) {
  await rateLimitPlugin.register(fastify, locator);
  await globalErrorHandlerPlugin.register(fastify, locator);
  await sessionPlugin.register(fastify, locator);
  await corsPlugin.register(fastify, locator);
  await underPressurePlugin.register(fastify, locator);
}
