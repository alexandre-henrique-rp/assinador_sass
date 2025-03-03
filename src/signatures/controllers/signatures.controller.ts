import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SignaturesService } from '../services/signatures.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateSignatureDto } from '../dto/create-signature.dto';

@ApiTags('assinaturas')
@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signaturesService: SignaturesService) {}

  @Post('advanced')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assinar documento com assinatura avançada' })
  @ApiResponse({ status: 201, description: 'Documento assinado com sucesso' })
  @ApiResponse({ status: 400, description: 'Erro ao assinar documento' })
  async signDocumentAdvanced(@Body() createSignatureDto: CreateSignatureDto) {
    return this.signaturesService.createAdvancedSignature(
      createSignatureDto.documentId,
      createSignatureDto.signerId,
      createSignatureDto,
    );
  }

  @Post('qualified')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Assinar documento com assinatura qualificada ICP-Brasil',
  })
  @ApiResponse({ status: 201, description: 'Documento assinado com sucesso' })
  @ApiResponse({ status: 400, description: 'Erro ao assinar documento' })
  async signDocumentQualified(@Body() createSignatureDto: CreateSignatureDto) {
    return this.signaturesService.createQualifiedSignature(createSignatureDto);
  }

  @Get('document/:documentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter assinaturas de um documento' })
  @ApiResponse({
    status: 200,
    description: 'Assinaturas retornadas com sucesso',
  })
  async getDocumentSignatures(@Param('documentId') documentId: string) {
    return this.signaturesService.findByDocumentId(documentId);
  }

  // @Get('verify/:signatureId')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth()
  // @ApiOperation({ summary: 'Verificar autenticidade de uma assinatura' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Resultado da verificação da assinatura',
  // })
  // async verifySignature(@Param('signatureId') signatureId: string) {
  //   return this.signaturesService.verifySignature(signatureId);
  // }
}
