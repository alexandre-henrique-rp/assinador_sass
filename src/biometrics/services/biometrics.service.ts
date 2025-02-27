import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ClientsService } from '../../clients/services/clients.service';
import * as faceapi from 'face-api.js';

@Injectable()
export class BiometricsService {
  constructor(
    private clientsService: ClientsService,
  ) {
    // Inicialização dos modelos do face-api.js seriam feitos aqui
    // Em um ambiente Node.js, seria necessário usar canvas-node ou similar
    // Como isso exige configuração adicional, vamos deixar isso como comentário
    /*
    const canvas = require('canvas');
    const { Canvas, Image, ImageData } = canvas;
    // Patch para o faceapi funcionar com node-canvas
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
    
    // Carregar os modelos
    Promise.all([
      faceapi.nets.faceRecognitionNet.loadFromDisk('./models'),
      faceapi.nets.faceLandmark68Net.loadFromDisk('./models'),
      faceapi.nets.ssdMobilenetv1.loadFromDisk('./models'),
    ]);
    */
  }

  async uploadFacialPhoto(file: Express.Multer.File, userId: string): Promise<any> {
    try {
      // Busca o cliente
      const client = await this.clientsService.findOne(userId);
      
      // Substitui espaços no nome do arquivo por _
      const originalName = file.originalname.replace(/\s+/g, '_');
      
      // Salva o arquivo com um nome único
      const uniqueFilename = `${client.cpf}-facial-${Date.now()}${path.extname(originalName)}`;
      const storagePath = path.join('uploads', 'biometrics', uniqueFilename);
      const absolutePath = path.join(process.cwd(), storagePath);
      
      // Cria diretório se não existir
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Move o arquivo para o diretório de armazenamento permanente
      fs.copyFileSync(file.path, absolutePath);
      fs.unlinkSync(file.path); // Remove o arquivo temporário
      
      // Atualiza o URL da foto facial no perfil do cliente
      const facialPhotoUrl = `/uploads/biometrics/${uniqueFilename}`;
      await this.clientsService.updateFacialPhoto(client.id, facialPhotoUrl);
      
      return {
        success: true,
        message: 'Foto facial enviada com sucesso',
        facialPhotoUrl,
      };
    } catch (error) {
      // Se ocorrer erro, garante que o arquivo temporário seja excluído
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(`Erro ao fazer upload da foto facial: ${error.message}`);
    }
  }

  async verifyFacialIdentity(file: Express.Multer.File, userId: string): Promise<any> {
    try {
      // Busca o cliente
      const client = await this.clientsService.findOne(userId);
      
      // Verifica se o cliente possui foto facial cadastrada
      if (!client.facialPhotoUrl) {
        throw new BadRequestException('Cliente não possui foto facial cadastrada');
      }
      
      // Caminhos dos arquivos
      const registeredPhotoPath = path.join(process.cwd(), client.facialPhotoUrl.replace(/^\/uploads/, 'uploads'));
      
      // Verifica se o arquivo registrado existe
      if (!fs.existsSync(registeredPhotoPath)) {
        throw new NotFoundException('Foto facial registrada não encontrada no servidor');
      }
      
      // Em uma implementação real, aqui seria realizada a verificação usando o face-api.js
      // Como isso exige configuração adicional do ambiente, vamos simular o resultado
      
      // Simulação de verificação facial - em produção seria usada uma biblioteca real
      const similarityScore = Math.random(); // Em produção, isso seria calculado pela API de reconhecimento facial
      const threshold = 0.6; // Limiar de similaridade aceitável
      const isMatch = similarityScore >= threshold;
      
      // Remove o arquivo temporário após a verificação
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      return {
        isMatch,
        similarityScore,
        threshold,
        message: isMatch 
          ? 'Verificação facial bem-sucedida' 
          : 'Verificação facial falhou: rosto não corresponde à foto registrada',
      };
    } catch (error) {
      // Se ocorrer erro, garante que o arquivo temporário seja excluído
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(`Erro na verificação facial: ${error.message}`);
    }
  }

  async uploadDocumentPhoto(file: Express.Multer.File, userId: string): Promise<any> {
    try {
      // Busca o cliente
      const client = await this.clientsService.findOne(userId);
      
      // Substitui espaços no nome do arquivo por _
      const originalName = file.originalname.replace(/\s+/g, '_');
      
      // Salva o arquivo com um nome único
      const uniqueFilename = `${client.cpf}-document-${Date.now()}${path.extname(originalName)}`;
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
      
      // Atualiza o URL da foto do documento no perfil do cliente
      const documentPhotoUrl = `/uploads/documents/${uniqueFilename}`;
      await this.clientsService.updateDocumentPhoto(client.id, documentPhotoUrl);
      
      return {
        success: true,
        message: 'Foto do documento enviada com sucesso',
        documentPhotoUrl,
      };
    } catch (error) {
      // Se ocorrer erro, garante que o arquivo temporário seja excluído
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(`Erro ao fazer upload da foto do documento: ${error.message}`);
    }
  }
}
