// 写真の保存先のバケットを作る(F-09)。ローカルの RustFS で、初回に1回だけ実行する。
//   npm run storage:init
// 本番(Supabase Storage)のバケットは Supabase の管理画面で作る(非公開のバケットにする)。
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`環境変数 ${name} が設定されていません(.env を確認してください)`);
  return value;
};

const client = new S3Client({
  endpoint: env("S3_ENDPOINT"),
  region: env("S3_REGION"),
  credentials: { accessKeyId: env("S3_ACCESS_KEY_ID"), secretAccessKey: env("S3_SECRET_ACCESS_KEY") },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
const Bucket = env("S3_BUCKET");

try {
  await client.send(new HeadBucketCommand({ Bucket }));
  console.log(`バケット ${Bucket} はすでにあります`);
} catch (error) {
  if (error?.$metadata?.httpStatusCode !== 404) throw error;
  await client.send(new CreateBucketCommand({ Bucket }));
  console.log(`バケット ${Bucket} を作りました`);
}
