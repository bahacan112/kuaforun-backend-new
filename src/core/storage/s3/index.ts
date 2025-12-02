import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '@shared/config'

type UploadParams = {
  key: string
  body: Uint8Array | Buffer
  contentType?: string
}

let cachedClient: S3Client | null = null

function getS3Client(): S3Client {
  if (cachedClient) return cachedClient
  const s3 = config.storage?.s3 ?? {}
  cachedClient = new S3Client({
    region: s3.region || 'us-east-1',
    endpoint: s3.endpoint,
    forcePathStyle: Boolean(s3.endpoint),
    credentials: s3.accessKeyId && s3.secretAccessKey ? {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    } : undefined,
  })
  return cachedClient
}

function buildPublicUrl(key: string): string | undefined {
  const s3 = config.storage?.s3 ?? {}
  if (!s3.publicBaseUrl) return undefined
  try {
    const url = new URL(s3.publicBaseUrl)
    // Join ensuring single slash and include bucket for path-style
    url.pathname = [url.pathname.replace(/\/$/, ''), s3.bucket, key].filter(Boolean).join('/')
    return url.toString()
  } catch {
    return undefined
  }
}

export async function uploadObject({ key, body, contentType }: UploadParams): Promise<{ key: string; url?: string }> {
  const s3 = config.storage?.s3 ?? {}
  if (!s3.bucket) throw new Error('S3 bucket is not configured')

  const client = getS3Client()
  const put = new PutObjectCommand({
    Bucket: s3.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  })

  await client.send(put)

  const url = buildPublicUrl(key)
  return { key, url }
}

export async function getPresignedPutUrl(key: string, contentType?: string): Promise<{ uploadUrl: string; expiresIn: number }> {
  const s3 = config.storage?.s3 ?? {}
  if (!s3.bucket) throw new Error('S3 bucket is not configured')
  const client = getS3Client()
  const put = new PutObjectCommand({ Bucket: s3.bucket, Key: key, ContentType: contentType })
  const expiresIn = 900
  const signer = getSignedUrl as unknown as (client: unknown, command: unknown, opts: { expiresIn: number }) => Promise<string>
  const uploadUrl = await signer(client, put, { expiresIn })
  return { uploadUrl, expiresIn }
}