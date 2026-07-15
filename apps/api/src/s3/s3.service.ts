import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// contentType(image/jpeg 등) → 파일 확장자
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket = process.env.S3_BUCKET!;
  private readonly region = process.env.AWS_REGION!;

  constructor() {
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // 브라우저가 S3에 직접 PUT 업로드할 presigned URL을 발급한다.
  // 원본이 백엔드를 안 거치고 브라우저 → S3로 직행 (서버 대역폭·부하 절감).
  async createUploadUrl(contentType: string) {
    const ext = EXT_BY_CONTENT_TYPE[contentType] ?? 'bin';
    const key = `coach-profiles/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    // 서명 URL은 5분(300초)만 유효 — 발급 직후 한 번 올리는 용도
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 300,
    });
    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
  }
}
