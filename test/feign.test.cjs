const test = require('node:test')
const assert = require('node:assert/strict')
const { FeignService } = require('../dist/feign/feign.service')

test('SMS Feign 按客户主键统计短信应用数量', async () => {
    const calls = []
    const repository = {
        async count(options) {
            calls.push(options)
            return 3
        }
    }
    const service = new FeignService(repository)
    assert.deepEqual(await service.httpBaseSmsAppCountResolver('Bearer service-token', { userKeyId: 5181000 }), {
        userKeyId: 5181000,
        total: 3
    })
    assert.deepEqual(calls, [{ where: { userKeyId: 5181000 } }])
})

test('SMS Feign 按短信应用主键批量获取摘要，去重且不查询密钥', async () => {
    const calls = []
    const repository = {
        async find(options) {
            calls.push(options)
            return [{ keyId: 1001, appName: '登录验证码' }]
        }
    }
    const service = new FeignService(repository)
    assert.deepEqual(await service.httpBaseSmsColumnAppResolver('Bearer service-token', { keyIds: [1001, 1001] }), [
        { keyId: 1001, appName: '登录验证码' }
    ])
    assert.equal(calls[0].select.secret, undefined)
    assert.deepEqual(calls[0].where.keyId.value, [1001])
    assert.deepEqual(await service.httpBaseSmsColumnAppResolver('Bearer service-token', { keyIds: [] }), [])
})
