import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import { ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import * as fs from 'fs';
import { Response } from 'express';

@ApiTags('Ducumentação')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',

        filename: (req, file, cb) => {
          //verificar se o nome do arquivo ja existe
          const nameFile = smartSanitizeIdentifier(file.originalname);
          const extencion = extname(file.originalname);
          //pegar o nome do arquivo sem a extensao
          const fileName = nameFile.split(extencion)[0];
          const fileExist = fs.existsSync(`./uploads/documents/${nameFile}`);
          if (fileExist) {
            //verificar quantos arquivos com o mesmo nome existem
            const files = fs.readdirSync('./uploads/documents');
            const total = files.length;
            return cb(null, `${fileName}(${total})${extencion}`);
          }
          return cb(null, `${fileName}${extencion}`);
        },
      }),
    }),
  )
  UploadDocment(@UploadedFile() file: Express.Multer.File, @Body() data: any) {
    const { cpf, id } = data;
    return this.documentsService.create(file, cpf, id);
  }

  @Get('download/:fileName')
  async download(@Param('fileName') fileName: string, @Res() res: Response) {
    const Signer = this.documentsService.IsSing(fileName);
    if (!Signer) {
      const OriginalPath = await this.documentsService.ViewFile(fileName);
      return res.download(OriginalPath);
    }
    const BufferFile = await this.documentsService.DownloadFile(fileName);
    const buffer = Buffer.from(BufferFile);
    return res.send(buffer);
  }

  @Get('view/:fileName')
  async view(@Param('fileName') fileName: string, @Res() res: Response) {
    const OriginalPath = await this.documentsService.ViewFile(fileName);
    return res.sendFile(OriginalPath);
  }

  @Put('update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',

        filename: (req, file, cb) => {
          //verificar se o nome do arquivo ja existe
          const nameFile = file.originalname.replace(/\s+/g, '_');
          const extencion = extname(file.originalname);
          //pegar o nome do arquivo sem a extensao
          const fileName = nameFile.split(extencion)[0];
          const fileExist = fs.existsSync(`./uploads/documents/${nameFile}`);
          if (fileExist) {
            //verificar quantos arquivos com o mesmo nome existem
            const files = fs.readdirSync('./uploads/documents');
            const total = files.length;
            return cb(null, `${fileName}(${total})${extencion}`);
          }
          return cb(null, `${fileName}${extencion}`);
        },
      }),
    }),
  )
  async update(@UploadedFile() file: Express.Multer.File, @Body() data: any) {
    const { id } = data;
    return this.documentsService.update(id, file);
  }

  @Delete(':fileName')
  async remove(@Param('fileName') fileName: string) {
    await this.documentsService.remove(fileName);
    return { message: 'Documento removido com sucesso' };
  }
}
function smartSanitizeIdentifier(input: string) {
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
