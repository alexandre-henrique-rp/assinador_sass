import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ClientsService } from '../../clients/services/clients.service';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
  ) {}

  async findAll() {
    return this.prisma.document.findMany();
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado`);
    }

    return document;
  }

  async findByClientCpf(cpf: string) {
    const client = await this.clientsService.findByCpf(cpf);
    return this.prisma.document.findMany({ where: { clientId: client.id } });
  }

  async create(file: Express.Multer.File, cpf: string) {
    try {
      const client = await this.clientsService.findByCpf(cpf);

      const fileBuffer = fs.readFileSync(file.path);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const originalName = file.originalname.replace(/\s+/g, '_');
      const extension = path.extname(originalName).substring(1).toLowerCase();
      const uniqueFilename = `${Date.now()}-${originalName}`;
      const storagePath = path.join('uploads', 'documents', uniqueFilename);
      const absolutePath = path.join(process.cwd(), storagePath);

      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.copyFileSync(file.path, absolutePath);
      fs.unlinkSync(file.path);

      const baseUrl = `http://localhost:3000/uploads/documents/${uniqueFilename}`;

      return this.prisma.document.create({
        data: {
          originalName,
          size: file.size,
          documentType: file.mimetype,
          extension,
          hash,
          storagePath,
          downloadUrl: baseUrl,
          viewUrl: baseUrl,
          clientId: client.id,
        },
      });
    } catch (error) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(
        `Erro ao criar documento: ${error.message}`,
      );
    }
  }

  async remove(id: string) {
    const document = await this.findOne(id);

    const filePath = path.join(process.cwd(), document.storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.document.delete({ where: { id } });
  }

  async getDocumentWithManifest(id: string) {
    const document = await this.findOne(id);
    const originalPath = path.join(process.cwd(), document.storagePath);

    if (!fs.existsSync(originalPath)) {
      throw new NotFoundException(
        `Arquivo físico não encontrado para o documento ${id}`,
      );
    }

    if (document.extension.toLowerCase() === 'pdf') {
      return this.addManifestToPdf(document, originalPath);
    } else {
      throw new BadRequestException(
        'Conversão para PDF de documentos não-PDF não implementada',
      );
    }
  }

  async addManifestToPdf(document, originalPath) {
    try {
      const pdfBytes = fs.readFileSync(originalPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const page = pdfDoc.addPage();
      const { height } = page.getSize();

      page.drawText('MANIFESTO DE VERIFICAÇÃO DE DOCUMENTO', {
        x: 50,
        y: height - 50,
        size: 16,
      });
      page.drawText(`ID do Documento: ${document.id}`, {
        x: 50,
        y: height - 80,
        size: 12,
      });
      page.drawText(`Nome Original: ${document.originalName}`, {
        x: 50,
        y: height - 100,
        size: 12,
      });
      page.drawText(`Hash SHA-256: ${document.hash}`, {
        x: 50,
        y: height - 120,
        size: 12,
      });
      page.drawText(`Data de Upload: ${document.createdAt.toLocaleString()}`, {
        x: 50,
        y: height - 140,
        size: 12,
      });

      const manifestFilename = `manifesto_${document.originalName}`;
      const manifestPath = path.join(
        process.cwd(),
        'uploads',
        'manifests',
        manifestFilename,
      );

      const dir = path.dirname(manifestPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(manifestPath, await pdfDoc.save());

      return { filePath: manifestPath, filename: manifestFilename };
    } catch (error) {
      throw new BadRequestException(
        `Erro ao adicionar manifesto ao PDF: ${error.message}`,
      );
    }
  }

  async verifyDocument(id: string) {
    const document = await this.findOne(id);
    const filePath = path.join(process.cwd(), document.storagePath);

    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        details: { message: 'Arquivo físico não encontrado' },
      };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const currentHash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    return {
      isValid: currentHash === document.hash,
      details: {
        originalHash: document.hash,
        currentHash,
        document: {
          id: document.id,
          originalName: document.originalName,
          uploadDate: document.createdAt,
        },
      },
    };
  }
}
