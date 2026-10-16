const test = require('node:test')
const assert = require('node:assert/strict')
const { SmsAppService } = require('../dist/modules/app/app.service')
const { SmsAppUtilsService } = require('../dist/modules/app/app.utils.service')

function createSmsAppTestContext({ appCount = 4, saveError, aliases = [], smsAppLimit = 5, userAlias = 'CSK1233R7MP' } = {}) {
    const calls = []
    const repository = { manager: {} }
    let selected = []
    const queryBuilder = {
        select(fields) {
            selected = fields
            return this
        },
        where() {
            return this
        },
        setLock() {
            return this
        },
        andWhere() {
            return this
        },
        async getMany() {
            if (selected.includes('t.appAlias')) {
                calls.push(['aliases'])
                return aliases.map((appAlias, keyId) => ({ keyId, appAlias }))
            }
            calls.push(['count'])
            return Array.from({ length: appCount }, (_, keyId) => ({ keyId, appName: `SMS-${keyId + 1}` }))
        }
    }
    const manager = {
        getRepository() {
            return repository
        },
        create(_entity, values) {
            calls.push(['create', values])
            return { keyId: 1, ...values }
        },
        async save(app) {
            calls.push(['save', app])
            if (saveError) {
                throw saveError
            }
            return app
        }
    }
    const queryRunner = {
        isTransactionActive: true,
        manager,
        async query(sql, parameters) {
            if (sql.includes('GET_LOCK')) {
                calls.push(['acquire-lock', sql, parameters])
                return [{ acquired: 1 }]
            }
            calls.push(['release-lock', sql, parameters])
            return [{ released: 1 }]
        },
        async commitTransaction() {
            calls.push(['commit'])
            this.isTransactionActive = false
        },
        async rollbackTransaction() {
            calls.push(['rollback'])
            this.isTransactionActive = false
        },
        async release() {
            calls.push(['release'])
        }
    }
    const database = {
        async transaction() {
            calls.push(['transaction'])
            return queryRunner
        },
        async builder(_repository, callback) {
            return callback(queryBuilder)
        }
    }
    const crmClient = {
        async httpBaseCrmUserResolver(authorization, input) {
            assert.equal(authorization, 'Bearer service-token')
            calls.push(['user', input])
            return { keyId: 5181000, name: '华东客户', alias: userAlias }
        },
        async httpBaseCrmUserConfigResolver(authorization, input) {
            assert.equal(authorization, 'Bearer service-token')
            calls.push(['config', input])
            return { userKeyId: input.userKeyId, smsAppLimit }
        }
    }
    const configValues = { 'server.secret': '0123456789abcdef0123456789abcdef', 'gateway.feign.service_token': 'service-token' }
    const configService = { get: key => configValues[key] }
    const smsAppUtilsService = new SmsAppUtilsService(repository, database, configService)
    smsAppUtilsService.generateAppId = async transactionManager => {
        assert.equal(transactionManager, manager)
        calls.push(['generateAppId'])
        return 'Ab12Cd34Ef56Gh78'
    }
    return {
        calls,
        service: new SmsAppService(repository, database, smsAppUtilsService, crmClient, configService),
        smsAppUtilsService
    }
}

test('创建短信应用在同一连接内获取命名锁并于提交后释放', async () => {
    const { calls, service } = createSmsAppTestContext()
    const app = await service.httpBaseSmsCreateApp(
        { uid: '30001', number: '1233' },
        {
            userKeyId: 5181000,
            type: 'SOTP'
        }
    )

    const methods = calls.map(([method]) => method)
    assert.ok(methods.indexOf('config') < methods.indexOf('acquire-lock'))
    assert.ok(methods.indexOf('acquire-lock') < methods.indexOf('count'))
    assert.ok(methods.indexOf('count') < methods.indexOf('save'))
    assert.ok(methods.indexOf('save') < methods.indexOf('commit'))
    assert.ok(methods.indexOf('commit') < methods.indexOf('release-lock'))
    assert.ok(methods.indexOf('release-lock') < methods.indexOf('release'))
    assert.deepEqual(calls.find(([method]) => method === 'acquire-lock').slice(2), [['sms:app:create', 5]])
    assert.deepEqual(calls.find(([method]) => method === 'release-lock').slice(2), [['sms:app:create']])
    assert.equal(app.appId, 'Ab12Cd34Ef56Gh78')
    assert.equal(app.appName, 'SMS-5')
    assert.equal(app.appAlias, 'CSK1233SOTPA001')
    assert.equal(app.secret, undefined)
    const saved = calls.find(([method]) => method === 'create')[1]
    assert.match(saved.secret, /^v1:[\w-]+:[\w-]+:[\w-]+$/)
    assert.equal(saved.ownerUserUid, undefined)
})

test('短信应用密钥使用 AES-256-GCM 加密存储并可解密', () => {
    const { smsAppUtilsService } = createSmsAppTestContext()
    const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const first = smsAppUtilsService.encryptSecret(secret)
    const second = smsAppUtilsService.encryptSecret(secret)
    assert.notEqual(first, second)
    assert.ok(first.length <= 255)
    assert.equal(smsAppUtilsService.decryptSecret(first), secret)
    const [version, iv, authTag, cipherText] = first.split(':')
    const tampered = [version, iv, authTag, cipherText.slice(0, -2) + (cipherText.endsWith('AA') ? 'BB' : 'AA')].join(':')
    assert.throws(() => smsAppUtilsService.decryptSecret(tampered))
})

test('创建短信应用异常时先回滚事务再释放命名锁和连接', async () => {
    const writeError = new Error('短信应用写入失败')
    const { calls, service } = createSmsAppTestContext({ appCount: 0, saveError: writeError })

    await assert.rejects(
        () => service.httpBaseSmsCreateApp({ uid: '30001', number: '1233' }, { userKeyId: 5181000, type: 'SOTP' }),
        writeError
    )

    const methods = calls.map(([method]) => method)
    assert.ok(methods.indexOf('acquire-lock') < methods.indexOf('count'))
    assert.ok(methods.indexOf('count') < methods.indexOf('save'))
    assert.ok(methods.indexOf('save') < methods.indexOf('rollback'))
    assert.ok(methods.indexOf('rollback') < methods.indexOf('release-lock'))
    assert.ok(methods.indexOf('release-lock') < methods.indexOf('release'))
    assert.equal(methods.includes('commit'), false)
})

test('短信应用别名按创建人工号和应用类型自增，名称按客户自增', async () => {
    const { service } = createSmsAppTestContext({
        appCount: 2,
        aliases: ['CSK1233MRKTA001', 'CSK1233MRKTA007', 'CSK1233MRKT007', 'CSK1233R7MPMRKT099']
    })
    const app = await service.httpBaseSmsCreateApp({ uid: '30001', number: '1233' }, { userKeyId: 5181000, type: 'MRKT' })
    assert.equal(app.appName, 'SMS-3')
    assert.equal(app.appAlias, 'CSK1233MRKTA008')
})

test('短信应用别名按 A001-Z999、AA01-ZZ99 顺序增长', async () => {
    const { smsAppUtilsService } = createSmsAppTestContext({ aliases: ['CSK1233SOTPA999'] })
    const manager = { getRepository() {} }
    assert.equal(await smsAppUtilsService.generateAppAlias(manager, '1233', 'SOTP'), 'CSK1233SOTPB001')
    const cases = [
        ['CSK1233SOTPZ999', 'CSK1233SOTPAA01'],
        ['CSK1233SOTPAA99', 'CSK1233SOTPAB01'],
        ['CSK1233SOTPAZ99', 'CSK1233SOTPBA01']
    ]
    for (const [current, next] of cases) {
        const context = createSmsAppTestContext({ aliases: [current] })
        assert.equal(await context.smsAppUtilsService.generateAppAlias(manager, '1233', 'SOTP'), next)
    }
    const full = createSmsAppTestContext({ aliases: ['CSK1233SOTPZZ99'] }).smsAppUtilsService
    await assert.rejects(full.generateAppAlias(manager, '1233', 'SOTP'), /序号已用完/)
    assert.equal(smsAppUtilsService.formatAppAliasSequence(92898), 'ZZ99')
})

test('短信应用ID固定16位，密钥固定64位', async () => {
    const { smsAppUtilsService } = createSmsAppTestContext()
    assert.match(smsAppUtilsService.generateRandomString(16), /^[A-Za-z0-9]{16}$/)
    assert.match(smsAppUtilsService.generateSecret(), /^[A-Za-z0-9]{64}$/)
})

test('登录账号缺少工号时拒绝创建短信应用', async () => {
    const { service } = createSmsAppTestContext({ appCount: 0 })
    await assert.rejects(() => service.httpBaseSmsCreateApp({ uid: '30001', number: '' }, { userKeyId: 5181000, type: 'SOTP' }), /工号/)
})

test('短信应用静态枚举返回 Schema 中的类型和状态选项', async () => {
    const Schema = require('@wlisfes/chat-web-base-schema')
    const { service } = createSmsAppTestContext()
    const result = await service.httpBaseSmsAppEnums()
    assert.deepEqual(result, {
        typeOptions: Schema.TbSmsAppTypeDefinition.options,
        statusOptions: Schema.TbSmsAppStatusDefinition.options
    })
})

test('查看短信应用密钥时读取密文并返回明文', async () => {
    const { service, smsAppUtilsService } = createSmsAppTestContext()
    const secret = smsAppUtilsService.generateSecret()
    const encrypted = smsAppUtilsService.encryptSecret(secret)
    smsAppUtilsService.findSecretRequired = async keyId => ({ keyId, appId: 'Ab12Cd34Ef56Gh78', secret: encrypted })
    service.logger = { log() {} }
    const result = await service.httpBaseSmsAppSecretResolver({ uid: '30001' }, { keyId: 1 })
    assert.deepEqual(result, { appId: 'Ab12Cd34Ef56Gh78', secret })
})

test('重置短信应用密钥时加密保存并只返回本次明文', async () => {
    const { service, smsAppUtilsService } = createSmsAppTestContext()
    const saved = []
    const app = { keyId: 1, appId: 'Ab12Cd34Ef56Gh78', secret: 'old', modifyBy: '10001' }
    const manager = {
        merge(_entity, target, values) {
            Object.assign(target, values)
        },
        async save(value) {
            saved.push({ ...value })
            return value
        }
    }
    service.repository.manager.transaction = callback => callback(manager)
    smsAppUtilsService.findSecretRequired = async (keyId, transactionManager) => {
        assert.equal(keyId, 1)
        assert.equal(transactionManager, manager)
        return app
    }
    service.logger = { log() {} }
    const result = await service.httpBaseSmsResetAppSecret({ uid: '30001' }, { keyId: 1 })
    assert.equal(result.appId, 'Ab12Cd34Ef56Gh78')
    assert.match(result.secret, /^[A-Za-z0-9]{64}$/)
    assert.match(saved[0].secret, /^v1:[\w-]+:[\w-]+:[\w-]+$/)
    assert.equal(saved[0].modifyBy, '30001')
    assert.equal(smsAppUtilsService.decryptSecret(saved[0].secret), result.secret)
})

test('短信应用数量达到客户配置上限时拒绝创建并回滚', async () => {
    const { calls, service } = createSmsAppTestContext({ appCount: 5, smsAppLimit: 5 })
    await assert.rejects(
        () => service.httpBaseSmsCreateApp({ uid: '30001', number: '1233' }, { userKeyId: 5181000, type: 'SOTP' }),
        /最多创建5个短信应用/
    )
    const methods = calls.map(([method]) => method)
    assert.equal(methods.includes('save'), false)
    assert.ok(methods.includes('rollback'))
})
