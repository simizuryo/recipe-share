import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth のエンドポイント(/api/auth/sign-up/email、/api/auth/sign-in/email など)
export const { GET, POST } = toNextJsHandler(auth);
