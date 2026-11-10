import "server-only";

import { getDb } from "@/lib/db";

/** 登録時に、ユーザー名・メールアドレスのうち既に使われているものを返す(F-01) */
export async function findTakenSignUpFields(
  username: string,
  email: string,
): Promise<{ username: boolean; email: boolean }> {
  const taken = await getDb().user.findMany({
    where: { OR: [{ username }, { email }] },
    select: { username: true, email: true },
  });
  return {
    username: taken.some((u) => u.username === username),
    email: taken.some((u) => u.email === email),
  };
}
