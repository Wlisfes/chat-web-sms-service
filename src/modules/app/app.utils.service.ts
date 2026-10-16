import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto'
import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { InjectRepository, DataBaseService, EntityManager, QueryRunner, Repository } from '@wlisfes/chat-web-base-schema/database'
import { isNotEmpty } from '@wlisfes/chat-web-base-schema/utils'
import { ConfigService } from '@nestjs/config'
import * as constants from '@/modules/app/app.constants'
import * as SmsAppDto from '@/modules/app/dto/app.dto'
import * as Schema from '@wlisfes/chat-web-base-schema'

@Injectable()
export class SmsAppUtilsService {
    private readonly RANDOM_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    constructor(
        @InjectRepository(Schema.TbSmsApp) private readonly repository: Repository<Schema.TbSmsApp>,
        private readonly database: DataBaseService,
        private readonly configService: ConfigService
    ) {}

    /**获取短信应用创建锁。*/
    public async acquireCreateLock(queryRunner: QueryRunner): Promise<boolean> {
        const [result] = (await queryRunner.query('SELECT GET_LOCK(?, ?) AS acquired', [constants.SMS_APP_CREATE_LOCK, 5])) as Array<{
            acquired: number | string | null
        }>
        return Number(result?.acquired) === 1
    }

    /**释放短信应用创建锁。*/
    public async releaseCreateLock(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('SELECT RELEASE_LOCK(?) AS released', [constants.SMS_APP_CREATE_LOCK])
    }

    /**查询必需的短信应用。*/
    public async findRequired(keyId: number, manager?: EntityManager): Promise<Schema.TbSmsApp> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsApp)
        const app = await this.database.builder(repository, qb => {
            qb.where('t.keyId = :keyId', { keyId })
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getOne()
        })
        if (!app) {
            throw new NotFoundException('短信应用不存在')
        }
        return app
    }

    /**查询包含密钥密文的短信应用；传入事务管理器时加写锁。*/
    public async findSecretRequired(keyId: number, manager?: EntityManager): Promise<Schema.TbSmsApp> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsApp)
        const app = await this.database.builder(repository, qb => {
            qb.addSelect('t.secret').where('t.keyId = :keyId', { keyId })
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getOne()
        })
        if (!app) {
            throw new NotFoundException('短信应用不存在')
        }
        return app
    }

    /**查询客户名下的短信应用。*/
    public async findForUser(userKeyId: number, appId: string, manager?: EntityManager): Promise<Schema.TbSmsApp> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsApp)
        const app = await this.database.builder(repository, qb => {
            qb.where('t.userKeyId = :userKeyId AND t.appId = :appId', { userKeyId, appId })
            if (isNotEmpty(manager)) {
                qb.setLock('pessimistic_write')
            }
            return qb.getOne()
        })
        if (!app) {
            throw new NotFoundException('客户短信应用不存在')
        }
        return app
    }

    /**生成指定长度的大小写字母与数字随机串。*/
    public generateRandomString(length: number): string {
        return Array.from({ length }, () => this.RANDOM_CHARACTERS[randomInt(this.RANDOM_CHARACTERS.length)]).join('')
    }

    /**生成64位短信应用密钥明文。*/
    public generateSecret(): string {
        return this.generateRandomString(constants.SMS_APP_SECRET_LENGTH)
    }

    /**生成唯一的16位短信应用 ID。*/
    public async generateAppId(manager?: EntityManager): Promise<string> {
        const repository = (manager ?? this.repository.manager).getRepository(Schema.TbSmsApp)
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const appId = this.generateRandomString(constants.SMS_APP_ID_LENGTH)
            const exists = await this.database.builder(repository, qb => qb.where('t.appId = :appId', { appId }).getExists())
            if (!exists) {
                return appId
            }
        }
        throw new ConflictException('短信应用ID生成失败，请重试')
    }

    /**锁定客户已有短信应用并返回应用名称列表。*/
    public async lockUserApps(manager: EntityManager, userKeyId: number): Promise<Schema.TbSmsApp[]> {
        const repository = manager.getRepository(Schema.TbSmsApp)
        return this.database.builder(repository, qb => {
            return qb
                .select(['t.keyId', 't.appName'])
                .where('t.userKeyId = :userKeyId', { userKeyId })
                .setLock('pessimistic_write')
                .getMany()
        })
    }

    /**生成客户维度自增的应用名称：SMS-1、SMS-2……*/
    public generateAppName(apps: Array<Pick<Schema.TbSmsApp, 'appName'>>): string {
        const pattern = new RegExp(`^${constants.SMS_APP_NAME_PREFIX}(\\d+)$`)
        const maxSequence = apps.reduce((max, app) => {
            const matched = pattern.exec(app.appName ?? '')
            return matched ? Math.max(max, Number(matched[1])) : max
        }, 0)
        return `${constants.SMS_APP_NAME_PREFIX}${maxSequence + 1}`
    }

    /**生成创建人工号与应用类型维度自增的应用别名：CSK + 工号 + 4位类型 + 4位分段序号，A001-Z999 后进入 AA01-ZZ99。*/
    public async generateAppAlias(manager: EntityManager, number: string, type: Schema.TbSmsAppType): Promise<string> {
        const userNumber = number?.trim()
        if (!isNotEmpty(userNumber) || !/^[A-Za-z0-9]+$/.test(userNumber)) {
            throw new BadRequestException('当前登录账号缺少有效工号，无法生成应用别名')
        }
        const prefix = `${constants.SMS_APP_ALIAS_PREFIX}${userNumber}${type}`
        const apps = await this.database.builder(manager.getRepository(Schema.TbSmsApp), qb => {
            return qb
                .select(['t.keyId', 't.appAlias'])
                .where('t.type = :type', { type })
                .andWhere('t.appAlias LIKE :prefix', { prefix: `${prefix}%` })
                .getMany()
        })
        const maxSequence = apps.reduce((max, app) => Math.max(max, this.parseAppAliasSequence(app.appAlias, prefix)), 0)
        return `${prefix}${this.formatAppAliasSequence(maxSequence + 1)}`
    }

    /**把应用别名尾部4位序号转换为连续序号；不符合当前规则的历史别名返回0。*/
    public parseAppAliasSequence(appAlias: string, prefix: string): number {
        const code = appAlias?.startsWith(prefix) ? appAlias.slice(prefix.length) : ''
        const single = /^([A-Z])(\d{3})$/.exec(code)
        if (single && Number(single[2]) > 0) {
            return (single[1].charCodeAt(0) - 65) * constants.SMS_APP_ALIAS_SINGLE_MAX + Number(single[2])
        }
        const double = /^([A-Z])([A-Z])(\d{2})$/.exec(code)
        if (double && Number(double[3]) > 0) {
            const group = (double[1].charCodeAt(0) - 65) * 26 + double[2].charCodeAt(0) - 65
            return constants.SMS_APP_ALIAS_SINGLE_CAPACITY + group * constants.SMS_APP_ALIAS_DOUBLE_MAX + Number(double[3])
        }
        return 0
    }

    /**把连续序号格式化为4位应用别名序号：A001-Z999，之后 AA01-ZZ99。*/
    public formatAppAliasSequence(sequence: number): string {
        if (!Number.isInteger(sequence) || sequence < 1 || sequence > constants.SMS_APP_ALIAS_CAPACITY) {
            throw new ConflictException('当前工号该类型短信应用别名序号已用完')
        }
        if (sequence <= constants.SMS_APP_ALIAS_SINGLE_CAPACITY) {
            const index = sequence - 1
            const letter = String.fromCharCode(65 + Math.floor(index / constants.SMS_APP_ALIAS_SINGLE_MAX))
            return `${letter}${String((index % constants.SMS_APP_ALIAS_SINGLE_MAX) + 1).padStart(3, '0')}`
        }
        const index = sequence - constants.SMS_APP_ALIAS_SINGLE_CAPACITY - 1
        const group = Math.floor(index / constants.SMS_APP_ALIAS_DOUBLE_MAX)
        const letters = String.fromCharCode(65 + Math.floor(group / 26), 65 + (group % 26))
        return `${letters}${String((index % constants.SMS_APP_ALIAS_DOUBLE_MAX) + 1).padStart(2, '0')}`
    }

    /**读取 Nacos 中的 server.secret 作为应用密钥加密主密钥，并派生为 AES-256 所需的 32 字节密钥。*/
    private resolveSecretKey(): Buffer {
        const secretKey = this.configService.get<string>(constants.SMS_SERVER_SECRET_CONFIG_KEY)
        if (typeof secretKey !== 'string' || secretKey.trim().length < 32) {
            throw new InternalServerErrorException(`SMS 配置 ${constants.SMS_SERVER_SECRET_CONFIG_KEY} 缺失或少于32位`)
        }
        return createHash('sha256').update(secretKey.trim()).digest()
    }

    /**使用 AES-256-GCM 加密短信应用密钥，返回可入库的密文。*/
    public encryptSecret(secret: string): string {
        const iv = randomBytes(12)
        const cipher = createCipheriv('aes-256-gcm', this.resolveSecretKey(), iv)
        const cipherText = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
        return [constants.SMS_SECRET_CIPHER_VERSION, iv, cipher.getAuthTag(), cipherText]
            .map(item => (Buffer.isBuffer(item) ? item.toString('base64url') : item))
            .join(':')
    }

    /**解密数据库中的短信应用密钥密文，供后续签名校验等内部场景使用。*/
    public decryptSecret(cipherSecret: string): string {
        const [version, iv, authTag, cipherText] = cipherSecret.split(':')
        if (version !== constants.SMS_SECRET_CIPHER_VERSION || !iv || !authTag || !cipherText) {
            throw new InternalServerErrorException('短信应用密钥密文格式错误')
        }
        const decipher = createDecipheriv('aes-256-gcm', this.resolveSecretKey(), Buffer.from(iv, 'base64url'))
        decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
        return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]).toString('utf8')
    }

    /**移除不允许通过接口返回的应用密钥。*/
    public sanitize(app: Schema.TbSmsApp): SmsAppDto.SmsAppResponseDto {
        const { secret: _secret, ...safeApp } = app
        return safeApp
    }
}
