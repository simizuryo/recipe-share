import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "@/lib/auth";

/** ブラウザ側(Client Components)から使う認証クライアント。同じオリジンの /api/auth を呼ぶ */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
