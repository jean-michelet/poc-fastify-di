import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { config as loadEnv } from "dotenv";
import {
  servicePlugin,
  type ServicePluginInstance,
} from "../../../lib/service-plugin.ts";

const EnvSchema = Type.Object({
  PORT: Type.Number({ default: 3000 }),

  MYSQL_HOST: Type.String({ default: "localhost" }),
  MYSQL_PORT: Type.String({ default: "3306" }),
  MYSQL_USER: Type.String({ minLength: 1 }),
  MYSQL_PASSWORD: Type.String({ minLength: 10 }),
  MYSQL_DATABASE: Type.String({ minLength: 1 }),

  COOKIE_SECRET: Type.String({ minLength: 1 }),
  COOKIE_NAME: Type.String({ minLength: 1 }),
  COOKIE_SECURED: Type.Boolean({ default: true }),

  RATE_LIMIT_MAX: Type.Number({ default: 100 }),
});

export type EnvConfig = Static<typeof EnvSchema>;

export type ConfigPlugin = ServicePluginInstance<
  ReturnType<typeof createProps>
>;

function createProps(envPath?: string) {
  loadEnv({ path: envPath, override: true });

  const raw = {
    PORT: Number(process.env.PORT ?? 3000),

    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_USER: process.env.MYSQL_USER,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,

    COOKIE_SECRET: process.env.COOKIE_SECRET,
    COOKIE_NAME: process.env.COOKIE_NAME,
    COOKIE_SECURED:
      process.env.COOKIE_SECURED !== undefined
        ? process.env.COOKIE_SECURED === "true"
        : undefined,

    RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 100),
  };

  return Value.Decode(EnvSchema, raw);
}

export function createConfigPlugin(envPath?: string) {
  return servicePlugin({
    name: "config",
    lifecycle: "singleton",
    expose() {
      return createProps(envPath);
    },
  });
}

export const configPlugin = createConfigPlugin();
