import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { promises as fs } from 'fs';
import * as forge from 'node-forge';
import * as path from 'path';
import { ClientsService } from 'src/clients/services/clients.service';
import { ErrorEntity } from '../../error.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { CertificateEntity } from '../entities/certificate.entity';

@Injectable()
export class CertificatesService {
  caCertificate: any;
  // private caCertificate: CertificateEntity;

  constructor(
    private prisma: PrismaService,
    private clientsService: ClientsService,
  ) {}

  AcName = 'AC Interface v5';
  AcNameDoc = 'AC Interface-v5';
  AcRazao = 'AC Interface Certificadora v5';
  AcRegule = 'ICP-Brasil';
  AcCountry = 'BR';
  AcState = 'SP';
  AcCity = 'RIBEIRAO PRETO';
  AcType = 'CD-AVANCADO';
  AcTypeCd = 'Certificado PF A1';

  async findAll(): Promise<CertificateEntity[] | ErrorEntity> {
    try {
      const certificates = await this.prisma.certificate.findMany({
        orderBy: { issuedAt: 'desc' },
      });

      return certificates.map((c) => plainToClass(CertificateEntity, c));
    } catch (error) {
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async findOne(id: string) {
    try {
      const certificate = await this.prisma.certificate.findUnique({
        where: { id },
      });

      if (!certificate) {
        throw new NotFoundException(`Certificado com ID ${id} não encontrado`);
      }

      return plainToClass(CertificateEntity, certificate);
    } catch (error) {
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async findByClientId(
    clientId: string,
  ): Promise<CertificateEntity[] | ErrorEntity> {
    try {
      const certificates = await this.prisma.certificate.findMany({
        where: { clientId },
        orderBy: { issuedAt: 'desc' },
      });
      return certificates.map((c) => plainToClass(CertificateEntity, c));
    } catch (error) {
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async findValidByClientId(
    clientId: string,
  ): Promise<CertificateEntity | ErrorEntity> {
    try {
      const certificate = await this.prisma.certificate.findFirst({
        where: { clientId, isValid: true },
        orderBy: { issuedAt: 'desc' },
      });

      if (!certificate) {
        throw new NotFoundException(
          `Certificado válido para o cliente ${clientId} não encontrado`,
        );
      }

      return plainToClass(CertificateEntity, certificate);
    } catch (error) {
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async findByClientCpf(cpf: string): Promise<CertificateEntity | ErrorEntity> {
    try {
      // Busca o cliente pelo CPF
      const client = await this.prisma.client.findUnique({
        where: { cpf },
      });

      // Busca todos os certificados do cliente
      const certificates = await this.prisma.certificate.findFirst({
        where: { clientId: client.id },
        orderBy: { issuedAt: 'desc' },
      });

      return plainToClass(CertificateEntity, certificates);
    } catch (error) {
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async createCACertificate(): Promise<CertificateEntity> {
    try {
      // Verifica se já existe um certificado CA no banco
      const existingCA = await this.prisma.certificate.findFirst({
        where: { isCA: true },
      });

      if (existingCA) {
        return plainToClass(CertificateEntity, existingCA);
      }

      // Gera um par de chaves RSA para a AC
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey, 'RSA');
      const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey, 'RSA');

      // Cria um certificado X.509 para a AC
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;

      // Gera o número serial no formato solicitado: 521C + timestamp
      const serialNumber = `521C${Date.now().toString(16)}`;
      cert.serialNumber = serialNumber;

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
        { name: 'commonName', value: this.AcRazao },
        { name: 'countryName', value: this.AcCountry },
        { name: 'organizationName', value: this.AcRegule },
        { name: 'organizationalUnitName', value: this.AcName },
      ];
      console.log(
        '🚀 ~ CertificatesService ~ createCACertificate ~ attrs:',
        attrs,
      );

      cert.setSubject(attrs);
      cert.setIssuer(attrs); // Auto-assinado

      // Use um tipo mais genérico para as extensões
      // Aqui estamos usando 'as any' para contornar as verificações de tipo do TypeScript
      const extensions: any[] = [
        {
          name: 'basicConstraints',
          critical: true,
          cA: true,
          pathLenConstraint: null, // Restrições de Comprimento de Caminho = Nenhum(a)
        },
        {
          name: 'keyUsage',
          critical: true,
          keyCertSign: true, // Assinatura de Certificado
          cRLSign: true, // Assinatura da lista de certificados revogados
          digitalSignature: true, // Assinatura offline
        },
        {
          name: 'subjectKeyIdentifier',
        },
      ];

      // Simplifique a adição da política usando a API nativa do forge
      // e use 'as any' para ignorar as restrições de tipo
      extensions.push({
        id: '2.5.29.32', // OID para certificatePolicies
        name: 'certificatePolicies',
        critical: false,
        value: forge.asn1
          .toDer(
            forge.asn1.create(
              forge.asn1.Class.UNIVERSAL,
              forge.asn1.Type.SEQUENCE,
              true,
              [
                forge.asn1.create(
                  forge.asn1.Class.UNIVERSAL,
                  forge.asn1.Type.SEQUENCE,
                  true,
                  [
                    forge.asn1.create(
                      forge.asn1.Class.UNIVERSAL,
                      forge.asn1.Type.OID,
                      false,
                      forge.asn1.oidToDer('2.16.76.1.2.1.38').getBytes(),
                    ),
                    forge.asn1.create(
                      forge.asn1.Class.UNIVERSAL,
                      forge.asn1.Type.SEQUENCE,
                      true,
                      [
                        forge.asn1.create(
                          forge.asn1.Class.UNIVERSAL,
                          forge.asn1.Type.IA5STRING,
                          false,
                          forge.util.encodeUtf8(
                            'https://arinterface.com.br/doc/dpn-ar.pdf',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          )
          .getBytes(),
      } as any);

      // Aplique as extensões ao certificado
      cert.setExtensions(extensions);

      // Assina o certificado com a chave privada da AC
      cert.sign(keys.privateKey, forge.md.sha256.create());

      // Converte o certificado para PEM
      const certificatePem = forge.pki.certificateToPem(cert);

      // Salva o certificado da AC no banco de dados
      const caCertificateEntity = this.prisma.certificate.create({
        data: {
          subject: 'AC Interface',
          serialNumber: serialNumber,
          publicKey: publicKeyPem,
          privateKey: privateKeyPem,
          issuedAt: now,
          validUntil: cert.validity.notAfter,
          isValid: true,
          issuer: 'AC Interface',
          certificatePem: certificatePem,
          isCA: true,
        },
      });
      console.log('Certificado AC criado com sucesso');
      return plainToClass(CertificateEntity, await caCertificateEntity);
    } catch (error) {
      console.log(
        '🚀 ~ CertificatesService ~ createCACertificate ~ error:',
        error,
      );
      const retorno: ErrorEntity = {
        message: error.message,
      };
      throw new HttpException(retorno, 400);
    }
  }

  async createClientCertificate(createCertificateDto: CreateCertificateDto) {
    let AcCertificate = await this.prisma.certificate.findFirst({
      where: { isCA: true, isValid: true },
    });

    if (!AcCertificate || AcCertificate.validUntil <= new Date()) {
      if (AcCertificate) {
        await this.invalidateCertificate(AcCertificate.id);
      }
      const newCaCertificate = await this.createCACertificate();
      AcCertificate = await this.prisma.certificate.findUnique({
        where: { id: newCaCertificate.id },
      });

      if (!AcCertificate) {
        throw new Error('Falha ao recuperar o novo certificado da AC.');
      }
    }

    try {
      const client = await this.clientsService.findByCpf(
        createCertificateDto.cpf.replace(/\D/g, ''),
      );

      if (client.certificates.length > 0) {
        await this.invalidateClientCertificates(client.id);
      }

      // Gera um par de chaves RSA para o cliente
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey, 'RSA');
      const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey, 'RSA');

      // Cria um certificado X.509 para o cliente
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;

      const serialNumber = `521C${Date.now().toString(16)}`;
      cert.serialNumber = serialNumber;

      const now = new Date();
      const validityDays = createCertificateDto.validityDays
        ? parseInt(createCertificateDto.validityDays)
        : 365;
      cert.validity.notBefore = now;
      cert.validity.notAfter = new Date(
        now.getTime() + validityDays * 24 * 60 * 60 * 1000,
      );

      cert.setSubject([
        { name: 'commonName', value: createCertificateDto.name },
        { name: 'countryName', value: this.AcCountry },
        { shortName: 'ST', value: this.AcState },
        { name: 'localityName', value: this.AcCity },
        { name: 'organizationName', value: this.AcRegule },
        {
          name: 'organizationalUnitName',
          value: createCertificateDto.cpf.replace(/\D/g, ''),
        },
        { name: 'organizationalUnitName', value: this.AcTypeCd },
        { name: 'organizationalUnitName', value: this.AcType },
      ]);

      // Lê o certificado da AC
      const caCert = forge.pki.certificateFromPem(AcCertificate.certificatePem);

      // 🔹 Garante que a chave privada da AC está no formato correto

      let caPrivateKey: any;
      if (AcCertificate.privateKey.includes('BEGIN RSA PRIVATE KEY')) {
        const rsaPrivateKey = forge.pki.privateKeyFromPem(
          AcCertificate.privateKey,
        );
        caPrivateKey = forge.pki.privateKeyToPem(rsaPrivateKey, 8); // Converte para PKCS#8
      } else {
        caPrivateKey = forge.pki.privateKeyFromPem(AcCertificate.privateKey);
      }

      cert.setIssuer(caCert.subject.attributes);

      cert.setExtensions([
        { name: 'basicConstraints', cA: false },
        {
          name: 'keyUsage',
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
        },
        // extKeyUsage com apenas clientAuth (sem emailProtection)
        { name: 'extKeyUsage', clientAuth: true },
        {
          name: 'subjectAltName',
          altNames: [
            // E-mail no formato RFC822
            { type: 1, value: client.email },
            // Other Name com OID 2.16.76.1.3.1
            {
              type: 0,
              value: {
                id: '2.16.76.1.3.1',
                value: this.formatBrazilianOtherName(this.AcRegule),
              },
            },
            // Other Name com OID 2.16.76.1.3.6
            {
              type: 0,
              value: {
                id: '2.16.76.1.3.6',
                value: this.formatBrazilianOtherName(this.AcRazao),
              },
            },
            // Other Name com OID 2.16.76.1.3.5
            {
              type: 0,
              value: {
                id: '2.16.76.1.3.5',
                value: this.formatBrazilianOtherName(this.AcName),
              },
            },
          ],
        },
        { name: 'subjectKeyIdentifier' },
        {
          name: 'authorityKeyIdentifier',
          authorityCertIssuer: true,
          serialNumber: caCert.serialNumber,
        },
        {
          name: 'nsComment',
          value: `CPF: ${createCertificateDto.cpf}, Nascimento: ${createCertificateDto.birthDate}`,
        },
        {
          id: '2.5.29.32',
          name: 'certificatePolicies',
          critical: false,
          value: forge.asn1
            .toDer(
              forge.asn1.create(
                forge.asn1.Class.UNIVERSAL,
                forge.asn1.Type.SEQUENCE,
                true,
                [
                  forge.asn1.create(
                    forge.asn1.Class.UNIVERSAL,
                    forge.asn1.Type.SEQUENCE,
                    true,
                    [
                      forge.asn1.create(
                        forge.asn1.Class.UNIVERSAL,
                        forge.asn1.Type.OID,
                        false,
                        forge.asn1.oidToDer('2.16.76.1.2.1.38').getBytes(),
                      ),
                      forge.asn1.create(
                        forge.asn1.Class.UNIVERSAL,
                        forge.asn1.Type.SEQUENCE,
                        true,
                        [
                          forge.asn1.create(
                            forge.asn1.Class.UNIVERSAL,
                            forge.asn1.Type.IA5STRING,
                            false,
                            forge.util.encodeUtf8(
                              'https://arinterface.com.br/doc/dpn-ar.pdf',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            )
            .getBytes(),
        },
        // Se necessário, pode incluir extKeyUsage adicional com outros OIDs:
        { name: 'extKeyUsage', oids: ['1.3.6.1.4.1.311.20.2.2'] },
        // Extensão Authority Information Access (AIA) – codificada manualmente em DER
        {
          id: '1.3.6.1.5.5.7.1.1',
          name: 'authorityInfoAccess',
          critical: false,
          value: forge.asn1
            .toDer(
              forge.asn1.create(
                forge.asn1.Class.UNIVERSAL,
                forge.asn1.Type.SEQUENCE,
                true,
                [
                  // AccessDescription para CA Issuers
                  forge.asn1.create(
                    forge.asn1.Class.UNIVERSAL,
                    forge.asn1.Type.SEQUENCE,
                    true,
                    [
                      // OID para CA Issuers: 1.3.6.1.5.5.7.48.2
                      forge.asn1.create(
                        forge.asn1.Class.UNIVERSAL,
                        forge.asn1.Type.OID,
                        false,
                        forge.asn1.oidToDer('1.3.6.1.5.5.7.48.2').getBytes(),
                      ),
                      // accessLocation como URI (tipo CONTEXT_SPECIFIC, tag 6)
                      forge.asn1.create(
                        forge.asn1.Class.CONTEXT_SPECIFIC,
                        6,
                        false,
                        forge.util.encodeUtf8(
                          'https://arinterface.com.br/doc/AC_Interface_v5.p7b',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            )
            .getBytes(),
        },
      ]);

      // Assina o certificado com a chave privada da AC (corrigida)
      cert.sign(
        forge.pki.privateKeyFromPem(caPrivateKey),
        forge.md.sha256.create(),
      );

      const certificatePem = forge.pki.certificateToPem(cert, 32);

      const certificateEntity = await this.prisma.certificate.create({
        data: {
          subject: createCertificateDto.name,
          serialNumber: serialNumber,
          publicKey: publicKeyPem,
          privateKey: privateKeyPem,
          issuedAt: now,
          validUntil: cert.validity.notAfter,
          isValid: true,
          issuer: AcCertificate.subject,
          certificatePem: certificatePem,
          clientId: client.id,
          isCA: false,
        },
      });

      await this.clientsService.updateCertificateStatus(client.id, true, true);

      return certificateEntity;
    } catch (error) {
      console.log(
        '🚀 ~ CertificatesService ~ createClientCertificate ~ error:',
        error,
      );
      throw new HttpException({ message: error.message }, 400);
    }
  }

  // Método auxiliar para formatar as informações brasileiras no formato correto para OtherName
  private formatBrazilianOtherName(value: string): string {
    // Tag para PrintableString em DER (0x13)
    const tag = 0x13;

    // Para simplificação, assumimos que o tamanho da string é menor que 128
    // Assim, a codificação do tamanho é feita em um único byte
    const length = value.length;

    // Cria um buffer para a tag, para o tamanho e para o conteúdo (em ASCII)
    const tagBuffer = Buffer.from([tag]);
    const lengthBuffer = Buffer.from([length]);
    const contentBuffer = Buffer.from(value, 'ascii');

    // Concatena os buffers
    const derBuffer = Buffer.concat([tagBuffer, lengthBuffer, contentBuffer]);

    // Converte o buffer para uma string hexadecimal formatada (dois dígitos por byte)
    // e insere espaços entre cada byte para visualização
    return (
      derBuffer
        .toString('hex')
        .match(/.{1,2}/g)
        ?.join(' ') || ''
    );
  }

  async invalidateCertificate(id: string): Promise<CertificateEntity> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
    });
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

    const updatedCertificate = await this.prisma.certificate.update({
      where: { id },
      data: certificate,
    });

    return plainToClass(CertificateEntity, updatedCertificate);
  }

  async invalidateClientCertificates(clientId: string): Promise<void> {
    const certificates = await this.prisma.certificate.findMany({
      where: { clientId, isValid: true },
    });

    for (const cert of certificates) {
      cert.isValid = false;
      await this.prisma.certificate.update({
        where: { id: cert.id },
        data: cert,
      });
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
    const count = await this.prisma.certificate.count({
      where: {
        clientId,
        id: {
          not: excludeCertificateId,
        },
        isValid: true,
      },
    });

    return count > 0;
  }

  async findAllCertificatesByClientId(clientId: string) {
    const ContCertificate = await this.prisma.certificate.count({
      where: { clientId },
    });
    const certificates = await this.prisma.certificate.findMany({
      where: { clientId },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
      },
    });
    return ContCertificate > 0 ? certificates : [];
  }

  async verifyCertificate(
    id: string,
  ): Promise<{ isValid: boolean; details: any }> {
    const certificate = await this.prisma.certificate.findUnique({
      where: { id },
    });

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
      await this.prisma.certificate.update({
        where: { id },
        data: certificate,
      });

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

  async createPfx(
    clienteId: string,
    password: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    try {
      const certificate = await this.prisma.certificate.findFirst({
        where: {
          clientId: clienteId,
          isValid: true,
          isDownloaded: false,
          validUntil: { gte: new Date() }, // Verifica se o certificado ainda está válido
        },
        orderBy: { issuedAt: 'desc' },
      });

      if (!certificate) {
        throw new NotFoundException(
          `Certificado válido para o cliente ${clienteId} não encontrado.`,
        );
      }
      //Pegando os dados do cliente
      const client = await this.clientsService.findOne(clienteId);

      const cleanCertificatePem = certificate.certificatePem.trim();
      const cleanPrivateKeyPem = certificate.privateKey.trim();

      // Converte o certificado e a chave privada para objetos do Forge
      const cert = forge.pki.certificateFromPem(cleanCertificatePem);
      const privateKey = forge.pki.privateKeyFromPem(cleanPrivateKeyPem);

      // // Cria um novo PFX (PKCS#12)
      // const pfx = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, {
      //   algorithm: 'aes256',
      //   prfAlgorithm: 'SHA256', // força o uso de SHA‑256
      //   count: 200000,
      // });

      // Cria um novo p12 (PKCS#12)
      const pfx = forge.pkcs12.toPkcs12(privateKey, cert);

      // Converte para Buffer (DER)
      const pfxBuffer = Buffer.from(forge.asn1.toDer(pfx).getBytes(), 'binary');

      if (!certificate || !certificate.subject || !client || !client.cpf) {
        throw new Error('Dados do certificado ou cliente não encontrados');
      }

      const fileName = `${certificate.subject.replace(/\s+/g, '_')}_${client.cpf.replace(/\D/g, '')}.pfx`;
      const storagePath = path.join(
        process.cwd(),
        'uploads',
        'certificados',
        fileName,
      );

      // Criar diretório caso não exista
      await fs.mkdir(path.join(process.cwd(), 'uploads', 'certificados'), {
        recursive: true,
      });

      // Salvar o PFX no repositório
      await fs.writeFile(storagePath, pfxBuffer);

      // Atualiza o status do certificado
      certificate.isDownloaded = true;
      certificate.pathCertificate = `upload/certificados/${fileName}`;
      certificate.pfxPassword = password;
      await this.prisma.certificate.update({
        where: { id: certificate.id },
        data: certificate,
      });

      return { buffer: pfxBuffer, fileName };
    } catch (error: any) {
      console.error('Erro ao gerar PFX:', error);
      throw new HttpException({ message: error.message }, 400);
    }
  }

  // gerar o certificado p7b da AC
  async generateCertificateP7b(): Promise<{
    buffer: Buffer;
    fileName: string;
  }> {
    try {
      const certificate = await this.prisma.certificate.findFirst({
        where: {
          clientId: null,
          isValid: true,
          isDownloaded: false,
          validUntil: { gte: new Date() }, // Verifica se o certificado ainda está válido
        },
        orderBy: { issuedAt: 'desc' },
      });

      if (!certificate) {
        throw new NotFoundException(
          `Certificado válido para AC não encontrado.`,
        );
      }

      // Utilizar o certificadoPem armazenado no banco
      const certPem = certificate.certificatePem;

      if (!certPem) {
        throw new Error('Certificado PEM não encontrado no banco de dados');
      }

      // Criar o PKCS#7 SignedData
      const cert = forge.pki.certificateFromPem(certPem);
      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer('');

      // Adicionar o certificado
      p7.addCertificate(cert);

      // Se você tiver a cadeia de certificação, pode adicionar aqui
      // Normalmente um P7B pode conter a cadeia completa de certificação

      // Gerar o arquivo P7B
      const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
      const buffer = Buffer.from(der, 'binary');

      // Nome do arquivo baseado no CN do certificado ou um nome padrão
      const commonName = this.AcName || 'AC_Certificate';
      const sanitizedName = commonName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedName}.p7b`;

      // Atualizar o certificado como baixado
      await this.prisma.certificate.update({
        where: { id: certificate.id },
        data: { isDownloaded: true },
      });

      return { buffer, fileName };
    } catch (error) {
      console.error('Erro ao gerar P7B:', error);
      throw new HttpException({ message: error.message }, 400);
    }
  }
}
