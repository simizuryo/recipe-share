import { describe, expect, it } from "vitest";

import {
  checkImage,
  detectImageType,
  IMAGE_ERRORS,
  imageUrl,
  isImageKey,
  MAX_IMAGE_BYTES,
  readImageField,
} from "@/lib/validation/image";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
// "RIFF" + サイズ + "WEBP"
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
// "GIF89a"
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
// "RIFF" + サイズ + "WAVE"(WebP と同じ RIFF 形式の音声ファイル)
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);

describe("detectImageType", () => {
  it("JPEG・PNG・WebP をファイルの先頭のバイトで判定する", () => {
    expect(detectImageType(JPEG)).toBe("jpeg");
    expect(detectImageType(PNG)).toBe("png");
    expect(detectImageType(WEBP)).toBe("webp");
  });

  it("対応していない形式・RIFF でも WebP でないもの・短すぎるものは null", () => {
    expect(detectImageType(GIF)).toBeNull();
    expect(detectImageType(WAV)).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).toBeNull();
  });
});

describe("checkImage", () => {
  it("上限は 4MB で、フォームの文字と合わせても Vercel のリクエスト上限(4.5MB)に収まる", () => {
    expect(MAX_IMAGE_BYTES).toBe(4 * 1024 * 1024);
    // フォームの文字は最大でも数十KB。余裕を見て 200KB を足しても 4.5MB(10進)以下
    expect(MAX_IMAGE_BYTES + 200_000).toBeLessThanOrEqual(4_500_000);
  });

  it("4MB ちょうどまでは受け付ける", () => {
    expect(checkImage(MAX_IMAGE_BYTES, PNG)).toEqual({ ok: true, type: "png" });
  });

  it("4MB を超えるものは、形式が正しくても受け付けない", () => {
    expect(checkImage(MAX_IMAGE_BYTES + 1, JPEG)).toEqual({ ok: false, error: IMAGE_ERRORS.size });
  });

  it("空のファイル・画像でないファイルは受け付けない", () => {
    expect(checkImage(0, JPEG)).toEqual({ ok: false, error: IMAGE_ERRORS.empty });
    expect(checkImage(1000, GIF)).toEqual({ ok: false, error: IMAGE_ERRORS.type });
  });
});

describe("isImageKey / imageUrl", () => {
  const key = "recipes/0b7c3f9e-1d2a-4c5b-8e6f-123456789abc.webp";

  it("recipes/<UUID>.<拡張子> の形だけを写真のキーとして受け付ける", () => {
    expect(isImageKey(key)).toBe(true);
    expect(isImageKey("recipes/0b7c3f9e-1d2a-4c5b-8e6f-123456789abc.gif")).toBe(false);
    expect(isImageKey("recipes/../secret.jpg")).toBe(false);
    expect(isImageKey(`other/${key.slice(8)}`)).toBe(false);
    expect(isImageKey(`${key}?x=1`)).toBe(false);
  });

  it("表示用の URL は /api/images/<キー>", () => {
    expect(imageUrl(key)).toBe(`/api/images/${key}`);
  });
});

describe("readImageField", () => {
  const form = (entries: [string, string | File][]) => {
    const fd = new FormData();
    for (const [k, v] of entries) fd.append(k, v);
    return fd;
  };

  it("ファイルを選ばずに送信したら(サイズ 0 の File。名前は空や blob)、写真の指定なし", async () => {
    const empty = new File([], "", { type: "application/octet-stream" });
    expect(await readImageField(form([["image", empty]]))).toEqual({ ok: true, upload: null, remove: false });
    const blob = new File([], "blob", { type: "application/octet-stream" });
    expect(await readImageField(form([["image", blob], ["removeImage", "on"]]))).toEqual({ ok: true, upload: null, remove: true });
    expect(await readImageField(form([]))).toEqual({ ok: true, upload: null, remove: false });
  });

  it("「写真を削除」にチェックがあれば remove", async () => {
    expect(await readImageField(form([["removeImage", "on"]]))).toEqual({ ok: true, upload: null, remove: true });
  });

  it("正しい画像は中身と形式を返し、削除のチェックより差し替えを優先する", async () => {
    const file = new File([PNG, new Uint8Array(100)], "photo.png", { type: "image/png" });
    const result = await readImageField(form([["image", file], ["removeImage", "on"]]));
    expect(result.ok && result.upload?.type).toBe("png");
    expect(result.ok && result.upload?.bytes.byteLength).toBe(112);
    expect(result.ok && result.remove).toBe(false);
  });

  it("拡張子や Content-Type が画像でも、中身が画像でなければエラー", async () => {
    const fake = new File([GIF], "photo.jpg", { type: "image/jpeg" });
    expect(await readImageField(form([["image", fake]]))).toEqual({ ok: false, error: IMAGE_ERRORS.type });
  });

  it("4MB を超えるファイルはエラー", async () => {
    const big = new File([JPEG, new Uint8Array(MAX_IMAGE_BYTES)], "big.jpg", { type: "image/jpeg" });
    expect(await readImageField(form([["image", big]]))).toEqual({ ok: false, error: IMAGE_ERRORS.size });
  });
});
