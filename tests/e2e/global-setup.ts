import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

import { E2E_ENV } from "../../playwright.config";
import { prepareTestDatabase, truncateTestDatabase } from "../support/prepare-database";

/** E2E の前に1回だけ動く。データベースを空の状態にし、写真のバケットを用意する */
export default async function globalSetup() {
  prepareTestDatabase(E2E_ENV.DATABASE_URL);
  truncateTestDatabase(E2E_ENV.DATABASE_URL);

  const s3 = new S3Client({
    endpoint: E2E_ENV.S3_ENDPOINT,
    region: E2E_ENV.S3_REGION,
    credentials: { accessKeyId: E2E_ENV.S3_ACCESS_KEY_ID, secretAccessKey: E2E_ENV.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: E2E_ENV.S3_BUCKET }));
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
    await s3.send(new CreateBucketCommand({ Bucket: E2E_ENV.S3_BUCKET }));
  }
}
