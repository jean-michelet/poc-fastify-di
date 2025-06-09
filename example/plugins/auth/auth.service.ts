import { servicePlugin } from "../../../lib/service-plugin.ts";

export const authService = servicePlugin({
  name: "authService",
  expose: () => ({
    verifyToken: async (token: string) => {
      return token === "secret" ? { userId: "42" } : null;
    },
  }),
});
