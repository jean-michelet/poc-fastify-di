import { scopedPlugin } from "../../../lib/scoped-plugin.ts";
import { authService } from "./auth.service.ts";

export const currentUser = scopedPlugin({
  name: "currentUser",
  dependencies: { authService },
  expose: async (req, { authService }) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    if (!token) return { user: null };

    const payload = await authService.verifyToken(token!);
    
    return { user: payload };
  },
});
