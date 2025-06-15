import { type TypeBoxTypeProvider, Type } from "@fastify/type-provider-typebox";

import { appPlugin } from "../../../lib/app-plugin.ts";
import type { PasswordManagerPlugin } from "../common/password-manager/password-manager.port.ts";
import { UpdateCredentialsSchema } from "./user.schema.ts";
import type { UsersRepositoryPlugin } from "./users-repository.port.ts";
import type { AppSession } from "../infrastructure/session.ts";

export function createUsersRoutes(
  usersRepositoryPlugin: UsersRepositoryPlugin,
  passwordManagerPlugin: PasswordManagerPlugin
) {
  return appPlugin({
    name: "users-routes",
    dependencies: {
      services: { usersRepositoryPlugin, passwordManagerPlugin },
    },
    opts: {
      prefix: "users",
    },
    async configure(fastify_, { services }) {
      const fastify = fastify_.withTypeProvider<TypeBoxTypeProvider>();

      const repo = services.usersRepositoryPlugin;
      const manager = services.passwordManagerPlugin;

      fastify.put(
        "/update-password",
        {
          config: {
            rateLimit: {
              max: 3,
              timeWindow: "1 minute",
            },
          },
          schema: {
            body: UpdateCredentialsSchema,
            response: {
              200: Type.Object({
                message: Type.String(),
              }),
              401: Type.Object({
                message: Type.String(),
              }),
            },
            tags: ["Users"],
          },
        },
        async function (request, reply) {
          const { newPassword, currentPassword } = request.body;

          const { email } = request.getDecorator<AppSession>("session").user;

          const user = await repo.findByEmail(email);
          if (!user) {
            return reply.code(401).send({ message: "User does not exist." });
          }

          const isPasswordValid = await manager.compare(
            currentPassword,
            user.password
          );
          if (!isPasswordValid) {
            return reply
              .code(401)
              .send({ message: "Invalid current password." });
          }

          if (newPassword === currentPassword) {
            reply.status(400);
            return {
              message:
                "New password cannot be the same as the current password.",
            };
          }

          const hashedPassword = await manager.hash(newPassword);
          await repo.updatePassword(email, hashedPassword);

          return { message: "Password updated successfully" };
        }
      );
    },
  });
}
