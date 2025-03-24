import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientsService } from '../../clients/services/clients.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { CreateSignatureDto } from '../dto/create-signature.dto';
import { SignatureType } from '../entities/signature.entity';
import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { MinioS3Service } from 'src/minio-s3/minio-s3.service';

@Injectable()
export class SignaturesService {
  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
    private documentsService: DocumentsService,
    private s3: MinioS3Service,
  ) {}

  async findAll() {
    return this.prisma.signature.findMany();
  }

  async findOne(id: string) {
    const signature = await this.prisma.signature.findUnique({ where: { id } });
    if (!signature) {
      throw new NotFoundException(`Assinatura com ID ${id} não encontrada`);
    }
    return signature;
  }

  async findByDocumentId(documentId: string) {
    return this.prisma.signature.findMany({ where: { documentId } });
  }

  async createAdvancedSignature(
    documentId: string,
    createSignatureDto: CreateSignatureDto,
  ) {
    const client = await this.clientsService.findByCpf(
      this.documentsService.smartSanitizeIdentifier(
        createSignatureDto.signerCpf,
      ),
    );

    const document = await this.documentsService.findOne(documentId);

    // Verificações
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    if (!document) {
      throw new NotFoundException('Documento não encontrado');
    }

    try {
      const filePath = await this.s3.downloadFile(
        process.env.MINIO_BUCKET,
        document.originalName,
      );
      const fileBuffer = await this.documentsService.BufferGenerate(filePath);
      const timestamp = new Date().toISOString();

      const signatureData = crypto
        .createHash('sha256')
        .update(Buffer.concat([fileBuffer, Buffer.from(timestamp)]))
        .digest('hex');

      const signature = await this.prisma.signature.create({
        data: {
          signerId: client.id, // Mudança aqui: use o CPF, não o ID
          type: SignatureType.ADVANCED,
          documentId: document.id,
          certificateId: createSignatureDto.certificateId,
          signatureData,
        },
      });

      await this.createSignatureCertificate(
        document.id,
        createSignatureDto.certificateId,
      );

      await this.prisma.document.update({
        where: { id: document.id },
        data: { isSigned: true },
      });

      return signature;
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      throw new InternalServerErrorException('Erro ao processar assinatura');
    }
  }

  // async createQualifiedSignature(createSignatureDto: CreateSignatureDto) {
  //   if (createSignatureDto.type !== SignatureType.ICP_BRASIL) {
  //     throw new BadRequestException(
  //       'Tipo de assinatura inválido para assinatura qualificada',
  //     );
  //   }
  //   if (!createSignatureDto.certificateId) {
  //     throw new BadRequestException(
  //       'Certificado obrigatório para assinatura qualificada',
  //     );
  //   }

  //   const client = await this.clientsService.findByCpf(
  //     createSignatureDto.signerCpf,
  //   );
  //   const document = await this.documentsService.findOne(
  //     createSignatureDto.documentId,
  //   );
  //   const certificate = await this.prisma.certificate.findUnique({
  //     where: { id: createSignatureDto.certificateId },
  //   });
  //   if (!certificate || certificate.clientId !== client.id) {
  //     throw new BadRequestException(
  //       'O certificado não pertence ao usuário especificado',
  //     );
  //   }

  //   const filePath = join(process.cwd(), document.storagePath);
  //   const fileBuffer = readFileSync(filePath);
  //   const documentHash = crypto
  //     .createHash('sha256')
  //     .update(fileBuffer)
  //     .digest();
  //   const privateKey = forge.pki.privateKeyFromPem(certificate.privateKey);
  //   const md = forge.md.sha256.create();
  //   md.update(documentHash.toString('binary'));
  //   const signatureHex = forge.util.bytesToHex(privateKey.sign(md));

  //   const signature = await this.prisma.signature.create({
  //     data: {
  //       signerId: client.id,
  //       type: SignatureType.ICP_BRASIL,
  //       documentId: document.id,
  //       certificateId: certificate.id,
  //       signatureData: signatureHex,
  //     },
  //   });

  //   await this.prisma.document.update({
  //     where: { id: document.id },
  //     data: { isSigned: true },
  //   });

  //   return signature;
  // }

  async createSignatureCertificate(documentId: string, certificateId: string) {
    try {
      // Buscar documento no banco de dados
      const documento = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { client: true, signatures: true },
      });

      if (!documento) {
        throw new Error('Documento não encontrado');
      }

      if (documento.isSigned) {
        throw new Error('Documento já assinado');
      }

      // Buscar informações do certificado
      const certificadoInfos = await this.prisma.certificate.findUnique({
        where: { id: certificateId },
        include: { client: true },
      });

      if (!certificadoInfos) {
        throw new Error('Certificado não encontrado');
      }

      const pfxFolderPath = dirname(certificadoInfos.pathCertificate);

      const pfxPath = join(process.cwd(), certificadoInfos.pathCertificate);

      if (!existsSync(pfxFolderPath)) {
        mkdirSync(join(process.cwd(), pfxFolderPath));
        const privateKeyPath = join(
          process.cwd(),
          pfxFolderPath,
          'private_key.pem',
        );

        writeFileSync(privateKeyPath, certificadoInfos.privateKey, 'utf-8');
        const certPath = join(
          process.cwd(),
          pfxFolderPath,
          `${this.limparTexto(certificadoInfos.client.name)}.pem`,
        );

        writeFileSync(certPath, certificadoInfos.certificatePem, 'utf-8');
        const caPath = join(
          process.cwd(),
          'uploads',
          'certificados',
          'ca',
          'ca_cert.pem',
        );
        const password = '1234';

        try {
          execSync(
            `openssl pkcs12 -export -out ${pfxPath} -inkey ${privateKeyPath} -in ${certPath} -certfile ${caPath} -passout pass:${password} `,
            { stdio: 'inherit' },
          );
          console.log('Pasta criada com sucesso');
        } catch (error) {
          console.log('Erro ao criar pasta:', error);
          throw new Error('Erro ao criar pasta');
        }
      }
//TODO arumar isso
      //lib/JSignPdf.jar
      const SENHA = '1234';
      const OUTPUT_DIR = join(process.cwd(), 'uploads', 'manifest_ass');
      const INPUT_PDF = join(process.cwd(), documento.storageManifest);
      const ORIGINAL_PATH = join(process.cwd(), documento.storagePath);
      const rotaOutputPdf = `uploads/manifest_ass`;
      const FILENAME = `manifest_ass_${documento.originalName}`;
      const OUTPUT_PDF = join(process.cwd(), rotaOutputPdf);

      try {
        const shell = join(process.cwd(), 'lib');
        const Java = 'JSignPdf.jar';
        execSync(
          `cd ${shell} && ./assinar_pdf.sh ${pfxPath} ${SENHA} ${INPUT_PDF} ${OUTPUT_DIR} ${documento.client.email || ''} ${OUTPUT_PDF} ${Java} ${FILENAME}`,
          { stdio: 'inherit' },
        );
        console.log('✅ PDF assinado e salvo como:', OUTPUT_PDF);
      } catch (error) {
        console.log('Erro ao assinar PDF:', error);
        throw new Error('Erro ao assinar PDF: ' + error);
      }

      unlinkSync(INPUT_PDF);
      unlinkSync(ORIGINAL_PATH);

      // Atualize o banco de dados
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ValidSigned: true,
          storageManifest: rotaOutputPdf + FILENAME,
          storagePath: '',
        },
      });

      return {
        documentId,
        OUTPUT_PDF,
      };
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      throw new InternalServerErrorException(`Erro: ${error.message}`);
    }
  }

  limparTexto(texto: string): string {
    return texto
      .normalize('NFD') // Normaliza para decompor caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '_') // Remove espaços em excesso
      .toUpperCase(); // Converte para maiúsculas
  }

  createSignaturePlaceholder(length: number): string {
    return '0'.repeat(length);
  }

  extractCertInfo(cert: forge.pki.Certificate) {
    const subject = cert.subject.attributes;

    const findAttribute = (shortName: string) => {
      const attr = subject.find(
        (attr: { shortName: string }) => attr.shortName === shortName,
      );
      return attr ? attr.value : undefined;
    };

    return {
      commonName: findAttribute('CN') || 'Desconhecido',
      organization: findAttribute('O'),
      organizationalUnit: findAttribute('OU'),
      location: findAttribute('L'),
      state: findAttribute('ST'),
      country: findAttribute('C'),
      email: findAttribute('E'),
    };
  }

  smartSanitizeIdentifier(input: string): string {
    if (!input) return '';

    // Remove todos os caracteres não numéricos
    const numericOnly = input.replace(/[^\d]/g, '');

    // Se for exatamente 11 ou 14 dígitos numéricos
    if (numericOnly.length === 11 || numericOnly.length === 14) {
      return numericOnly;
    }

    // Para nomes de arquivos
    const sanitized = input
      .normalize('NFD') // Normaliza caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // Substitui caracteres inválidos
      .replace(/\s+/g, '_') // Substitui múltiplos espaços
      .toLowerCase(); // Converte para minúsculas

    return sanitized;
  }
}
