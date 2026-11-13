import "server-only";

import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import { IMAGE_CONTENT_TYPES, IMAGE_EXTENSIONS, type ImageType } from "@/lib/validation/image";
import { logger } from "@/lib/logger";

/**
 * 完成写真(F-09)の保存先。S3 互換 API で読み書きする。
 * ローカルは RustFS(docker-compose の storage)、本番は Supabase Storage。接続先は .env の S3_* で切り替える。
 */
let client: S3Client | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません`);
  return value;
}

function getClient(): S3Client {
  client ??= new S3Client({
    endpoint: requireEnv("S3_ENDPOINT"),
    region: requireEnv("S3_REGION"),
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
    // RustFS・Supabase Storage は「エンドポイント/バケット名/キー」の形の URL を使う
    forcePathStyle: true,
    // S3 互換ストレージには、SDK が既定で付けるチェックサムに対応していないものがあるため、必要なときだけ付ける
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function bucket(): string {
  return requireEnv("S3_BUCKET");
}

/** 新しい写真のキー。毎回新しい名前にするので、同じ URL の中身が変わることはない(長くキャッシュできる) */
export function newImageKey(type: ImageType): string {
  return `recipes/${randomUUID()}.${IMAGE_EXTENSIONS[type]}`;
}

export async function putImage(key: string, body: Uint8Array, type: ImageType): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: IMAGE_CONTENT_TYPES[type],
      ContentLength: body.byteLength,
    }),
  );
}

export type StoredImage = { body: ReadableStream; contentType: string; contentLength?: number };

/** 写真を読み出す。見つからなければ null */
export async function getImage(key: string): Promise<StoredImage | null> {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
      contentLength: res.ContentLength,
    };
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return null;
    throw error;
  }
}

/**
 * 写真を削除する。失敗してもレシピの保存・削除は止めず、ログに残すだけにする(非機能要件)。
 * 残ったファイルは、ログを見て手で消す。
 */
export async function deleteImageQuietly(key: string | null | undefined, reason: string): Promise<void> {
  if (!key) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  } catch (error) {
    logger.error("写真ファイルの削除に失敗しました", { key, reason, error });
  }
}
