import { describe, expect, it } from "vitest";

import { findTakenSignUpFields } from "@/lib/services/users";

import { createUser } from "../support/factories";

describe("findTakenSignUpFields(F-01)", () => {
  it("使われているユーザー名・メールアドレスを項目ごとに返す", async () => {
    await createUser("taro"); // taro@example.test

    expect(await findTakenSignUpFields("hanako", "hanako@example.test")).toEqual({ username: false, email: false });
    expect(await findTakenSignUpFields("taro", "hanako@example.test")).toEqual({ username: true, email: false });
    expect(await findTakenSignUpFields("hanako", "taro@example.test")).toEqual({ username: false, email: true });
    expect(await findTakenSignUpFields("taro", "taro@example.test")).toEqual({ username: true, email: true });
  });

  it("別々のユーザーがユーザー名とメールアドレスを使っている場合も両方返す", async () => {
    await createUser("taro");
    await createUser("jiro");
    expect(await findTakenSignUpFields("taro", "jiro@example.test")).toEqual({ username: true, email: true });
  });
});
