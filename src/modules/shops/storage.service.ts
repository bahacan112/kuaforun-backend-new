import type { IStorageUploader, StorageObject, UploadInput } from '../../core/contracts/storage'
import { uploadObject } from '../../core/storage/s3'

export class S3StorageUploader implements IStorageUploader {
  async upload(input: UploadInput): Promise<StorageObject> {
    const { key, body, contentType } = input
    return uploadObject({ key, body, contentType })
  }
}