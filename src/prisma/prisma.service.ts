import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Promisify exec para uso com async/await
const execAsync = promisify(exec);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    // Verificar e criar a pasta db se não existir
    // await this.verificarECriarPastaDB();
    // await this.$connect();
    // await this.verificarECriarTabelas();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async verificarECriarPastaDB() {
    const dbPath = path.resolve(__dirname, '../../db');

    try {
      // Verifica se a pasta existe
      if (!fs.existsSync(dbPath)) {
        console.log(`Pasta db não encontrada. Criando em: ${dbPath}`);
        fs.mkdirSync(dbPath, { recursive: true });
        console.log('Pasta db criada com sucesso.');
      } else {
        console.log('Pasta db já existe.');
      }
    } catch (error) {
      console.error('Erro ao verificar/criar pasta db:', error);
      throw error; // Repassar o erro para interromper a inicialização
    }
  }

  async verificarECriarTabelas() {
    try {
      const tabelas = ['Client', 'Document', 'Signature', 'Certificate'];
      let algumaTabelaFaltando = false;

      for (const tabela of tabelas) {
        const tabelaExiste = await this.verificarSeExisteTabela(tabela);

        if (!tabelaExiste) {
          console.log(`Tabela ${tabela} não encontrada.`);
          algumaTabelaFaltando = true;
        } else {
          console.log(`Tabela ${tabela} já existe.`);
        }
      }

      if (algumaTabelaFaltando) {
        console.log(
          'Algumas tabelas estão faltando. Executando prisma db push...',
        );
        await this.criarTabela();
        console.log('Tabelas criadas com sucesso.');
      }
    } catch (error) {
      console.error('Erro ao verificar/criar tabelas:', error);
    }
  }

  private async verificarSeExisteTabela(nomeTabela: string): Promise<boolean> {
    const resultado = await this.$queryRaw`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=${nomeTabela};
    `;

    return Array.isArray(resultado) && resultado.length > 0;
  }

  private async criarTabela(): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync('npx prisma db push');
      console.log(`Prisma db push executado com sucesso: ${stdout}`);
      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }
    } catch (error) {
      console.error(`Erro ao executar prisma db push: ${error.message}`);
      throw error;
    }
  }
}
