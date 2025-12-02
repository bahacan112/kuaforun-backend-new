export type StorageObject = {
  key: string
  url?: string
}

export type UploadInput = {
  key: string
  body: Uint8Array | Buffer
  contentType?: string
}

export interface IStorageUploader {
  upload(input: UploadInput): Promise<StorageObject>
}