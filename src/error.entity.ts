import { ApiResponseProperty } from '@nestjs/swagger';

export class ErrorEntity {
  @ApiResponseProperty({ type: String })
  message: string;
}
