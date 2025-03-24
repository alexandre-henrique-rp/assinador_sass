import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class MinioS3Service {
  // private minioClient: Client;

  // constructor() {
  //   this.minioClient = new Client({
  //     // endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  //     endPoint: 'apiminio.kingdevtec.com',
  //     // port: Number(process.env.MINIO_PORT) || 9000,
  //     port: 9001,
  //     useSSL: true, // Defina como true se estiver usando HTTPS
  //     accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  //     secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  //   });
  // }

  // async uploadFile(
  //   bucket: string,
  //   fileName: string,
  //   fileBuffer: Buffer,
  //   fileBufferSize: number,
  //   mimeType: string,
  // ) {
  //   return await this.minioClient.putObject(
  //     bucket,
  //     fileName,
  //     fileBuffer,
  //     fileBufferSize,
  //     {
  //       'Content-Type': mimeType,
  //     },
  //   );
  // }

  // async getFileUrl(bucket: string, fileName: string) {
  //   return await this.minioClient.presignedUrl(
  //     'GET',
  //     bucket,
  //     fileName,
  //     24 * 60 * 60,
  //   );
  // }

  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.MINIO_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      },
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000', // MinIO ou AWS
      forcePathStyle: true, // Necessário para MinIO
    });
  }

  async uploadFile(
    bucketName: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ) {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    return await this.s3Client.send(command);
  }

  async getFileUrl(bucketName: string, fileName: string) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }
}
