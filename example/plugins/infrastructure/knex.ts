import knex, { type Knex } from "knex";
import {
  servicePlugin,
  type ServicePluginInstance,
} from "../../../lib/service-plugin.ts";
import { configPlugin } from "./config.ts";

export type KnexPlugin = ServicePluginInstance<Knex>;

export const knexPlugin = servicePlugin({
  name: "knex",
  lifecycle: "singleton",
  dependencies: {
    config: configPlugin,
  },
  expose({ config }) {
    return knex({
      client: "mysql2",
      connection: {
        host: config.MYSQL_HOST,
        user: config.MYSQL_USER,
        password: config.MYSQL_PASSWORD,
        database: config.MYSQL_DATABASE,
        port: Number(config.MYSQL_PORT),
      },
      pool: { min: 2, max: 10 },
    });
  },
  async onClose(knex) {
    await knex.destroy();
  },
});
