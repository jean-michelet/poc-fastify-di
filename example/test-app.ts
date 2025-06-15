import type {
  InjectOptions,
  LightMyRequestResponse,
} from "fastify";
import { type TestContext } from "node:test";
import { appPlugin } from "../lib/app-plugin.ts";
import { createApp } from "../lib/di.ts";
import assert from "node:assert";
import { registerInfrastructurePlugins } from "./register-infrastructure.ts";
import { createAuthRoutes } from "./plugins/auth/auth.routes.ts";
import { passwordManagerPlugin } from "./plugins/common/password-manager/scrypt-password-manager.ts";
import { knexPlugin } from "./plugins/infrastructure/knex.ts";
import { mysqlUsersRepositoryPlugin } from "./plugins/users/mysql-users-repository.ts";
import { createUsersRoutes } from "./plugins/users/users.routes.ts";
import type { PasswordManagerPlugin } from "./plugins/common/password-manager/password-manager.port.ts";
import type { Knex } from "knex";

export function expectValidationError(
  res: LightMyRequestResponse,
  expectedMessage: string
) {
  assert.strictEqual(res.statusCode, 400);
  const { message } = JSON.parse(res.payload);
  assert.strictEqual(message, expectedMessage);
}

// Use the name in .env file
export const testCookieName = "session";

interface Replaceable {
  passwordManager?: PasswordManagerPlugin;
}

export async function createTestApp(
  t: TestContext,
  replaceable: Replaceable = {}
) {
  const passwordManager = replaceable.passwordManager ?? passwordManagerPlugin;

  let knex: Knex = {} as Knex;
  const app = await createApp({
    async onFastifyCreated(fastify, locator) {
      await registerInfrastructurePlugins(fastify, locator);
      knex = await knexPlugin.register(fastify, locator);

      fastify.get("/", async () => {
        return {
          ok: true,
        };
      });

      // To test global error handling
      fastify.get("/error", () => {
        throw new Error("Kaboom!");
      });
    },
    rootPlugin: appPlugin({
      name: "application",
      opts: {
        prefix: "/api",
      },
      childPlugins: [
        createUsersRoutes(mysqlUsersRepositoryPlugin, passwordManager),
        createAuthRoutes(
          mysqlUsersRepositoryPlugin,
          passwordManager,
          knexPlugin
        ),
      ],
    }),
  });

  t.after(() => app.close());

  async function login(email: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email,
        password: "Password123$",
      },
    });

    const sessionCookie = response.cookies.find(
      (c) => c.name === testCookieName
    );

    /* c8 ignore start - Not part of tests */
    if (!sessionCookie) {
      throw new Error("Session cookie not found after login.");
    }

    return sessionCookie.value;
  }
  /* c8 ignore end */

  async function injectWithLogin(email: string, opts: InjectOptions) {
    const session = await login(email);

    opts.cookies = {
      ...opts.cookies,
      [testCookieName]: session,
    };

    return app.inject(opts);
  }

  return {
    ...app,
    login,
    injectWithLogin,
    knex,
  };
}
