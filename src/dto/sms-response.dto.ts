import { ApiProperty } from '@nestjs/swagger'

/** SMS 服务存活检查响应。 */
export class SmsLivenessResponseDto {
    @ApiProperty({ description: '服务状态', enum: ['UP'], example: 'UP' })
    status: 'UP'
}
