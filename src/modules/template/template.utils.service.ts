import { randomInt } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository, DataBaseService, EntityManager, QueryRunner, Repository } from '@wlisfes/chat-web-base-schema/database'
import { isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import * as constants from '@/modules/template/template.constants'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsTemplateUtilsService {
    private readonly RANDOM_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    constructor(
        @InjectRepository(Schema.TbSmsTemplate) private readonly repository: Repository<Schema.TbSmsTemplate>,
        private readonly database: DataBaseService
    ) {}

    /** 获取短信模板创建锁。 */
    public async acquireCreateLock(queryRunner: QueryRunner): Promise<boolean> {
        const [result] = (await queryRunner.query('SELECT GET_LOCK(?, ?) AS acquired', [constants.SMS_TEMPLATE_CREATE_LOCK, 5])) as Array<{
            acquired: number | string | null
        }>
        return Number(result?.acquired) === 1
    }

    /** 释放短信模板创建锁。 */
    public async releaseCreateLock(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [constants.SMS_TEMPLATE_CREATE_LOCK])
    }

    /** 查询必需的短信模板；传入事务管理器时加写锁。 */
    public async findRequired(keyId: number, manager?: EntityManager): Promise<Schema.TbSmsTemplate> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsTemplate)
        const template = await this.database.builder(repository, qb => {
            qb.where('t.keyId = :keyId', { keyId })
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getOne()
        })
        if (!template) {
            throw new NotFoundException('短信模板不存在')
        }
        return template
    }

    /** 生成不重复的 16 位模板 ID。 */
    public async generateTemplateId(manager: EntityManager): Promise<string> {
        const repository = manager.getRepository(Schema.TbSmsTemplate)
        for (let attempt = 0; attempt < 8; attempt += 1) {
            const templateId = this.randomString(constants.SMS_TEMPLATE_ID_LENGTH)
            const exists = await repository.exists({ where: { templateId } })
            if (!exists) return templateId
        }
        throw new ConflictException('短信模板ID生成失败，请稍后重试')
    }

    private randomString(length: number): string {
        return Array.from({ length }, () => this.RANDOM_CHARACTERS[randomInt(this.RANDOM_CHARACTERS.length)]).join('')
    }
}
