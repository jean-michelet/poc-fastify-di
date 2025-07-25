import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { type TestContext } from "node:test";
import { createApp } from "../lib/di.ts";
import assert from "node:assert";
import { createRootPlugin, registerInfrastructurePlugins } from "./common.ts";
import { passwordManagerPlugin } from "./plugins/common/password-manager/scrypt-password-manager.ts";
import { knexPlugin } from "./plugins/infrastructure/knex.ts";
import type { PasswordManagerPlugin } from "./plugins/common/password-manager/password-manager.port.ts";
import type { Knex } from "knex";

export type TestAppInstance = Awaited<ReturnType<typeof createTestApp>>

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
  const rootPlugin = createRootPlugin(passwordManager);

  let knex: Knex = {} as Knex;
  const app = await createApp({
    async onFastifyCreated(fastify, locator) {
      await registerInfrastructurePlugins(fastify, locator);
      knex = await knexPlugin.register(fastify, locator);

      // To test CORS
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
    rootPlugin,
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
