import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  // Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { DocumentFilterDto } from '../dto/document-filter.dto';

@ApiTags('Ducumentação')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'file',
          format: 'binary',
          description: 'Documento PDF a ser assinado',
        },
        cpf: {
          type: 'string',
          description: 'cpf de quem vai assinar',
          format: 'Text',
          example: '123.456.789-00',
        },
        admId: {
          type: 'string',
          description: 'id do responsável por gerenciar a assinatura',
          format: 'Text',
          example: 'a003e132-d6eb-45e6-bf23-c4b2d1a4b4e5',
        },
      },
      required: ['file', 'cpf', 'admId'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',

        filename: (req, file, cb) => {
          //verificar se o nome do arquivo ja existe
          const nameFile = new Date().getTime().toString();
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
  UploadDocment(
    @UploadedFile() file: Express.Multer.File,
    @Body() data: DocumentFilterDto,
  ) {
    const bucket = process.env.MINIO_BUCKET || 'my-bucket';
    return this.documentsService.arquivar(bucket, file, data);
  }

  @Get('download/:id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const document = await this.documentsService.ViewFile(id);
    return res.send(document);
  }

  @Get('view/:id')
  async view(@Param('id') id: string, @Res() res: Response) {
    const OriginalPath = await this.documentsService.ViewFile(id);
    return res.redirect(OriginalPath);
  }

  // @Put('update')
  // @UseInterceptors(
  //   FileInterceptor('file', {
  //     storage: diskStorage({
  //       destination: './uploads/documents',

  //       filename: (req, file, cb) => {
  //         //verificar se o nome do arquivo ja existe
  //         const nameFile = file.originalname.replace(/\s+/g, '_');
  //         const extencion = extname(file.originalname);
  //         //pegar o nome do arquivo sem a extensao
  //         const fileName = nameFile.split(extencion)[0];
  //         const fileExist = fs.existsSync(`./uploads/documents/${nameFile}`);
  //         if (fileExist) {
  //           //verificar quantos arquivos com o mesmo nome existem
  //           const files = fs.readdirSync('./uploads/documents');
  //           const total = files.length;
  //           return cb(null, `${fileName}(${total})${extencion}`);
  //         }
  //         return cb(null, `${fileName}${extencion}`);
  //       },
  //     }),
  //   }),
  // )
  // async update(@UploadedFile() file: Express.Multer.File, @Body() data: any) {
  //   const { id } = data;
  //   return this.documentsService.update(id, file);
  // }

  @Delete(':fileName')
  async remove(@Param('fileName') fileName: string) {
    await this.documentsService.remove(fileName);
    return { message: 'Documento removido com sucesso' };
  }
}
// function smartSanitizeIdentifier(input: string) {
//   if (!input) return '';
//   // Remove todos os caracteres não numéricos
//   const numericOnly = input.replace(/[^\d]/g, '');

//   // Se for exatamente 11 ou 14 dígitos numéricos
//   if (numericOnly.length === 11 || numericOnly.length === 14) {
//     return numericOnly;
//   }

//   // Para nomes de arquivos
//   const sanitized = input
//     .normalize('NFD') // Normaliza caracteres acentuados
//     .replace(/[\u0300-\u036f]/g, '') // Remove acentos
//     .replace(/[^a-zA-Z0-9_\-\.]/g, '_') // Substitui caracteres inválidos
//     .replace(/\s+/g, '_') // Substitui múltiplos espaços
//     .toLowerCase(); // Converte para minúsculas

//   return sanitized;
// }
