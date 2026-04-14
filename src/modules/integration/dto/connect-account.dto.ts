import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConnectAccountDto {
  @ApiProperty({
    description: 'ID da empresa (CNPJ) que será vinculada ao marketplace',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  companyId: string;
}
