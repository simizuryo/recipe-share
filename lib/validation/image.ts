/**
 * 完成写真(F-09)の検証。ブラウザでもサーバーでも使えるよう、Node や DOM の API に依存しない。
 * 形式は拡張子や Content-Type ではなく、ファイルの先頭のバイト(マジックナンバー)で確かめる。
 */

/**
 * 写真の上限サイズ(4MB)。
 * 本番の Vercel は関数が受け取るリクエスト本体が 4.5MB までなので、フォームの文字(最大でも数十KB)と合わせて収まる 4MB にする(Issue #29)。
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** ファイル選択欄の accept 属性 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export type ImageType = "jpeg" | "png" | "webp";

export const IMAGE_CONTENT_TYPES: Record<ImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/** 形式の判定に必要な先頭のバイト数 */
export const IMAGE_HEADER_BYTES = 12;

export const IMAGE_ERRORS = {
  type: "写真は JPEG・PNG・WebP の画像を選んでください",
  size: "写真は 4MB 以下にしてください",
  empty: "写真のファイルが空です",
} as const;

/** ファイルの先頭のバイトから形式を判定する。対応していない形式は null */
export function detectImageType(header: Uint8Array): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) =>
    header.length >= offset + bytes.length && bytes.every((b, i) => header[offset + i] === b);

  // JPEG: FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // WebP: "RIFF" + 4バイトのサイズ + "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export type ImageCheck = { ok: true; type: ImageType } | { ok: false; error: string };

/** サイズと先頭のバイトで、写真として受け付けられるかを確かめる */
export function checkImage(size: number, header: Uint8Array): ImageCheck {
  if (size === 0) return { ok: false, error: IMAGE_ERRORS.empty };
  if (size > MAX_IMAGE_BYTES) return { ok: false, error: IMAGE_ERRORS.size };
  const type = detectImageType(header);
  if (!type) return { ok: false, error: IMAGE_ERRORS.type };
  return { ok: true, type };
}

/** ストレージに保存した写真のキー。recipes/<UUID>.<拡張子> の形だけを受け付ける */
const IMAGE_KEY_PATTERN = /^recipes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export function isImageKey(value: string): boolean {
  return IMAGE_KEY_PATTERN.test(value);
}

/** 写真を表示する URL(/api/images/ がストレージから読み出して返す) */
export function imageUrl(key: string): string {
  return `/api/images/${key}`;
}

/** フォームから読んだ写真の指定。upload は新しく選んだ写真、remove は「写真を削除」にチェックがあるか */
export type ImageField =
  | { ok: true; upload: { bytes: Uint8Array; type: ImageType } | null; remove: boolean }
  | { ok: false; error: string };

/**
 * フォームの写真欄(name="image")と「写真を削除」(name="removeImage")を読む。
 * ファイルを選ばずに送信すると、サイズ 0 の File が届く(名前は空のことも "blob" などのこともある)ので「指定なし」として扱う。
 * 新しい写真を選んだ場合は、削除のチェックより差し替えを優先する。
 */
export async function readImageField(formData: FormData): Promise<ImageField> {
  const remove = formData.get("removeImage") === "on";
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: true, upload: null, remove };
  }

  // 大きすぎるファイルは中身を読まずに断る
  const header = new Uint8Array(await file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer());
  const check = checkImage(file.size, header);
  if (!check.ok) return check;

  const bytes = new Uint8Array(await file.arrayBuffer());
  return { ok: true, upload: { bytes, type: check.type }, remove: false };
}
