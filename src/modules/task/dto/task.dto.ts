import { ApiProperty, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { EnumsResponseDto, PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { IsInt, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 获取短信任务静态枚举响应：GET /task/enums。 */
export class SmsTaskEnumsResponseDto extends EnumsResponseDto({
    statusOptions: { description: '短信任务状态选项', example: Schema.TbSmsTaskStatusDefinition.options },
    sourceOptions: { description: '短信任务来源选项', example: Schema.TbSmsTaskSourceDefinition.options },
    typeOptions: { description: '短信类型选项', example: Schema.TbSmsAppTypeDefinition.options }
}) {}

/** 新增短信任务入参：POST /task/create。客户、应用快照和类型由服务端写入。 */
export class CreateSmsTaskDto extends IntersectionType(
    PickType(Schema.TbSmsTaskDto, ['userKeyId', 'appKeyId', 'taskName', 'source'] as const),
    PartialType(PickType(Schema.TbSmsTaskDto, ['content', 'templateId', 'planTime', 'fileKey', 'fileName', 'remark'] as const))
) {}

/** 更新短信任务入参：POST /task/update。只允许修改待发送任务，改发送时间时版本号加 1。 */
export class UpdateSmsTaskDto extends IntersectionType(
    PickType(Schema.TbSmsTaskDto, ['keyId', 'version'] as const),
    PartialType(PickType(Schema.TbSmsTaskDto, ['taskName', 'content', 'templateId', 'planTime', 'fileKey', 'fileName', 'remark'] as const))
) {}

/** 分页查询短信任务入参：POST /task/column。 */
export class ListSmsTaskDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSmsTaskDto, ['userKeyId', 'appKeyId', 'status', 'source', 'type', 'taskName'] as const))
) {}

/** 查询短信任务详情入参：POST /task/resolve。 */
export class SmsTaskKeyDto {
    @ApiProperty({ description: '短信任务主键', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '短信任务主键必须是整数' })
    @Min(1, { message: '短信任务主键必须大于0' })
    keyId: number
}

/** 删除短信任务入参：POST /task/delete。版本号用于避免删除已被改期的任务。 */
export class DeleteSmsTaskDto extends SmsTaskKeyDto {
    @ApiProperty({ description: '发送计划版本', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '版本号必须是整数' })
    @Min(1, { message: '版本号必须大于0' })
    version: number
}

/** 短信任务响应。 */
export class SmsTaskResponseDto extends Schema.TbSmsTaskDto {}

/** 分页查询短信任务响应：POST /task/column。 */
export class SmsTaskPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '短信任务列表', type: [SmsTaskResponseDto] })
    list: SmsTaskResponseDto[]
}
