import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

const SMS_MESSAGE_TYPES = ['MRKT', 'NTFY', 'SOTP'] as const

/** 真实提交短信入参：POST /dispatch/submit。编码、条数和消息 ID 由服务端生成。 */
export class SubmitCommitDto {
    @ApiProperty({ description: 'CRM 客户主键', example: 10241010 })
    @Type(() => Number)
    @IsInt({ message: '客户主键必须是整数' })
    @Min(1, { message: '客户主键必须大于0' })
    userKeyId: number

    @ApiProperty({ description: '客户名称', example: '青萍科技股份有限公司' })
    @IsString({ message: '客户名称必须是字符串' })
    @IsNotEmpty({ message: '客户名称必填' })
    @MaxLength(128, { message: '客户名称长度不能超过128位' })
    userName: string

    @ApiProperty({ description: '短信应用主键', example: 1002009 })
    @Type(() => Number)
    @IsInt({ message: '短信应用主键必须是整数' })
    @Min(1, { message: '短信应用主键必须大于0' })
    appKeyId: number

    @ApiProperty({ description: '短信应用ID', example: 'NwlP460poQnWw1F9' })
    @IsString({ message: '短信应用ID必须是字符串' })
    @IsNotEmpty({ message: '短信应用ID必填' })
    @MaxLength(32, { message: '短信应用ID长度不能超过32位' })
    appId: string

    @ApiProperty({ description: '短信类型', enum: SMS_MESSAGE_TYPES, example: 'NTFY' })
    @IsIn(SMS_MESSAGE_TYPES, { message: '短信类型格式错误' })
    type: (typeof SMS_MESSAGE_TYPES)[number]

    @ApiProperty({ description: '国家/地区主键', example: 1077 })
    @Type(() => Number)
    @IsInt({ message: '国家/地区主键必须是整数' })
    @Min(1, { message: '国家/地区主键必须大于0' })
    countryKeyId: number

    @ApiProperty({ description: '移动国家代码', example: '460' })
    @IsString({ message: '移动国家代码必须是字符串' })
    @IsNotEmpty({ message: '移动国家代码必填' })
    @MaxLength(4, { message: '移动国家代码长度不能超过4位' })
    mcc: string

    @ApiProperty({ description: '接收号码，含国际区号，不带 + 号', example: '8613800138000' })
    @IsString({ message: '接收号码必须是字符串' })
    @IsNotEmpty({ message: '接收号码必填' })
    @MaxLength(20, { message: '接收号码长度不能超过20位' })
    toNumber: string

    @ApiProperty({ description: '短信内容', example: '您的验证码是 123456' })
    @IsString({ message: '短信内容必须是字符串' })
    @IsNotEmpty({ message: '短信内容必填' })
    @MaxLength(1000, { message: '短信内容长度不能超过1000位' })
    content: string

    @ApiProperty({ description: '客户售价，报价币种金额，放大百万倍存储', example: 108200 })
    @Type(() => Number)
    @IsInt({ message: '客户售价必须是整数' })
    @Min(0, { message: '客户售价不能小于0' })
    price: number

    @ApiProperty({ description: '短信任务主键', required: false, example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: '短信任务主键必须是整数' })
    @Min(1, { message: '短信任务主键必须大于0' })
    taskId?: number

    @ApiProperty({ description: '短信任务名称', required: false, example: '验证码通知' })
    @IsOptional()
    @IsString({ message: '短信任务名称必须是字符串' })
    @MaxLength(128, { message: '短信任务名称长度不能超过128位' })
    taskName?: string

    @ApiProperty({ description: '短信模板ID', required: false, example: 'TPL1001' })
    @IsOptional()
    @IsString({ message: '短信模板ID必须是字符串' })
    @MaxLength(64, { message: '短信模板ID长度不能超过64位' })
    templateId?: string
}

/** 提交短信响应：真实提交和模拟提交共用。 */
export class SubmitResponseDto {
    @ApiProperty({ description: '提交结果', example: 'success' })
    message: string

    @ApiProperty({ description: '已进入提交队列的短信' })
    payload: Record<string, unknown>
}
