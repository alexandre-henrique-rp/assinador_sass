import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Document } from '../entities/document.entity';
import { ClientsService } from '../../clients/services/clients.service';
import { DocumentFilterDto } from '../dto/document-filter.dto';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private documentsRepository: Repository<Document>,
    private clientsService: ClientsService,
  ) {}

  async findAll(): Promise<Document[]> {
    return this.documentsRepository.find();
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.documentsRepository.findOne({ where: { id } });
    
    if (!document) {
      throw new NotFoundException(`Documento com ID ${id} não encontrado`);
    }
    
    return document;
  }

  async findByClientCpf(cpf: string): Promise<Document[]> {
    const client = await this.clientsService.findByCpf(cpf);
    return this.documentsRepository.find({ where: { clientId: client.id } });
  }

  async create(file: Express.Multer.File, cpf: string): Promise<Document> {
    try {
      // Busca o cliente pelo CPF
      const client = await this.clientsService.findByCpf(cpf);
      
      // Gera o hash do arquivo para verificação de integridade
      const fileBuffer = fs.readFileSync(file.path);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Substitui espaços no nome do arquivo por _
      const originalName = file.originalname.replace(/\s+/g, '_');
      
      // Determina a extensão do arquivo
      const extension = path.extname(originalName).substring(1).toLowerCase();
      
      // Salva o arquivo com um nome único
      const uniqueFilename = `${Date.now()}-${originalName}`;
      const storagePath = path.join('uploads', 'documents', uniqueFilename);
      const absolutePath = path.join(process.cwd(), storagePath);
      
      // Cria diretório se não existir
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Move o arquivo para o diretório de armazenamento permanente
      fs.copyFileSync(file.path, absolutePath);
      fs.unlinkSync(file.path); // Remove o arquivo temporário
      
      // Gera URLs para download e visualização
      const baseUrl = `http://localhost:3000/uploads/documents/${uniqueFilename}`;
      const downloadUrl = baseUrl;
      const viewUrl = baseUrl;
      
      // Cria o registro do documento no banco de dados
      const document = this.documentsRepository.create({
        originalName,
        size: file.size,
        documentType: file.mimetype,
        extension,
        hash,
        storagePath,
        downloadUrl,
        viewUrl,
        client,
        clientId: client.id,
      });
      
      return this.documentsRepository.save(document);
    } catch (error) {
      // Se ocorrer erro, garante que o arquivo temporário seja excluído
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(`Erro ao criar documento: ${error.message}`);
    }
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    
    // Remove o arquivo físico
    const filePath = path.join(process.cwd(), document.storagePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove o registro do banco de dados
    await this.documentsRepository.remove(document);
  }

  async getDocumentWithManifest(id: string): Promise<{ filePath: string; filename: string }> {
    const document = await this.findOne(id);
    const originalPath = path.join(process.cwd(), document.storagePath);
    
    // Verifica se o arquivo existe
    if (!fs.existsSync(originalPath)) {
      throw new NotFoundException(`Arquivo físico não encontrado para o documento ${id}`);
    }
    
    if (document.extension.toLowerCase() === 'pdf') {
      // Se for PDF, adiciona o manifesto ao PDF existente
      return this.addManifestToPdf(document, originalPath);
    } else {
      // Para outros formatos, primeiro precisaria converter para PDF
      // Aqui seria necessário implementar a conversão para PDF, que depende de uma biblioteca externa
      // Como libreoffice-convert ou pdf-puppeteer
      throw new BadRequestException('Conversão para PDF de documentos não-PDF não implementada');
    }
  }

  async addManifestToPdf(document: Document, originalPath: string): Promise<{ filePath: string; filename: string }> {
    try {
      // Carrega o PDF existente
      const pdfBytes = fs.readFileSync(originalPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Adiciona uma nova página para o manifesto
      const page = pdfDoc.addPage();
      
      // Adiciona texto do manifesto à página
      const { width, height } = page.getSize();
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
      
      // Informações sobre assinaturas
      if (document.signatures && document.signatures.length > 0) {
        page.drawText('ASSINATURAS:', {
          x: 50,
          y: height - 170,
          size: 14,
        });
        
        let yPos = height - 190;
        document.signatures.forEach((signature, index) => {
          page.drawText(`Assinatura ${index + 1}: ${signature.signerCpf} - ${signature.signedAt.toLocaleString()} - Tipo: ${signature.type}`, {
            x: 50,
            y: yPos,
            size: 12,
          });
          yPos -= 20;
        });
      } else {
        page.drawText('DOCUMENTO NÃO ASSINADO', {
          x: 50,
          y: height - 170,
          size: 14,
        });
      }
      
      // QR Code ou outra informação para verificação
      page.drawText('Para verificar a autenticidade deste documento, acesse:', {
        x: 50,
        y: height - 220,
        size: 12,
      });
      
      page.drawText(`http://localhost:3000/api/documents/verify/${document.id}`, {
        x: 50,
        y: height - 240,
        size: 12,
      });
      
      // Salva o PDF com manifesto
      const pdfBytesWithManifest = await pdfDoc.save();
      
      // Cria um nome para o arquivo com manifesto
      const manifestFilename = `manifesto_${document.originalName}`;
      const manifestPath = path.join(process.cwd(), 'uploads', 'manifests', manifestFilename);
      
      // Cria diretório se não existir
      const dir = path.dirname(manifestPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Salva o arquivo
      fs.writeFileSync(manifestPath, pdfBytesWithManifest);
      
      return {
        filePath: manifestPath,
        filename: manifestFilename,
      };
    } catch (error) {
      throw new BadRequestException(`Erro ao adicionar manifesto ao PDF: ${error.message}`);
    }
  }

  async verifyDocument(id: string): Promise<{ isValid: boolean; details: any }> {
    const document = await this.findOne(id);
    const filePath = path.join(process.cwd(), document.storagePath);
    
    // Verifica se o arquivo existe
    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        details: {
          message: 'Arquivo físico não encontrado',
        },
      };
    }
    
    // Calcula o hash do arquivo atual para comparar com o hash armazenado
    const fileBuffer = fs.readFileSync(filePath);
    const currentHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    // Compara com o hash armazenado no momento do upload
    const isHashValid = currentHash === document.hash;
    
    return {
      isValid: isHashValid,
      details: {
        originalHash: document.hash,
        currentHash,
        document: {
          id: document.id,
          originalName: document.originalName,
          uploadDate: document.createdAt,
          isSigned: document.isSigned,
        },
      },
    };
  }
}
