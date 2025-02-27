import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as forge from 'node-forge';
import { Certificate } from '../entities/certificate.entity';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { ClientsService } from '../../clients/services/clients.service';
import { randomBytes } from 'crypto';
import { Not } from 'typeorm';

@Injectable()
export class CertificatesService {
  private caCertificate: Certificate;

  constructor(
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
    private clientsService: ClientsService,
  ) {}

  async findAll(): Promise<Certificate[]> {
    return this.certificateRepository.find({
      order: { issuedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOne({
      where: { id },
    });

    if (!certificate) {
      throw new NotFoundException(`Certificado com ID ${id} não encontrado`);
    }

    return certificate;
  }

  async findByClientId(clientId: string): Promise<Certificate[]> {
    return this.certificateRepository.find({
      where: { clientId },
      order: { issuedAt: 'DESC' },
    });
  }

  async findValidByClientId(clientId: string): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOne({
      where: { clientId, isValid: true },
      order: { issuedAt: 'DESC' },
    });

    if (!certificate) {
      throw new NotFoundException(
        `Certificado válido para o cliente ${clientId} não encontrado`,
      );
    }

    return certificate;
  }

  async findByClientCpf(cpf: string): Promise<Certificate[]> {
    // Busca o cliente pelo CPF
    const client = await this.clientsService.findByCpf(cpf);

    // Busca todos os certificados do cliente
    return this.certificateRepository.find({
      where: { clientId: client.id },
      order: { issuedAt: 'DESC' },
    });
  }

  async createCACertificate(): Promise<Certificate> {
    // Verifica se já existe um certificado CA no banco
    const existingCA = await this.certificateRepository.findOne({
      where: { isCA: true },
    });

    if (existingCA) {
      return existingCA;
    }

    // Gera um par de chaves RSA para a AC
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);

    // Cria um certificado X.509 para a AC
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = this.generateSerialNumber();

    // Define os atributos do certificado
    const now = new Date();
    const validityYears = 10;
    cert.validity.notBefore = now;
    cert.validity.notAfter = new Date(
      now.getFullYear() + validityYears,
      now.getMonth(),
      now.getDate(),
    );

    const attrs = [
      { name: 'commonName', value: 'Autoridade Certificadora Raiz' },
      { name: 'countryName', value: 'BR' },
      { name: 'organizationName', value: 'Sistema de Certificação Digital' },
      { name: 'organizationalUnitName', value: 'Autoridade Certificadora' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Auto-assinado

    // Extensões do certificado
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        cRLSign: true,
        digitalSignature: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
    ]);

    // Assina o certificado com a chave privada da AC
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Converte o certificado para PEM
    const certificatePem = forge.pki.certificateToPem(cert);

    // Salva o certificado da AC no banco de dados
    const caCertificateEntity = this.certificateRepository.create({
      subject: 'Autoridade Certificadora Raiz',
      serialNumber: cert.serialNumber,
      publicKey: publicKeyPem,
      privateKey: privateKeyPem,
      issuedAt: now,
      validUntil: cert.validity.notAfter,
      isValid: true,
      issuer: 'Autoridade Certificadora Raiz',
      certificatePem: certificatePem,
      isCA: true,
    });

    this.caCertificate =
      await this.certificateRepository.save(caCertificateEntity);
    return this.caCertificate;
  }

  async createClientCertificate(
    createCertificateDto: CreateCertificateDto,
  ): Promise<Certificate> {
    // Verifica se o CA já existe, senão cria
    if (!this.caCertificate) {
      this.caCertificate = await this.createCACertificate();
    }

    try {
      // Busca o cliente pelo CPF
      const client = await this.clientsService.findByCpf(
        createCertificateDto.cpf,
      );

      // Invalida certificados anteriores do cliente
      await this.invalidateClientCertificates(client.id);

      // Gera um par de chaves RSA para o cliente
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
      const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey);

      // Cria um certificado X.509 para o cliente
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = this.generateSerialNumber();

      // Define os atributos do certificado
      const now = new Date();
      const validityDays = createCertificateDto.validityDays
        ? parseInt(createCertificateDto.validityDays)
        : 365;

      cert.validity.notBefore = now;
      cert.validity.notAfter = new Date(
        now.getTime() + validityDays * 24 * 60 * 60 * 1000,
      );

      const attrs = [
        { name: 'commonName', value: createCertificateDto.name },
        { name: 'countryName', value: 'BR' },
        { shortName: 'ST', value: 'Estado' },
        { name: 'localityName', value: 'Cidade' },
        { name: 'organizationName', value: 'Sistema de Certificação Digital' },
        { name: 'organizationalUnitName', value: 'Certificados de Usuário' },
      ];

      cert.setSubject(attrs);

      // Lê o certificado da AC
      const caCert = forge.pki.certificateFromPem(
        this.caCertificate.certificatePem,
      );
      const caPrivateKey = forge.pki.privateKeyFromPem(
        this.caCertificate.privateKey,
      );

      // Define o emissor como a AC
      cert.setIssuer(caCert.subject.attributes);

      // Adiciona extensões específicas para Adobe Reader
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false,
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
        },
        {
          name: 'extKeyUsage',
          clientAuth: true,
          emailProtection: true,
          codeSigning: true,
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 1, value: client.email },
            { type: 2, value: 'example.com' },
          ],
        },
        {
          name: 'subjectKeyIdentifier',
        },
        {
          name: 'authorityKeyIdentifier',
          authorityCertIssuer: true,
          serialNumber: caCert.serialNumber,
        },
        // Campo personalizado para CPF e data de nascimento
        {
          name: 'nsComment',
          value: `CPF: ${createCertificateDto.cpf}, Nascimento: ${createCertificateDto.birthDate}`,
        },
      ]);

      // Assina o certificado com a chave privada da AC
      cert.sign(caPrivateKey, forge.md.sha256.create());

      // Converte o certificado para PEM
      const certificatePem = forge.pki.certificateToPem(cert);

      // Salva o certificado no banco de dados
      const certificateEntity = this.certificateRepository.create({
        subject: createCertificateDto.name,
        serialNumber: cert.serialNumber,
        publicKey: publicKeyPem,
        privateKey: privateKeyPem,
        issuedAt: now,
        validUntil: cert.validity.notAfter,
        isValid: true,
        issuer: this.caCertificate.subject,
        certificatePem: certificatePem,
        client: client,
        clientId: client.id,
        isCA: false,
      });

      const savedCertificate =
        await this.certificateRepository.save(certificateEntity);

      // Atualiza o status do certificado no cliente
      await this.clientsService.updateCertificateStatus(client.id, true, true);

      return savedCertificate;
    } catch (error) {
      throw new BadRequestException(
        `Erro ao criar certificado: ${error.message}`,
      );
    }
  }

  async invalidateCertificate(id: string): Promise<Certificate> {
    const certificate = await this.findOne(id);
    certificate.isValid = false;

    // Se o certificado pertence a um cliente, atualiza o status
    if (certificate.clientId) {
      const hasOtherValidCertificates = await this.hasOtherValidCertificates(
        certificate.clientId,
        id,
      );
      if (!hasOtherValidCertificates) {
        await this.clientsService.updateCertificateStatus(
          certificate.clientId,
          true,
          false,
        );
      }
    }

    return this.certificateRepository.save(certificate);
  }

  async invalidateClientCertificates(clientId: string): Promise<void> {
    const certificates = await this.certificateRepository.find({
      where: { clientId, isValid: true },
    });

    for (const cert of certificates) {
      cert.isValid = false;
      await this.certificateRepository.save(cert);
    }

    // Atualiza o status do cliente
    if (certificates.length > 0) {
      await this.clientsService.updateCertificateStatus(clientId, true, false);
    }
  }

  async hasOtherValidCertificates(
    clientId: string,
    excludeCertificateId: string,
  ): Promise<boolean> {
    const count = await this.certificateRepository.count({
      where: {
        clientId,
        id: Not(excludeCertificateId),
        isValid: true,
      },
    });

    return count > 0;
  }

  async verifyCertificate(
    id: string,
  ): Promise<{ isValid: boolean; details: any }> {
    const certificate = await this.findOne(id);

    // Verifica se o certificado está válido no banco
    if (!certificate.isValid) {
      return {
        isValid: false,
        details: {
          message: 'Certificado foi revogado',
          issuedAt: certificate.issuedAt,
          validUntil: certificate.validUntil,
        },
      };
    }

    // Verifica se o certificado está dentro do prazo de validade
    const now = new Date();
    if (now > certificate.validUntil) {
      // Atualiza o status do certificado no banco para inválido
      certificate.isValid = false;
      await this.certificateRepository.save(certificate);

      // Atualiza o status do cliente se necessário
      if (certificate.clientId) {
        const hasOtherValidCertificates = await this.hasOtherValidCertificates(
          certificate.clientId,
          certificate.id,
        );
        if (!hasOtherValidCertificates) {
          await this.clientsService.updateCertificateStatus(
            certificate.clientId,
            true,
            false,
          );
        }
      }

      return {
        isValid: false,
        details: {
          message: 'Certificado expirado',
          issuedAt: certificate.issuedAt,
          validUntil: certificate.validUntil,
        },
      };
    }

    // Verifica se o certificado foi emitido pela AC
    try {
      const certObj = forge.pki.certificateFromPem(certificate.certificatePem);
      const caCert = forge.pki.certificateFromPem(
        this.caCertificate.certificatePem,
      );
      const caPublicKey = caCert.publicKey;

      // Verifica a assinatura
      const isSignatureValid = certObj.verify(caPublicKey);

      if (!isSignatureValid) {
        return {
          isValid: false,
          details: {
            message: 'Assinatura do certificado inválida',
            issuedAt: certificate.issuedAt,
            validUntil: certificate.validUntil,
          },
        };
      }

      return {
        isValid: true,
        details: {
          message: 'Certificado válido',
          subject: certificate.subject,
          issuer: certificate.issuer,
          issuedAt: certificate.issuedAt,
          validUntil: certificate.validUntil,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        details: {
          message: `Erro ao verificar certificado: ${error.message}`,
          issuedAt: certificate.issuedAt,
          validUntil: certificate.validUntil,
        },
      };
    }
  }

  private generateSerialNumber(): string {
    return randomBytes(16).toString('hex');
  }
}
