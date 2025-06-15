import type { Knex } from "knex";
import { servicePlugin } from "../../../lib/service-plugin.ts";
import { knexPlugin } from "../infrastructure/knex.ts";
import { type UsersRepositoryPlugin } from "./users-repository.port.ts";
import type { FullUser } from "./user.schema.ts";

export const mysqlUsersRepositoryPlugin: UsersRepositoryPlugin = servicePlugin({
  name: "mysql-users-repository",
  dependencies: {
    knex: knexPlugin,
  },
  async expose({ knex }) {
    return {
      async findByEmail(email: string, trx?: Knex) {
        const user: FullUser | undefined = await (trx ?? knex)("users")
          .select("id", "username", "password", "email")
          .where({ email })
          .first();

        return user;
      },

      async updatePassword(email: string, hashedPassword: string) {
        return knex("users")
          .update({ password: hashedPassword })
          .where({ email });
      },

      async findUserRolesByEmail(email: string, trx: Knex) {
        const roles: { name: string }[] = await trx("roles")
          .select("roles.name")
          .join("user_roles", "roles.id", "user_roles.role_id")
          .join("users", "user_roles.user_id", "users.id")
          .where("users.email", email);

        return roles;
      },
    };
  },
});
