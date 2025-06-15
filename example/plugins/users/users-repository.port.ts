import type { Knex } from "knex";
import type { ServicePluginInstance } from "../../../lib/service-plugin.ts";
import type { FullUser } from "./user.schema.ts";

export interface UsersRepository {
  findByEmail(email: string, trx?: Knex): Promise<FullUser | undefined>;
  updatePassword(email: string, hashedPassword: string): Promise<number>;
  findUserRolesByEmail(email: string, trx: Knex): Promise<{ name: string }[]>;
}

export type UsersRepositoryPlugin = ServicePluginInstance<UsersRepository>;
