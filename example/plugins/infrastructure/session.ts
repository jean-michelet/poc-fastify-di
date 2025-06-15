import fastifySession from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import { appPlugin } from "../../../lib/app-plugin.ts";
import { configPlugin } from "./config.ts";
import type { Auth } from '../auth/auth.schema.ts'

export interface AppSession {
  user: Auth;
}

export const sessionPlugin = appPlugin({
  name: "session",
  encapsulate: false,
  dependencies: {
    services: { config: configPlugin },
  },
  configure(fastify, { services: { config } }) {
    fastify.register(fastifyCookie);

    /**
     * This plugins enables the use of session.
     *
     * @see {@link https://github.com/fastify/session}
     */
    fastify.register(fastifySession, {
      secret: config.COOKIE_SECRET,
      cookieName: config.COOKIE_NAME,
      cookie: {
        secure: config.COOKIE_SECURED,
        httpOnly: true,
        maxAge: 1800000,
      },
    });
  },
});
