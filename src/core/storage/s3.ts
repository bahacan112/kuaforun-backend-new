import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { UploadInput, StorageObject } from '../contracts/storage'
import { env } from '../env'

function createS3Client(): S3Client {
  const region = env.S3_REGION ?? 'us-east-1'
  const endpoint = env.S3_ENDPOINT
  const accessKeyId = env.S3_ACCESS_KEY_ID
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials are not configured (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)')
  }

  return new S3Client({
    region,
    endpoint,
    // R2/MinIO gibi S3 uyumlu servisler için path-style önerilir
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  })
}

function getBucket(): string {
  const bucket = env.S3_BUCKET
  if (!bucket) throw new Error('S3 bucket is not configured (S3_BUCKET)')
  return bucket
}

function buildPublicUrl(key: string): string | undefined {
  const base = env.S3_PUBLIC_BASE_URL
  const bucket = env.S3_BUCKET
  if (!base || !bucket) return undefined
  try {
    const u = new URL(base)
    // base path sonundaki / işaretini normalize edip bucket ve key ekleyelim
    u.pathname = [u.pathname.replace(/\/$/, ''), bucket, key].filter(Boolean).join('/')
    return u.toString()
  } catch {
    return undefined
  }
}

export async function uploadObject(input: UploadInput): Promise<StorageObject> {
  const client = createS3Client()
  const bucket = getBucket()
  const contentType = input.contentType ?? 'application/octet-stream'

  const put = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: contentType,
  })
  await client.send(put)

  const url = buildPublicUrl(input.key)
  return { key: input.key, url }
}

export async function getPresignedPutUrl(key: string, contentType?: string, expiresInSeconds: number = 900): Promise<{ uploadUrl: string; expiresIn: number }> {
  const client = createS3Client()
  const bucket = getBucket()
  const ct = contentType ?? 'application/octet-stream'
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: ct })
  const signer = getSignedUrl as unknown as (c: unknown, command: unknown, opts: { expiresIn: number }) => Promise<string>
  const uploadUrl = await signer(client as unknown, cmd as unknown, { expiresIn: expiresInSeconds })
  return { uploadUrl, expiresIn: expiresInSeconds }
}