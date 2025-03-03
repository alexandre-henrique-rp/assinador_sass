import { Controller, Get } from '@nestjs/common';
import { DocumentsService } from '../services/documents.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Ducumentação')
@Controller('Documentes')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll() {
    return 'findAll';
  }
}
