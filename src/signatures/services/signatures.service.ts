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
          signerId: client.cpf, // Mudança aqui: use o CPF, não o ID
          type: SignatureType.ADVANCED,
          documentId: document.id,
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
}
