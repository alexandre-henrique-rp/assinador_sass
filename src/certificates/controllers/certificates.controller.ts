import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CertificatesService } from '../services/certificates.service';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('certificados')
@Controller('certificates')
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Post('ca')
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar Autoridade Certificadora (AC)' })
  @ApiResponse({
    status: 201,
    description: 'Autoridade Certificadora criada com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Erro ao criar AC' })
  createCA() {
    console.log('Criando AC...');
    return this.certificatesService.createCACertificate();
  }

  @Post()
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar certificado para cliente' })
  @ApiBody({ type: CreateCertificateDto })
  @ApiResponse({
    status: 201,
    description: 'Certificado criado com sucesso',
  })
  @ApiResponse({ status: 400, description: 'Erro ao criar certificado' })
  createClientCertificate(@Body() createCertificateDto: CreateCertificateDto) {
    return this.certificatesService.createClientCertificate(
      createCertificateDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos os certificados' })
  @ApiResponse({
    status: 200,
    description: 'Lista de certificados retornada com sucesso',
  })
  findAll() {
    return this.certificatesService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar certificado por ID' })
  @ApiParam({ name: 'id', description: 'ID do certificado' })
  @ApiResponse({ status: 200, description: 'Certificado encontrado' })
  @ApiResponse({ status: 404, description: 'Certificado não encontrado' })
  findOne(@Param('id') id: string) {
    return this.certificatesService.findOne(id);
  }

  @Get('client/:clientId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar certificados de um cliente' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Certificados do cliente encontrados',
  })
  findByClientId(@Param('clientId') clientId: string) {
    return this.certificatesService.findByClientId(clientId);
  }

  @Get('cpf/:cpf')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar certificados por CPF do cliente' })
  @ApiParam({ name: 'cpf', description: 'CPF do cliente' })
  @ApiResponse({
    status: 200,
    description: 'Certificados encontrados',
  })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado' })
  findByClientCpf(@Param('cpf') cpf: string) {
    return this.certificatesService.findByClientCpf(cpf);
  }

  @Get(':id/verify')
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar validade de um certificado' })
  @ApiParam({ name: 'id', description: 'ID do certificado' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação do certificado',
  })
  @ApiResponse({ status: 404, description: 'Certificado não encontrado' })
  verifyCertificate(@Param('id') id: string) {
    return this.certificatesService.verifyCertificate(id);
  }

  @Post(':id/invalidate')
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Invalidar um certificado' })
  @ApiParam({ name: 'id', description: 'ID do certificado' })
  @ApiResponse({
    status: 200,
    description: 'Certificado invalidado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Certificado não encontrado' })
  invalidateCertificate(@Param('id') id: string) {
    return this.certificatesService.invalidateCertificate(id);
  }

  @Get('download-pfx/:clientId')
  @ApiOperation({ summary: 'Download do PFX' })
  @ApiParam({ name: 'clientId', description: 'ID do cliente' })
  @ApiQuery({ name: 'password', description: 'Senha para o PFX' })
  @ApiResponse({
    status: 200,
    description: 'PFX baixado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Certificado não encontrado' })
  async downloadPFX(
    @Param('clientId') clientId: string,
    @Query('password') password: string,
    @Res() res: Response,
  ) {
    if (!password) {
      throw new HttpException(
        'Senha obrigatória para o PFX.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Chama o serviço para gerar o PFX
      const { buffer, fileName } = await this.certificatesService.createPfx(
        clientId,
        password,
      );

      // Configura a resposta para download
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.setHeader('Content-Type', 'application/x-pkcs12');
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } catch (error) {
      console.error('Erro ao baixar o PFX:', error);
      throw new HttpException(
        'Erro ao baixar o PFX.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('ac/download-p7b')
  @ApiOperation({ summary: 'Download do P7B' })
  @ApiResponse({
    status: 200,
    description: 'P7B baixado com sucesso',
  })
  @ApiResponse({ status: 404, description: 'Certificado não encontrado' })
  async downloadCertificateP7b(@Res() res: Response) {
    try {
      // Chama o serviço para gerar o P7B
      const { buffer, fileName } =
        await this.certificatesService.generateCertificateP7b();

      // Configura a resposta para download
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.setHeader('Content-Type', 'application/x-pkcs12');
      res.setHeader('Content-Length', buffer.length);

      return res.send(buffer);
    } catch (error) {
      console.error('Erro ao baixar o P7B:', error);
      throw new HttpException(
        'Erro ao baixar o P7B.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
