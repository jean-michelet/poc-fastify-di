import { Type, type TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

import { appPlugin } from "../../../lib/app-plugin.ts";
import type { PasswordManagerPlugin } from "../common/password-manager/password-manager.port.ts";
import type { UsersRepositoryPlugin } from "../users/users-repository.port.ts";
import type { AppSession } from "../infrastructure/session.ts";
import { CredentialsSchema } from "./auth.schema.ts";
import type { KnexPlugin } from "../infrastructure/knex.ts";

export function createAuthRoutes(
  usersRepository: UsersRepositoryPlugin,
  passwordManager: PasswordManagerPlugin,
  knex: KnexPlugin
) {
  return appPlugin({
    name: "authRoutes",
    dependencies: {
      services: { usersRepository, passwordManager, knex },
    },
    opts: {
      prefix: '/auth'
    },
    async configure(fastify_, { services }) {
      const fastify = fastify_.withTypeProvider<TypeBoxTypeProvider>();
      const repo = services.usersRepository;
      const manager = services.passwordManager;
      const knex = services.knex;

      fastify.post(
        "/login",
        {
          schema: {
            body: CredentialsSchema,
            response: {
              200: Type.Object({
                success: Type.Boolean(),
                message: Type.Optional(Type.String()),
              }),
              401: Type.Object({
                message: Type.String(),
              }),
            },
            tags: ["Authentication"],
          },
        },
        async function (request, reply) {
          const { email, password } = request.body;

          return knex.transaction(async (trx) => {
            const user = await repo.findByEmail(email, trx);

            if (user) {
              const isPasswordValid = await manager.compare(password, user.password);
              if (isPasswordValid) {
                const roles = await repo.findUserRolesByEmail(email, trx);

                request.getDecorator<AppSession>("session").user = {
                  id: user.id,
                  email: user.email,
                  username: user.username,
                  roles: roles.map((role) => role.name),
                };

                await request.session.save();

                return { success: true };
              }
            }

            reply.status(401);
            return { message: "Invalid email or password." };
          });
        }
      );
    },
  });
}
