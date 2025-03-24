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
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { MinioS3Service } from '../../minio-s3/minio-s3.service';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
    private s3: MinioS3Service,
  ) {}

  async findAll() {
    return this.prisma.document.findMany();
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        client: true,
        signatures: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado`);
    }

    return document;
  }

  async findByClientCpf(cpf: string) {
    const client = await this.clientsService.findByCpf(cpf);
    return this.prisma.document.findMany({ where: { clientId: client.id } });
  }

  async arquivar(bucket: string, file: Express.Multer.File, Dados: any) {
    try {
      const CPF = Dados.cpf;
      const client = await this.clientsService.findByCpf(CPF);
      const destination = path.join(process.cwd(), file.path);

      //ler o arquivo síncrono
      const fileBuffer = fs.readFileSync(destination);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const originalName = this.smartSanitizeIdentifier(file.originalname);
      const extension = path.extname(originalName).substring(1).toLowerCase();
      const uniqueFilename = file.filename;
      const baseUrl = process.env.API_URL || `http://localhost:3000`;
      const ViewDoc = `${baseUrl}/documents/view/${originalName}`;
      const DownloadDoc = `${baseUrl}/documents/download/${originalName}`;

      await this.prisma.document.create({
        data: {
          originalName: file.originalname,
          size: file.size,
          documentType: file.mimetype,
          extension,
          hash,
          downloadUrl: DownloadDoc,
          viewUrl: ViewDoc,
          clientId: client.id,
          atualName: uniqueFilename,
        },
      });

      await this.s3.uploadFile(
        bucket,
        file.originalname,
        fileBuffer,
        file.mimetype,
      );

      this.destroyFile(file.path);
      return { message: 'File uploaded successfully' };
    } catch (error) {
      this.destroyFile(file.path);
      throw new BadRequestException(
        `Erro ao criar documento: ${error.message}`,
      );
    }
  }

  async remove(fileName: string) {
    const document = await this.prisma.document.findFirst({
      where: { originalName: fileName },
    });
    const Bucket = process.env.MINIO_BUCKET;
    await this.s3.deleteAllFiles(Bucket, fileName);

    await this.prisma.document.delete({ where: { id: document.id } });
  }

  async addManifestToPdf(document: any) {
    try {
      // Load the original PDF asynchronously
      const Bucket = process.env.MINIO_BUCKET;
      const pdfS3 = await this.s3.downloadFile(Bucket, document.originalName);
      const pdfBytes = await this.BufferGenerate(pdfS3);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Get fonts
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Create a new page for the manifest
      const manifestPage = pdfDoc.addPage();
      const { height: manifestHeight } = manifestPage.getSize();

      const UrlConsulta = `https://arinterface.com.br/validar/${document.id}`;

      // Add manifest content
      manifestPage.drawText('MANIFESTO DE', {
        x: 220,
        y: manifestHeight - 80,
        size: 18,
        color: rgb(0, 0, 0),
        font: helveticaFont,
      });
      // Add manifest content
      manifestPage.drawText('ASSINATURAS', {
        x: 220,
        y: manifestHeight - 100,
        size: 18,
        color: rgb(0, 0, 0),
        font: helveticaFont,
      });

      const QRC = await this.gerarQRCode(UrlConsulta);

      // Incorporar a imagem ao PDF
      const QrImage = await pdfDoc.embedPng(QRC);

      // Obter dimensões da imagem
      const QrDims = QrImage.scale(0.25); // Reduzir tamanho da imagem (ajuste conforme necessário)

      // caminho da logo
      const LogoPath = path.join(process.cwd(), 'img', 'icp-brasil.png');
      //retornar o binario
      const LogoRead = fs.readFileSync(LogoPath);
      //tranformar em buffer binario
      const LogoBuffer = Buffer.from(LogoRead);

      const IcpLogo = LogoBuffer;

      // Incorporar a imagem ao PDF
      const IcpImage = await pdfDoc.embedPng(IcpLogo);

      // Obter dimensões da imagem
      const IcpDims = IcpImage.scale(0.5); // Reduzir tamanho da imagem (ajuste conforme necessário)

      manifestPage.drawImage(QrImage, {
        x: 400, // Posição ajustada para a margem direita
        y: manifestHeight - QrDims.height - 50, // Posição ajustada para o topo
        width: QrDims.width,
        height: QrDims.height,
      });

      manifestPage.drawImage(IcpImage, {
        x: 100, // Posição ajustada para a margem direita
        y: manifestHeight - IcpDims.height - 51, // Posição ajustada para o topo
        width: IcpDims.width,
        height: IcpDims.height,
      });

      manifestPage.drawText(`Código de validação: ${document.id}`, {
        x: 100,
        y: manifestHeight - 160,
        size: 14,
        font: helveticaFont,
      });

      manifestPage.drawText(
        'Documento assinado com o uso de Assinatura Avançada ICP Brasil, no Assinador Sisnato,',
        { x: 50, y: manifestHeight - 210, size: 12, font: helveticaFont },
      );

      manifestPage.drawText('pelos seguintes signatários:', {
        x: 50,
        y: manifestHeight - 225,
        size: 12,
        font: helveticaFont,
      });

      // Signatário details
      manifestPage.drawText(
        `${document.client.name} - CPF: ${document.client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? 'NÃO INFORMADO'}`,
        { x: 50, y: manifestHeight - 250, size: 14, font: helveticaFont },
      );
      // Signatário details
      manifestPage.drawText(`Assinatura Avançada ICP Brasil`, {
        x: 50,
        y: manifestHeight - 266,
        size: 14,
        font: helveticaFont,
      });

      // Validation links
      manifestPage.drawText(
        'Para verificar as assinaturas, acesse o link direto de validação deste documento:',
        { x: 50, y: manifestHeight - 285, size: 12, font: helveticaFont },
      );

      manifestPage.drawText(`${UrlConsulta}`, {
        x: 80,
        y: manifestHeight - 305,
        size: 13,
        color: rgb(0, 0, 1),
        font: helveticaFont,
      });

      manifestPage.drawText(
        'Ou acesse a consulta de documentos assinados disponível no link abaixo e informe',
        { x: 50, y: manifestHeight - 325, size: 12, font: helveticaFont },
      );

      manifestPage.drawText('o código de validação:', {
        x: 50,
        y: manifestHeight - 340,
        size: 12,
        font: helveticaFont,
      });

      manifestPage.drawText('https://arinterface.com.br/validar', {
        x: 195,
        y: manifestHeight - 375,
        size: 14,
        color: rgb(0, 0, 1),
        font: helveticaFont,
      });

      // Get all pages of the original document
      const pages = pdfDoc.getPages();

      // Carregar a imagem (PNG ou JPEG)
      const UrlImg =
        'https://arinterface.com.br/assets/img/Logo_Interface_04.png';
      const LogoBytes = await fetch(UrlImg).then((res) => res.arrayBuffer());

      // Incorporar a imagem ao PDF
      const logoImage = await pdfDoc.embedPng(LogoBytes);

      // Obter dimensões da imagem
      const logoDims = logoImage.scale(0.07); // Reduzir tamanho da imagem (ajuste conforme necessário)

      pages.forEach((page) => {
        const { width, height } = page.getSize();

        // Adicionar texto rotacionado
        page.drawText(
          `Documento assinado no assinador Sisnato. Para Validar o documento e suas assinaturas acesse ${UrlConsulta}`,
          {
            x: width - 12,
            y: height - 735,
            size: 8,
            color: rgb(0.7, 0, 0),
            font: helveticaFont,
            rotate: degrees(90),
          },
        );

        // Adicionar o logo no topo da página
        page.drawImage(logoImage, {
          x: width - 5, // Posição ajustada para a margem direita
          y: height - logoDims.height - 790, // Posição ajustada para o topo
          width: logoDims.width,
          height: logoDims.height,
          rotate: degrees(90),
        });
      });

      // Write the modified PDF
      const pdfBytesModified = await pdfDoc.save();
      await this.s3.uploadFile(
        process.env.MINIO_BUCKET,
        document.atualName,
        Buffer.from(pdfBytesModified),
        'application/pdf',
      );
      return { message: 'Manifesto adicionado ao PDF com sucesso!' };
    } catch (error) {
      throw new BadRequestException(
        `Erro ao adicionar manifesto ao PDF: ${error.message}`,
      );
    }
  }

  async verifyDocument(id: string) {
    const document = await this.findOne(id);
    const filePath = await this.s3.downloadFile(
      process.env.MINIO_BUCKET,
      document.originalName,
    );

    const fileBuffer = await this.BufferGenerate(filePath);
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

  async IsSing(fileName: string): Promise<boolean> {
    const req = await this.prisma.document.findFirst({
      where: { originalName: { contains: fileName } },
    });
    if (!req) {
      return false;
    }
    return req.isSigned;
  }

  async DownloadFile(docId: string) {
    try {
      const req = await this.prisma.document.findUnique({
        where: { id: docId },
      });
      const Bucket = process.env.MINIO_BUCKET;
      const { originalName } = req;
      const file = await this.s3.downloadFile(Bucket, originalName);
      return file;
    } catch (error) {
      throw new BadRequestException(
        'Error ao exibir o documento: ' + error.message,
      );
    }
  }

  async ViewFile(id: string) {
    try {
      const req = await this.prisma.document.findUnique({
        where: { id },
      });
      const Bucket = process.env.MINIO_BUCKET;
      const { originalName } = req;
      const file = await this.s3.getFileUrl(Bucket, originalName);

      return file;
    } catch (error) {
      throw new BadRequestException(
        'Error ao exibir o documento: ' + error.message,
      );
    }
  }

  // async update(id: string, file: Express.Multer.File) {
  //   const document = await this.findOne(id);
  //   const filePath = path.join(process.cwd(), document.storagePath);
  //   fs.unlinkSync(filePath);
  //   const newFilePath = path.join(process.cwd(), file.path);
  //   fs.renameSync(newFilePath, filePath);
  //   return this.prisma.document.update({
  //     where: { id },
  //     data: { originalName: file.originalname },
  //   });
  // }

  //--------------------lib-------------------------

  destroyFile(filePath: string) {
    const destination = path.join(process.cwd(), filePath);
    if (fs.existsSync(destination)) {
      fs.unlinkSync(destination);
    }
  }

  async BufferGenerate(stream: any): Promise<Buffer> {
    const chunks = [];

    for await (const chunk of stream) {
      // Certifique-se de que o chunk é do tipo correto
      if (chunk instanceof Buffer) {
        chunks.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(Buffer.from(chunk));
      }
    }

    // Concatena todos os chunks em um único buffer
    return Buffer.concat(chunks);
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

  async gerarQRCode(
    texto: string,
    // opcoes: QRCode.QRCodeToBufferOptions = 'qrCode.png',
  ): Promise<Buffer> {
    try {
      // Configurações padrão com opções customizáveis
      const configPadrao: QRCode.QRCodeToBufferOptions = {
        type: 'png',
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 300,
        margin: 4,
      };

      // Gera o QR Code como um buffer
      const qrCodeBuffer = await QRCode.toBuffer(texto, configPadrao);

      if (!qrCodeBuffer) {
        throw new Error('Falha ao gerar buffer do QR Code');
      }

      return qrCodeBuffer;
    } catch (err) {
      console.error('Erro ao gerar QR Code Buffer:', err);
      throw new Error(`Falha ao gerar QR Code: ${err.message}`);
    }
  }
}
