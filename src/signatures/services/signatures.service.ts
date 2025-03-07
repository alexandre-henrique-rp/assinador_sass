import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClientsService } from '../../clients/services/clients.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { CreateSignatureDto } from '../dto/create-signature.dto';
import { SignatureType } from '../entities/signature.entity';
import { Buffer } from 'node:buffer';
import { exec, execSync } from 'node:child_process';

@Injectable()
export class SignaturesService {
  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
    private documentsService: DocumentsService,
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
      const filePath = path.join(process.cwd(), document.storagePath);
      const fileBuffer = fs.readFileSync(filePath);
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

  async createQualifiedSignature(createSignatureDto: CreateSignatureDto) {
    if (createSignatureDto.type !== SignatureType.ICP_BRASIL) {
      throw new BadRequestException(
        'Tipo de assinatura inválido para assinatura qualificada',
      );
    }
    if (!createSignatureDto.certificateId) {
      throw new BadRequestException(
        'Certificado obrigatório para assinatura qualificada',
      );
    }

    const client = await this.clientsService.findByCpf(
      createSignatureDto.signerCpf,
    );
    const document = await this.documentsService.findOne(
      createSignatureDto.documentId,
    );
    const certificate = await this.prisma.certificate.findUnique({
      where: { id: createSignatureDto.certificateId },
    });
    if (!certificate || certificate.clientId !== client.id) {
      throw new BadRequestException(
        'O certificado não pertence ao usuário especificado',
      );
    }

    const filePath = path.join(process.cwd(), document.storagePath);
    const fileBuffer = fs.readFileSync(filePath);
    const documentHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest();
    const privateKey = forge.pki.privateKeyFromPem(certificate.privateKey);
    const md = forge.md.sha256.create();
    md.update(documentHash.toString('binary'));
    const signatureHex = forge.util.bytesToHex(privateKey.sign(md));

    const signature = await this.prisma.signature.create({
      data: {
        signerId: client.id,
        type: SignatureType.ICP_BRASIL,
        documentId: document.id,
        certificateId: certificate.id,
        signatureData: signatureHex,
      },
    });

    await this.prisma.document.update({
      where: { id: document.id },
      data: { isSigned: true },
    });

    return signature;
  }

  async createSignatureCertificate(documentId: string, certificateId: string) {
    try {
      // Buscar documento no banco de dados
      const documento = await this.prisma.document.findUnique({
        where: { id: documentId },
        include: { client: true, signatures: true },
      });

      if (!documento) {
        throw new NotFoundException('Documento não encontrado');
      }

      if (documento.ValidSigned) {
        throw new NotFoundException('Documento já assinado');
      }

      // Buscar informações do certificado
      const certificadoInfos = await this.prisma.certificate.findUnique({
        where: { id: certificateId },
        include: { client: true },
      });

      if (!certificadoInfos) {
        throw new NotFoundException('Certificado não encontrado');
      }

      // Simulação da chave privada vinda do banco
      const privateKey = certificadoInfos.privateKey;

      // Caminhos dos arquivos
      const pdfPath = path.join(process.cwd(), documento.storageManifest);
      const signedPdfPath = path.join(
        process.cwd(),
        documento.storageManifest.replace('.pdf', '_signed.pdf'),
      );
      const signaturePath = signedPdfPath.replace('.pdf', '.bin'); // Arquivo da assinatura
      const privateKeyPath = path.join(process.cwd(), 'private_key.pem');

      // Salva a chave privada temporariamente em um arquivo
      fs.writeFileSync(privateKeyPath, privateKey);

      // Lê o PDF original
      const pdfBuffer = fs.readFileSync(pdfPath);
      fs.writeFileSync(signedPdfPath, pdfBuffer); // Cria cópia para assinar

      try {
        // Executa o OpenSSL para assinar o documento
        execSync(
          `openssl dgst -sha256 -sign ${privateKeyPath} -out ${signaturePath} ${signedPdfPath}`,
        );

        console.log('✅ Assinatura criada com sucesso:', signaturePath);
      } catch (error) {
        console.error('❌ Erro ao assinar o PDF:', error);
        throw new Error(`Erro ao assinar o PDF: ${error.message}`);
      } finally {
        // Remove o arquivo temporário da chave privada por segurança
        fs.unlinkSync(privateKeyPath);
      }

      // exec('cat /etc/os-release', (error, stdout) => {
      //   if (error) {
      //     console.error('Erro ao executar cat /etc/os-release:', error);
      //     throw new InternalServerErrorException(
      //       `Erro ao executar cat /etc/os-release: ${error.message}`,
      //     );
      //     return;
      //   }

      //   const osRelease = stdout.toString();
      //   if (osRelease.includes('ID=ubuntu')) {
      //     exec(`sudo apt update && sudo apt install poppler-utils`, (error) => {
      //       if (error) {
      //         console.error('Erro ao instalar poppler-utils:', error);
      //         throw new InternalServerErrorException(
      //           `Erro ao instalar poppler-utils: ${error.message}`,
      //         );
      //       }
      //     });
      //   } else if (osRelease.includes('ID=manjaro')) {
      //     exec(`sudo pacman -Syu && sudo pacman -S poppler-utils`, (error) => {
      //       if (error) {
      //         console.error('Erro ao instalar poppler-utils:', error);
      //         throw new InternalServerErrorException(
      //           `Erro ao instalar poppler-utils: ${error.message}`,
      //         );
      //       }
      //     });
      //   } else {
      //     exec(`sudo apt update && sudo apt install poppler-utils`, (error) => {
      //       if (error) {
      //         console.error('Erro ao instalar poppler-utils:', error);
      //         throw new InternalServerErrorException(
      //           `Erro ao instalar poppler-utils: ${error.message}`,
      //         );
      //       }
      //     });
      //   }
      // });

      exec(
        `pdfsig -add signature=${signedPdfPath.replace('.pdf', '.bin')} ${signedPdfPath} ${signedPdfPath.replace('_signed.pdf', '_ok.pdf')}`,
        (error) => {
          if (error) {
            console.error('Erro ao assinar o PDF:', error);
            throw new InternalServerErrorException(
              `Erro ao assinar o PDF: ${error.message}`,
            );
          }
        },
      );

      // Atualize o banco de dados
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          ValidSigned: true,
          storageManifest: signedPdfPath,
        },
      });

      await this.prisma.certificate.update({
        where: { id: certificateId },
        data: {
          isDownloaded: true,
          pathCertificate: certificadoInfos.pathCertificate,
        },
      });

      return {
        documentId,
        signedPdfPath,
      };
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      throw new InternalServerErrorException(
        `Erro ao assinar documento: ${error.message}`,
      );
    }
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
