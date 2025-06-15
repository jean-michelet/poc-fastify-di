import closeWithGrace from "close-with-grace";
import { createApp } from "../lib/di.ts";
import { passwordManagerPlugin } from "./plugins/common/password-manager/scrypt-password-manager.ts";
import {
  createRootPlugin,
  registerInfrastructurePlugins,
} from "./common.ts";

/**
 * Do not use NODE_ENV to determine what logger (or any env related feature) to use
 * @see {@link https://www.youtube.com/watch?v=HMM7GJC5E2o}
 */
function getLoggerOptions() {
  // Only if the program is running in an interactive terminal
  if (process.stdout.isTTY) {
    return {
      level: "info",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    };
  }

  return { level: process.env.LOG_LEVEL ?? "silent" };
}

const app = await createApp({
  serverOptions: {
    logger: getLoggerOptions(),
    ajv: {
      customOptions: {
        coerceTypes: "array", // change type of data to match type keyword
        removeAdditional: "all", // Remove additional body properties
      },
    },
  },
  onFastifyCreated: registerInfrastructurePlugins,
  rootPlugin: createRootPlugin(passwordManagerPlugin),
});

closeWithGrace(
  { delay: Number(process.env.FASTIFY_CLOSE_GRACE_DELAY ?? 500) },
  async ({ err }) => {
    if (err != null) {
      app.log.error(err);
    }

    await app.close();
  }
);

try {
  // Start listening.
  await app.listen({ port: Number(process.env.PORT ?? 3000) });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
