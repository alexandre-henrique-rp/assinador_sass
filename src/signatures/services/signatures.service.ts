import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as forge from 'node-forge';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Signature, SignatureType } from '../entities/signature.entity';
import { CreateSignatureDto } from '../dto/create-signature.dto';
import { ClientsService } from '../../clients/services/clients.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { CertificatesService } from '../../certificates/services/certificates.service';

@Injectable()
export class SignaturesService {
  signDocumentAdvanced(documentId: string, signerId: string) {
    throw new Error('Method not implemented.');
  }
  signDocumentQualified(documentId: string, signerId: string, certificateId: string) {
    throw new Error('Method not implemented.');
  }
  // Busca o documento
  getDocumentSignatures(documentId: string) {
    throw new Error('Method not implemented.');
  }
  constructor(
    @InjectRepository(Signature)
    private signatureRepository: Repository<Signature>,
    private clientsService: ClientsService,
    private documentsService: DocumentsService,
    private certificatesService: CertificatesService,
  ) {}

  async findAll(): Promise<Signature[]> {
    return this.signatureRepository.find();
  }

  async findOne(id: string): Promise<Signature> {
    const signature = await this.signatureRepository.findOne({ where: { id } });
    
    if (!signature) {
      throw new NotFoundException(`Assinatura com ID ${id} não encontrada`);
    }
    
    return signature;
  }

  async findByDocumentId(documentId: string): Promise<Signature[]> {
    return this.signatureRepository.find({
      where: { documentId },
      relations: ['signer'],
    });
  }

  async createAdvancedSignature(createSignatureDto: CreateSignatureDto): Promise<Signature> {
    // Verifica se o tipo da assinatura é avançada
    if (createSignatureDto.type !== SignatureType.ADVANCED) {
      throw new BadRequestException('Tipo de assinatura inválido para assinatura avançada');
    }
    
    try {
      // Busca o cliente pelo CPF
      const client = await this.clientsService.findByCpf(createSignatureDto.signerCpf);
      
      // Busca o documento
      const document = await this.documentsService.findOne(createSignatureDto.documentId);
      
      // Cria a assinatura avançada
      const signature = this.signatureRepository.create({
        signer: client,
        signerId: client.id,
        signerCpf: client.cpf,
        type: SignatureType.ADVANCED,
        documentId: document.id,
      });
      
      // Gera um hash simples do documento + timestamp como "assinatura"
      const filePath = path.join(process.cwd(), document.storagePath);
      const fileBuffer = fs.readFileSync(filePath);
      const timestamp = new Date().toISOString();
      const signatureData = crypto.createHash('sha256')
        .update(Buffer.concat([fileBuffer, Buffer.from(timestamp)]))
        .digest('hex');
      
      signature.signatureData = signatureData;
      
      // Atualiza o status de assinatura do documento
      document.isSigned = true;
      await this.documentsService['documentsRepository'].save(document);
      
      return this.signatureRepository.save(signature);
    } catch (error) {
      throw new BadRequestException(`Erro ao criar assinatura avançada: ${error.message}`);
    }
  }

  async createQualifiedSignature(createSignatureDto: CreateSignatureDto): Promise<Signature> {
    // Verifica se o tipo da assinatura é ICP-Brasil
    if (createSignatureDto.type !== SignatureType.ICP_BRASIL) {
      throw new BadRequestException('Tipo de assinatura inválido para assinatura qualificada');
    }
    
    // Verifica se foi fornecido um certificado
    if (!createSignatureDto.certificateId) {
      throw new BadRequestException('Certificado obrigatório para assinatura qualificada');
    }
    
    try {
      // Busca o cliente pelo CPF
      const client = await this.clientsService.findByCpf(createSignatureDto.signerCpf);
      
      // Busca o documento
      const document = await this.documentsService.findOne(createSignatureDto.documentId);
      
      // Busca o certificado e verifica se é válido
      const certificate = await this.certificatesService.findOne(createSignatureDto.certificateId);
      const certificateVerification = await this.certificatesService.verifyCertificate(certificate.id);
      
      if (!certificateVerification.isValid) {
        throw new BadRequestException(`Certificado inválido: ${certificateVerification.details.message}`);
      }
      
      // Verifica se o certificado pertence ao cliente
      if (certificate.clientId !== client.id) {
        throw new BadRequestException('O certificado não pertence ao usuário especificado');
      }
      
      // Cria a assinatura qualificada
      const signature = this.signatureRepository.create({
        signer: client,
        signerId: client.id,
        signerCpf: client.cpf,
        type: SignatureType.ICP_BRASIL,
        documentId: document.id,
        certificateId: certificate.id,
      });
      
      // Lê o arquivo do documento
      const filePath = path.join(process.cwd(), document.storagePath);
      const fileBuffer = fs.readFileSync(filePath);
      
      // Calcula o hash SHA-256 do documento
      const documentHash = crypto.createHash('sha256').update(fileBuffer).digest();
      
      // Carrega a chave privada do certificado
      const privateKey = forge.pki.privateKeyFromPem(certificate.privateKey);
      
      // Cria o objeto MD para o hash
      const md = forge.md.sha256.create();
      md.update(documentHash.toString('binary'));
      
      // Assina o hash com a chave privada
      const signature64 = privateKey.sign(md);
      const signatureHex = forge.util.bytesToHex(signature64);
      
      signature.signatureData = signatureHex;
      
      // Atualiza o status de assinatura do documento
      document.isSigned = true;
      await this.documentsService['documentsRepository'].save(document);
      
      return this.signatureRepository.save(signature);
    } catch (error) {
      throw new BadRequestException(`Erro ao criar assinatura qualificada: ${error.message}`);
    }
  }

  async verifySignature(id: string): Promise<{ isValid: boolean; details: any }> {
    const signature = await this.findOne(id);
    
    // Se for assinatura avançada, apenas verificamos a existência
    if (signature.type === SignatureType.ADVANCED) {
      return {
        isValid: !!signature.signatureData,
        details: {
          type: SignatureType.ADVANCED,
          signerCpf: signature.signerCpf,
          signedAt: signature.signedAt,
        },
      };
    }
    
    // Se for assinatura qualificada (ICP-Brasil), verificamos a assinatura criptográfica
    try {
      // Busca o documento
      const document = await this.documentsService.findOne(signature.documentId);
      
      // Busca o certificado
      const certificate = await this.certificatesService.findOne(signature.certificateId);
      
      // Verifica se o certificado é válido
      const certificateVerification = await this.certificatesService.verifyCertificate(certificate.id);
      if (!certificateVerification.isValid) {
        return {
          isValid: false,
          details: {
            message: `Certificado inválido: ${certificateVerification.details.message}`,
            type: signature.type,
            signerCpf: signature.signerCpf,
            signedAt: signature.signedAt,
          },
        };
      }
      
      // Lê o arquivo do documento
      const filePath = path.join(process.cwd(), document.storagePath);
      const fileBuffer = fs.readFileSync(filePath);
      
      // Calcula o hash SHA-256 do documento
      const documentHash = crypto.createHash('sha256').update(fileBuffer).digest();
      
      // Carrega a chave pública do certificado
      const publicKey = forge.pki.publicKeyFromPem(certificate.publicKey);
      
      // Cria o objeto MD para o hash
      const md = forge.md.sha256.create();
      md.update(documentHash.toString('binary'));
      
      // Converte a assinatura hexadecimal para binário
      const signatureBinary = forge.util.hexToBytes(signature.signatureData);
      
      // Verifica a assinatura com a chave pública
      const isValid = publicKey.verify(md.digest().bytes(), signatureBinary);
      
      return {
        isValid,
        details: {
          type: signature.type,
          signerCpf: signature.signerCpf,
          signedAt: signature.signedAt,
          certificateId: signature.certificateId,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        details: {
          message: `Erro ao verificar assinatura: ${error.message}`,
          type: signature.type,
          signerCpf: signature.signerCpf,
          signedAt: signature.signedAt,
        },
      };
    }
  }
}
