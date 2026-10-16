import { ApiProperty, IntersectionType, PartialType, PickType } from '@nestjs/swagger'
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsNotEmpty } from 'class-validator'
import { IsOptional, IsString, IsUUID, MaxLength, Matches, Min } from 'class-validator'
import { PageResponseDataDto } from '@wlisfes/chat-web-base-schema/decorator'
import { PageDto } from '@wlisfes/chat-web-base-schema/utils'
import { Type } from 'class-transformer'
import * as Schema from '@wlisfes/chat-web-base-schema'

/** 初始化短信报价草稿批次入参：POST /quote/draft/init。 */
export class InitSmsQuoteDraftDto {
    @ApiProperty({ description: 'CRM 客户主键', example: 10241000 })
    @Type(() => Number)
    @IsInt({ message: '客户主键必须是整数' })
    @Min(1, { message: '客户主键必须大于0' })
    userKeyId: number

    @ApiProperty({ description: '短信应用ID', example: 'SMS9F2A8B31' })
    @IsString({ message: '短信应用ID必须是字符串' })
    @IsNotEmpty({ message: '短信应用ID必填' })
    @MaxLength(32, { message: '短信应用ID长度不能超过32位' })
    appId: string

    @ApiProperty({ description: '国家/地区主键集合', type: [Number], example: [1, 2, 3] })
    @IsArray({ message: '国家/地区主键集合必须是数组' })
    @ArrayNotEmpty({ message: '国家/地区主键集合不能为空' })
    @ArrayMaxSize(200, { message: '单次最多选择200个国家/地区' })
    @Type(() => Number)
    @IsInt({ each: true, message: '国家/地区主键必须是整数' })
    @Min(1, { each: true, message: '国家/地区主键必须大于0' })
    countryKeyIds: number[]
}

/** 分页查询短信报价草稿入参：POST /quote/draft/column。 */
export class ListSmsQuoteDraftDto extends PageDto {
    @ApiProperty({ description: '草稿批次ID', format: 'uuid', example: 'a56b8b36-1d86-4cf2-9c98-63f4134c83d0' })
    @IsUUID('4', { message: '草稿批次ID格式错误' })
    draftBatchId: string
}

/** 更新短信报价草稿入参：POST /quote/draft/update。 */
export class UpdateSmsQuoteDraftDto {
    @ApiProperty({ description: '报价草稿主键', example: 1 })
    @Type(() => Number)
    @IsInt({ message: '报价草稿主键必须是整数' })
    @Min(1, { message: '报价草稿主键必须大于0' })
    keyId: number

    @ApiProperty({ description: '上行短信售价USD（放大百万倍存储）', example: 30000 })
    @Type(() => Number)
    @IsInt({ message: '上行短信售价必须是整数' })
    @Min(0, { message: '上行短信售价不能小于0' })
    upUsd: number

    @ApiProperty({ description: '下行短信售价USD（放大百万倍存储）', example: 50000 })
    @Type(() => Number)
    @IsInt({ message: '下行短信售价必须是整数' })
    @Min(0, { message: '下行短信售价不能小于0' })
    downUsd: number

    @ApiProperty({ description: '生效时间', required: false, example: '2026-08-24 00:00:00' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/, { message: '生效时间格式错误' })
    effectiveTime?: string

    @ApiProperty({ description: '失效时间', required: false, example: '2026-12-31 23:59:59' })
    @IsOptional()
    @Matches(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/, { message: '失效时间格式错误' })
    expiryTime?: string

    @ApiProperty({ description: '备注', required: false, example: '客户专属报价' })
    @IsOptional()
    @IsString({ message: '备注必须是字符串' })
    @MaxLength(1024, { message: '备注长度不能超过1024位' })
    remark?: string
}

/** 批量删除短信报价草稿入参：POST /quote/draft/delete。 */
export class DeleteSmsQuoteDraftDto {
    @ApiProperty({ description: '报价草稿主键集合', type: [Number], example: [1, 2] })
    @IsArray({ message: '报价草稿主键集合必须是数组' })
    @ArrayNotEmpty({ message: '报价草稿主键集合不能为空' })
    @ArrayMaxSize(200, { message: '单次最多删除200条报价草稿' })
    @Type(() => Number)
    @IsInt({ each: true, message: '报价草稿主键必须是整数' })
    @Min(1, { each: true, message: '报价草稿主键必须大于0' })
    keyIds: number[]
}

/** 入参：POST /quote/preview、POST /quote/publish（预览短信报价草稿批次；发布短信报价草稿批次）。 */
export class SmsQuoteDraftBatchDto {
    @ApiProperty({ description: '草稿批次ID', format: 'uuid', example: 'a56b8b36-1d86-4cf2-9c98-63f4134c83d0' })
    @IsUUID('4', { message: '草稿批次ID格式错误' })
    draftBatchId: string
}

/** 分页查询正式短信报价入参：POST /quote/column。 */
export class ListSmsQuoteDto extends IntersectionType(
    PageDto,
    PartialType(PickType(Schema.TbSmsQuoteDto, ['userKeyId', 'userAlias', 'appId', 'appAlias', 'code', 'mcc'] as const))
) {
    @ApiProperty({
        description: '报价状态集合',
        enum: Schema.TbSmsQuoteStatus,
        isArray: true,
        required: false,
        example: [Schema.TbSmsQuoteStatus.EFFECTIVE, Schema.TbSmsQuoteStatus.PENDING]
    })
    @IsOptional()
    @IsArray({ message: '报价状态集合必须是数组' })
    @ArrayMaxSize(4, { message: '报价状态最多选择4项' })
    @IsEnum(Schema.TbSmsQuoteStatus, { each: true, message: '报价状态格式错误' })
    statuses?: Schema.TbSmsQuoteStatus[]

    @ApiProperty({ description: '国家/地区主键集合', type: [Number], required: false, example: [1, 2, 3] })
    @IsOptional()
    @IsArray({ message: '国家/地区主键集合必须是数组' })
    @ArrayMaxSize(200, { message: '国家/地区主键最多选择200项' })
    @Type(() => Number)
    @IsInt({ each: true, message: '国家/地区主键必须是整数' })
    @Min(1, { each: true, message: '国家/地区主键必须大于0' })
    countryKeyIds?: number[]
}

/** 初始化短信报价草稿批次响应：POST /quote/draft/init。 */
export class InitSmsQuoteDraftResponseDto {
    @ApiProperty({ description: '草稿批次 ID', format: 'uuid', example: 'a56b8b36-1d86-4cf2-9c98-63f4134c83d0' })
    draftBatchId: string

    @ApiProperty({ description: '生成的草稿数量', example: 3 })
    total: number
}

/** SmsQuoteDraftPageResponseDto.list 字段结构；分页查询短信报价草稿响应：POST /quote/draft/column。 */
export class SmsQuoteDraftListItemResponseDto extends Schema.TbSmsQuoteDraftDto {
    @ApiProperty({ description: '上行价格变更状态', enum: ['unchanged', 'addition'], example: 'addition' })
    upStatus: 'unchanged' | 'addition'

    @ApiProperty({ description: '下行价格变更状态', enum: ['unchanged', 'addition'], example: 'addition' })
    downStatus: 'unchanged' | 'addition'
}

/** 分页查询短信报价草稿响应：POST /quote/draft/column。 */
export class SmsQuoteDraftPageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '报价草稿列表', type: [SmsQuoteDraftListItemResponseDto] })
    list: SmsQuoteDraftListItemResponseDto[]
}

/** 预览短信报价草稿批次响应：POST /quote/preview。 */
export class SmsQuotePreviewResponseDto {
    @ApiProperty({ description: '草稿批次 ID', format: 'uuid', example: 'a56b8b36-1d86-4cf2-9c98-63f4134c83d0' })
    draftBatchId: string

    @ApiProperty({ description: 'CRM 客户主键', example: 10241000 })
    userKeyId: number

    @ApiProperty({ description: '短信应用 ID', example: 'SMS9F2A8B31' })
    appId: string

    @ApiProperty({ description: '报价币种', example: 'CNY' })
    currency: string

    @ApiProperty({ description: '报价数量', example: 3 })
    total: number

    @ApiProperty({ description: '报价草稿列表', type: [Schema.TbSmsQuoteDraftDto] })
    list: Schema.TbSmsQuoteDraftDto[]
}

/** 发布短信报价草稿批次响应：POST /quote/publish。 */
export class PublishSmsQuoteResponseDto {
    @ApiProperty({ description: '草稿批次 ID', format: 'uuid', example: 'a56b8b36-1d86-4cf2-9c98-63f4134c83d0' })
    draftBatchId: string

    @ApiProperty({ description: '已发布报价数量', example: 3 })
    published: number
}

/** SmsQuoteListItemResponseDto.userOptions 字段结构；分页查询正式短信报价响应：POST /quote/column。 */
export class UserOptionResponseDto {
    @ApiProperty({ description: '客户主键', example: 10241000 })
    keyId: number

    @ApiProperty({ description: '客户名称', example: '华东测试客户' })
    name: string

    @ApiProperty({ description: '客户别名', required: false, example: '华东客户' })
    alias?: string
}

/** SmsQuotePageResponseDto.list 字段结构；分页查询正式短信报价响应：POST /quote/column。 */
export class SmsQuoteListItemResponseDto extends Schema.TbSmsQuoteDto {
    @ApiProperty({ description: '客户下拉选项', type: UserOptionResponseDto, required: false })
    userOptions?: UserOptionResponseDto
}

/** 分页查询正式短信报价响应：POST /quote/column。 */
export class SmsQuotePageResponseDto extends PageResponseDataDto {
    @ApiProperty({ description: '正式报价列表', type: [SmsQuoteListItemResponseDto] })
    list: SmsQuoteListItemResponseDto[]
}
