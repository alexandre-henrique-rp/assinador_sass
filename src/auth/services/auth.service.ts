import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ClientsService } from '../../clients/services/clients.service';
import { plainToClass } from 'class-transformer';
import { ClientEntity } from 'src/clients/entities/client.entity';

@Injectable()
export class AuthService {
  constructor(
    private clientsService: ClientsService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    try {
      const user = await this.clientsService.findByUsername(username);
      if (user && (await this.comparePasswords(pass, user.password))) {
        return plainToClass(ClientEntity, user);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, cpf: user.cpf };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        cpf: user.cpf,
        email: user.email,
      },
    };
  }

  private async comparePasswords(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, hashedPassword);
  }
}
