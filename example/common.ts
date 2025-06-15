import type { FastifyInstance } from "fastify";
import { type PluginLocator } from "../lib/di.ts";
import { globalErrorHandlerPlugin } from "./plugins/infrastructure/error-handler.ts";
import { rateLimitPlugin } from "./plugins/infrastructure/rate-limit.ts";
import { type AppSession, sessionPlugin } from "./plugins/infrastructure/session.ts";
import { underPressurePlugin } from "./plugins/infrastructure/under-pressure.ts";
import { corsPlugin } from "./plugins/infrastructure/cors.ts";
import { createUsersRoutes } from "./plugins/users/users.routes.ts";
import type { PasswordManagerPlugin } from "./plugins/common/password-manager/password-manager.port.ts";
import { mysqlUsersRepositoryPlugin } from "./plugins/users/mysql-users-repository.ts";
import { createAuthRoutes } from "./plugins/auth/auth.routes.ts";
import { knexPlugin } from "./plugins/infrastructure/knex.ts";
import { appPlugin } from "../lib/app-plugin.ts";
import { sensiblePlugin } from "./plugins/infrastructure/sensible.ts";

export async function registerInfrastructurePlugins(
  fastify: FastifyInstance,
  locator: PluginLocator
) {
  await rateLimitPlugin.register(fastify, locator);
  await globalErrorHandlerPlugin.register(fastify, locator);
  await sessionPlugin.register(fastify, locator);
  await corsPlugin.register(fastify, locator);
  await underPressurePlugin.register(fastify, locator);
  await sensiblePlugin.register(fastify, locator);
}

export function createRootPlugin(passwordManager: PasswordManagerPlugin) {
  return appPlugin({
    name: "application",
    opts: {
      prefix: "/api",
    },
    childPlugins: [
      createUsersRoutes(mysqlUsersRepositoryPlugin, passwordManager),
      createAuthRoutes(mysqlUsersRepositoryPlugin, passwordManager, knexPlugin),
    ],
    configure(fastify) {
      fastify.get('/', async () => {
        return {
          message: 'Welcome!'
        }
      })

      fastify.addHook("onRequest", async (request, reply) => {
        if (request.url.startsWith("/api/auth/login")) {
          return;
        }

        if (!request.getDecorator<AppSession>('session').user) {
          reply.unauthorized("You must be authenticated to access this route.");
        }
      });
    },
  });
}
