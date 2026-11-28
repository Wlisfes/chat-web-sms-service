import { ApiProperty, PartialType, PickType, IntersectionType } from '@nestjs/swagger'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { IsInt, IsOptional, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 获取短信模板静态枚举响应：GET /template/enums。 */
export class SmsTemplateEnumsResponseDto extends EnumsResponseDto({
    typeOptions: { description: '短信类型选项', example: Schema.TbSmsAppTypeDefinition.options },
    auditOptions: { description: '短信模板审核状态选项', example: Schema.TbSmsTemplateAuditDefinition.options }
}) {}

/** 当前登录客户新增短信模板入参：POST /template/mine/create。客户主键从网关身份解析。 */
export class CreateMineSmsTemplateDto extends PickType(Schema.TbSmsTemplateDto, ['appKeyId', 'templateName', 'content', 'htmlContent'] as const) {}

/** 当前登录客户更新短信模板入参：POST /template/mine/update。已通过的模板不能修改。 */
export class UpdateMineSmsTemplateDto extends PickType(Schema.TbSmsTemplateDto, ['keyId', 'templateName', 'content', 'htmlContent'] as const) {}

/** 当前登录客户分页查询短信模板入参：POST /template/mine/column。 */
export class ListMineSmsTemplateDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSmsTemplateDto, ['appKeyId', 'templateId', 'templateName', 'type', 'audit'] as const))
) {}

/** 当前登录客户查询可用模板入参：POST /template/mine/select。只返回已通过审核的模板。 */
export class SelectMineSmsTemplateDto {
    @ApiProperty({ description: 'SMS 短信应用主键', required: false, example: 1002009 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '短信应用主键必须是整数' })
    @Min(1, { message: '短信应用主键必须大于0' })
    appKeyId?: number
}

/** 当前登录客户删除短信模板入参：POST /template/mine/delete。 */
export class DeleteMineSmsTemplateDto {
    @ApiProperty({ description: '短信模板主键', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '短信模板主键必须是整数' })
    @Min(1, { message: '短信模板主键必须大于0' })
    keyId: number
}

/** 短信模板响应。 */
export class SmsTemplateResponseDto extends Schema.TbSmsTemplateDto {}

/** 分页查询短信模板响应：POST /template/mine/column。 */
export class SmsTemplatePageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '短信模板列表', type: [SmsTemplateResponseDto] })
    list: SmsTemplateResponseDto[]
}
