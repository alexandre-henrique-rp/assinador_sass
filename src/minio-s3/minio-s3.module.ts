import { Global, Module } from '@nestjs/common';
import { MinioS3Service } from './minio-s3.service';

@Global()
@Module({
  providers: [MinioS3Service],
  exports: [MinioS3Service],
})
export class MinioS3Module {}
