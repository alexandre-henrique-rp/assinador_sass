import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SignaturesService } from '../services/signatures.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('assinaturas')
@Controller('signatures')
export class SignaturesController {
  constructor(private signaturesService: SignaturesService) {}

  @Post('advanced')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assinar documento com assinatura avançada' })
  @ApiResponse({ status: 201, description: 'Documento assinado com sucesso' })
  @ApiResponse({ status: 400, description: 'Erro ao assinar documento' })
  async signDocumentAdvanced(
    @Body() signDocumentDto: { documentId: string; signerId: string },
  ) {
    return this.signaturesService.signDocumentAdvanced(
      signDocumentDto.documentId,
      signDocumentDto.signerId,
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
  async signDocumentQualified(
    @Body()
    signDocumentDto: {
      documentId: string;
      signerId: string;
      certificateId: string;
    },
  ) {
    return this.signaturesService.signDocumentQualified(
      signDocumentDto.documentId,
      signDocumentDto.signerId,
      signDocumentDto.certificateId,
    );
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
    return this.signaturesService.getDocumentSignatures(documentId);
  }

  @Get('verify/:signatureId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar autenticidade de uma assinatura' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da verificação da assinatura',
  })
  async verifySignature(@Param('signatureId') signatureId: string) {
    return this.signaturesService.verifySignature(signatureId);
  }
}
