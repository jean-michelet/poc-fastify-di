import { servicePlugin } from "../../../lib/service-plugin.ts";

/**
 * It's obviously not a secure implementation
 */

export const authService = servicePlugin({
  name: "authService",
  expose: () => ({
    verifyToken: async (token: string) => {
      return token === "secret" ? { userId: "42" } : null;
    },
  }),
});
