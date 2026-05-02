import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('storage.bucket')!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.get<string>('storage.endpoint'),
      credentials: {
        accessKeyId: config.get<string>('storage.accessKeyId')!,
        secretAccessKey: config.get<string>('storage.secretAccessKey')!,
      },
    });
  }

  async uploadFile(
    buffer: Buffer,
    path: string,
    mimeType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return path;
  }

  async getPresignedUrl(path: string, ttlSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: path }),
      { expiresIn: ttlSeconds },
    );
  }

  async deleteFile(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: path }),
    );
  }
}
