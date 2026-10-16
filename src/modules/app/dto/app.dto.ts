import { ApiProperty, IntersectionType, OmitType, PartialType, PickType } from '@nestjs/swagger'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 获取客户短信应用静态枚举响应：GET /app/enums。 */
export class SmsAppEnumsResponseDto extends EnumsResponseDto({
    typeOptions: { description: '短信应用类型选项', example: Schema.TbSmsAppTypeDefinition.options },
    statusOptions: { description: '短信应用状态选项', example: Schema.TbSmsAppStatusDefinition.options }
}) {}

/** 新增客户短信应用入参：POST /app/create。 */
export class CreateSmsAppDto extends IntersectionType(
    PickType(Schema.TbSmsAppDto, ['userKeyId', 'type'] as const),
    PartialType(PickType(Schema.TbSmsAppDto, ['pushUrl', 'remark'] as const))
) {}

/** 更新客户短信应用入参：POST /app/update。 */
export class UpdateSmsAppDto extends IntersectionType(
    PickType(Schema.TbSmsAppDto, ['status', 'type'] as const),
    PartialType(PickType(Schema.TbSmsAppDto, ['pushUrl', 'remark'] as const))
) {
    @ApiProperty({ description: '短信应用主键', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '短信应用主键必须是整数' })
    @Min(1, { message: '短信应用主键必须大于0' })
    keyId: number
}

/** 分页查询客户短信应用入参：POST /app/column。 */
export class ListSmsAppDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSmsAppDto, ['userKeyId', 'appId', 'appAlias', 'status', 'type'] as const))
) {}

/** 获取客户短信应用下拉选项入参：POST /app/select。 */
export class SelectSmsAppDto extends PickType(Schema.TbSmsAppDto, ['userKeyId'] as const) {}

/** 响应：POST /app/create、POST /app/update、POST /app/select（新增客户短信应用；更新客户短信应用；获取客户短信应用下拉选项）。 */
export class SmsAppResponseDto extends OmitType(Schema.TbSmsAppDto, ['secret'] as const) {}

/** 分页查询客户短信应用响应：POST /app/column。 */
export class SmsAppPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '短信应用列表', type: [SmsAppResponseDto] })
    list: SmsAppResponseDto[]
}

/** 入参：POST /app/secret/resolve、POST /app/secret/reset（查看客户短信应用密钥；重置客户短信应用密钥）。 */
export class SmsAppSecretDto {
    @ApiProperty({ description: '短信应用主键', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '短信应用主键必须是整数' })
    @Min(1, { message: '短信应用主键必须大于0' })
    keyId: number
}

/** 响应：POST /app/secret/resolve、POST /app/secret/reset（查看客户短信应用密钥；重置客户短信应用密钥）。 */
export class SmsAppSecretResponseDto extends PickType(Schema.TbSmsAppDto, ['appId', 'secret'] as const) {}
