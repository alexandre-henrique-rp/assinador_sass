import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.findMany();
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new NotFoundException(`Cliente com ID ${id} não encontrado`);
    }

    return client;
  }

  async findByUsername(username: string) {
    const client = await this.prisma.client.findUnique({
      where: { username },
    });

    if (!client) {
      throw new NotFoundException(
        `Cliente com usuário ${username} não encontrado`,
      );
    }

    return client;
  }

  async findByCpf(cpf: string) {
    const client = await this.prisma.client.findUnique({
      where: { cpf },
    });

    if (!client) {
      throw new NotFoundException(`Cliente com CPF ${cpf} não encontrado`);
    }

    return client;
  }

  async create(createClientDto: CreateClientDto) {
    // Verifica se já existe um cliente com o CPF, email ou username fornecidos
    const existingCpf = await this.prisma.client.findUnique({
      where: { cpf: createClientDto.cpf },
    });
    if (existingCpf) {
      throw new ConflictException(`CPF ${createClientDto.cpf} já está em uso`);
    }

    const existingEmail = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });
    if (existingEmail) {
      throw new ConflictException(
        `Email ${createClientDto.email} já está em uso`,
      );
    }

    const existingUsername = await this.prisma.client.findUnique({
      where: { username: createClientDto.username },
    });
    if (existingUsername) {
      throw new ConflictException(
        `Nome de usuário ${createClientDto.username} já está em uso`,
      );
    }

    // Cria o novo cliente com a senha criptografada
    return this.prisma.client.create({
      data: {
        ...createClientDto,
        password: await this.hashPassword(createClientDto.password),
        birthDate: new Date(createClientDto.birthDate),
      },
    });
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const client = await this.findOne(id);

    // Se estiver atualizando o email, verifica se já existe
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingEmail = await this.prisma.client.findUnique({
        where: { email: updateClientDto.email },
      });
      if (existingEmail) {
        throw new ConflictException(
          `Email ${updateClientDto.email} já está em uso`,
        );
      }
    }

    // Se estiver atualizando o username, verifica se já existe
    if (
      updateClientDto.username &&
      updateClientDto.username !== client.username
    ) {
      const existingUsername = await this.prisma.client.findUnique({
        where: { username: updateClientDto.username },
      });
      if (existingUsername) {
        throw new ConflictException(
          `Nome de usuário ${updateClientDto.username} já está em uso`,
        );
      }
    }

    // Se houver senha, criptografa
    let password = undefined;
    if (updateClientDto.password) {
      password = await this.hashPassword(updateClientDto.password);
    }

    // Se houver data de nascimento, converte para Date
    let birthDate = undefined;
    if (updateClientDto.birthDate) {
      birthDate = new Date(updateClientDto.birthDate);
    }

    // Atualiza o cliente
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(updateClientDto as any),
        ...(password ? { password } : {}),
        ...(birthDate ? { birthDate } : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Verifica se o cliente existe
    await this.prisma.client.delete({
      where: { id },
    });
  }

  async updateDocumentPhoto(id: string, documentPhotoUrl: string) {
    return this.prisma.client.update({
      where: { id },
      data: { documentPhotoUrl },
    });
  }

  async updateFacialPhoto(id: string, facialPhotoUrl: string) {
    return this.prisma.client.update({
      where: { id },
      data: { facialPhotoUrl },
    });
  }

  async updateCertificateStatus(
    id: string,
    hasCertificate: boolean,
    isValid: boolean,
  ) {
    return this.prisma.client.update({
      where: { id },
      data: {
        hasCertificate,
        isCertificateValid: isValid,
      },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }
}
