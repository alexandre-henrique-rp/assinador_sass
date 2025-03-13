import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import {
  existsSync,
  promises as fs,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import * as forge from 'node-forge';
import * as path from 'path';
import * as crypto from 'crypto';
import { ClientsService } from 'src/clients/services/clients.service';
import { ErrorEntity } from '../../error.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { CertificateEntity } from '../entities/certificate.entity';
import { execSync } from 'child_process';

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

      const dirPath = path.join(process.cwd(), 'uploads', 'certificados', 'ca');
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }

      // Gerar chaves privada e pública
      const caKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Salvar as chaves
      const privateKeyPath = `${dirPath}/ca_private_key.pem`;
      const publicKeyPath = `${dirPath}/ca_public_key.pem`;

      const privateKeyPem = caKeyPair.privateKey;
      writeFileSync(privateKeyPath, caKeyPair.privateKey, 'utf8');
      console.log("Chave privada salva em 'ca_private_key.pem'");

      const publicKeyPem = caKeyPair.publicKey;
      writeFileSync(publicKeyPath, caKeyPair.publicKey, 'utf8');
      console.log("Chave pública salva em 'ca_public_key.pem'");

      const nome = this.AcName;
      const organizacao = this.AcRazao;
      const unidade = this.AcTypeCd;

      // Criar um certificado CA auto assinado usando OpenSSL
      const certPath = `${dirPath}/ca_cert.pem`;
      const subject = `/C=BR/O=${organizacao}/OU=${unidade}/CN=${nome}`;

      try {
        execSync(
          `openssl req -new -x509 -key ${privateKeyPath} -out ${certPath} -days 3650 -subj "${subject}"`,
          { stdio: 'inherit' },
        );
        console.log('Certificado criado com sucesso');
      } catch (error) {
        console.log('Erro ao criar o certificado: ' + error.message);
        throw new Error('Erro ao criar o certificado: ' + error.message);
      }

      const cert = readFileSync(certPath, 'utf8');

      const now = new Date();
      const validate = new Date(now.getTime() + 3650 * 60 * 60 * 24 * 365);

      // Salva o certificado da AC no banco de dados
      const caCertificateEntity = this.prisma.certificate.create({
        data: {
          subject: 'AC Interface',
          serialNumber: '',
          publicKey: publicKeyPem,
          privateKey: privateKeyPem,
          issuedAt: now,
          validUntil: validate,
          isValid: true,
          issuer: 'AC Interface',
          certificatePem: cert,
          isCA: true,
          csr: '',
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
    try {
      const client = await this.clientsService.findByCpf(
        createCertificateDto.cpf.replace(/\D/g, ''),
      );

      if (client.certificates.length > 0) {
        await this.invalidateClientCertificates(client.id);
      }

      const OriginalPath = 'uploads/certificados';
      const clientDir = `${OriginalPath}/${this.limparTexto2(client.name)}${client.cpf}`;
      const caPath = path.join(process.cwd(), 'uploads', 'certificados', 'ca');

      // Gerar chave privada para o cliente (sem senha)
      const clientKeyPath = `${clientDir}/private_key.pem`;

      const publicKeyPath = `${clientDir}/public_key.pem`;
      const csrPath = `${clientDir}/${this.limparTexto2(client.name)}.csr`;
      const certPath = `${clientDir}/${this.limparTexto2(client.name)}.pem`;
      const pfxPath = `${clientDir}/${this.limparTexto2(client.name)}-${client.cpf}.pfx`;

      const clientKeyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      if (!existsSync(clientDir)) {
        mkdirSync(clientDir);
      }

      const clientPrivateKey = clientKeyPair.privateKey;
      writeFileSync(
        path.join(process.cwd(), clientKeyPath),
        clientKeyPair.privateKey,
        'utf8',
      );
      console.log(`Chave privada do cliente salva em '${clientKeyPath}'`);

      const clientPublicKey = clientKeyPair.publicKey;
      writeFileSync(
        path.join(process.cwd(), publicKeyPath),
        clientKeyPair.publicKey,
        'utf8',
      );
      console.log(`Chave pública do cliente salva em '${publicKeyPath}'`);

      const serialNumber = `0x521C${Date.now().toString(16)}`;

      const nome = this.limparTexto2(client.name);
      const cpf = client.cpf;
      const organizacao = this.AcRazao;
      const unidade = this.AcTypeCd;
      const unidade1 = 'Certificado Digital';
      const CA = this.AcName;
      const password = '1234';
      const Days = 365;
      const Serial = serialNumber;

      // Criar CSR com OpenSSL, incluindo o CPF no CN
      const subject = `/C=BR/O=${organizacao}/OU=${unidade}/OU=${unidade1}/OU=${CA}/CN=${nome}:${cpf}`;

      try {
        execSync(
          `openssl req -new -key ${path.join(process.cwd(), clientKeyPath)} -out ${path.join(process.cwd(), csrPath)} -subj "${subject}"`,
          { stdio: 'inherit' },
        );
        console.log(`CSR gerado em '${path.join(process.cwd(), csrPath)}'`);
      } catch (error) {
        console.log('Erro ao gerar o CSR: ' + error.message);
        throw new Error('Erro ao gerar o CSR: ' + error.message);
      }

      const csr = readFileSync(path.join(process.cwd(), csrPath), 'utf8');

      // Assinar CSR com a CA
      try {
        execSync(
          `openssl x509 -req -in ${path.join(process.cwd(), csrPath)} -CA ${caPath}/ca_cert.pem -CAkey ${caPath}/ca_private_key.pem -out ${path.join(process.cwd(), certPath)} -days ${Days} -sha256 -set_serial ${Serial}`,
          { stdio: 'inherit' },
        );
        console.log(
          `Certificado assinado gerado em '${path.join(process.cwd(), certPath)}'`,
        );
      } catch (error) {
        console.log('Erro ao assinar o CSR: ' + error.message);
        throw new Error('Erro ao assinar o CSR: ' + error.message);
      }

      const cert = readFileSync(path.join(process.cwd(), certPath), 'utf8');

      // Gerar o arquivo PFX (PKCS#12)
      try {
        execSync(
          `openssl pkcs12 -export -out ${path.join(process.cwd(), pfxPath)} -inkey ${path.join(process.cwd(), clientKeyPath)} -in ${path.join(process.cwd(), certPath)} -certfile ${caPath}/ca_cert.pem -passout pass:${password} `,
          { stdio: 'inherit' },
        );
        console.log(
          `Arquivo PFX gerado em '${path.join(process.cwd(), pfxPath)}'`,
        );
      } catch (error) {
        console.log('Erro ao gerar o PFX: ' + error.message);
        throw new Error('Erro ao gerar o PFX: ' + error.message);
      }

      const now = new Date();
      const expirationDate = new Date(
        now.getTime() + 365 * 24 * 60 * 60 * 1000,
      );

      const certificateEntity = await this.prisma.certificate.create({
        data: {
          subject: createCertificateDto.name,
          serialNumber: serialNumber,
          publicKey: clientPublicKey,
          privateKey: clientPrivateKey,
          issuedAt: now,
          validUntil: expirationDate,
          isValid: true,
          issuer: 'AC Interface',
          certificatePem: cert,
          clientId: client.id,
          isCA: false,
          pathCertificate: pfxPath,
          csr: csr,
          pfxPassword: password,
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

  limparTexto2(texto: string): string {
    return texto
      .normalize('NFD') // Normaliza para decompor caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '_') // Remove espaços em excesso
      .toUpperCase(); // Converte para maiúsculas
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
      const pfx = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], password, {
        algorithm: 'aes256',
        prfAlgorithm: 'SHA256', // força o uso de SHA‑256
        count: 200000,
      });

      // Cria um novo p12 (PKCS#12)
      // const pfx = forge.pkcs12.toPkcs12(privateKey, cert);

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
