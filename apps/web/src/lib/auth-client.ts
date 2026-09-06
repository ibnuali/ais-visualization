import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";
import { getApiOrigin } from "./api.ts";

export const authClient = createAuthClient({
  baseURL: getApiOrigin(),
  fetchOptions: { credentials: "include" },
  plugins: [usernameClient({ displayUsername: false })],
});
