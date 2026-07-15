import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';

// S3 업로드(presigned URL 발급) 기능 묶음
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
