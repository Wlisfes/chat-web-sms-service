const test = require('node:test')
const assert = require('node:assert/strict')
const { plainToInstance } = require('class-transformer')
const { validate } = require('class-validator')
const { InitSmsQuoteDraftDto, ListSmsQuoteDto } = require('../dist/modules/quote/dto/quote.dto')

test('报价初始化强制多选国家使用数组和 POST body DTO', async () => {
    const valid = plainToInstance(InitSmsQuoteDraftDto, { userKeyId: 5181000, appId: 'SMSDEMO000001', countryKeyIds: [1, 2] })
    assert.deepEqual(await validate(valid), [])
    const invalid = plainToInstance(InitSmsQuoteDraftDto, { userKeyId: 5181000, appId: 'SMSDEMO000001', countryKeyIds: 1 })
    assert.ok((await validate(invalid)).length > 0)
    const quoteList = plainToInstance(ListSmsQuoteDto, { statuses: ['effective', 'pending'], countryKeyIds: [1, 2] })
    assert.deepEqual(await validate(quoteList), [])
})

test('正式报价状态支持已失效筛选', async () => {
    const quoteList = plainToInstance(ListSmsQuoteDto, { statuses: ['effective', 'pending', 'expired', 'deleted'] })
    assert.deepEqual(await validate(quoteList), [])
    const tooMany = plainToInstance(ListSmsQuoteDto, { statuses: ['effective', 'pending', 'expired', 'deleted', 'effective'] })
    assert.ok((await validate(tooMany)).length > 0)
})

test('正式报价状态按生效、失效时间实时计算', () => {
    const { SmsQuoteUtilsService } = require('../dist/modules/quote/quote.utils.service')
    const service = new SmsQuoteUtilsService({}, {})
    const now = new Date('2026-10-05T12:00:00+08:00')
    const at = value => new Date(value)
    assert.equal(
        service.resolveQuoteStatus({ status: 'pending', effectiveTime: at('2026-10-05T11:00:00+08:00'), expiryTime: null }, now),
        'effective'
    )
    assert.equal(
        service.resolveQuoteStatus({ status: 'effective', effectiveTime: at('2026-10-06T00:00:00+08:00'), expiryTime: null }, now),
        'pending'
    )
    assert.equal(
        service.resolveQuoteStatus(
            { status: 'effective', effectiveTime: at('2026-10-01T00:00:00+08:00'), expiryTime: at('2026-10-05T12:00:00+08:00') },
            now
        ),
        'expired'
    )
    assert.equal(
        service.resolveQuoteStatus({ status: 'deleted', effectiveTime: at('2026-10-01T00:00:00+08:00'), expiryTime: null }, now),
        'deleted'
    )
})

test('报价草稿变更状态：无现行报价为新增，价格相同为未变，否则为增长或降低', () => {
    const { SmsQuoteUtilsService } = require('../dist/modules/quote/quote.utils.service')
    const service = new SmsQuoteUtilsService({}, {})
    assert.equal(service.fetchChangeStatus(320000, undefined), 'NEW')
    assert.equal(service.fetchChangeStatus(320000, 320000), 'CURRENT')
    assert.equal(service.fetchChangeStatus(320000, '320000'), 'CURRENT')
    assert.equal(service.fetchChangeStatus(320001, 320000), 'INCREASE')
    assert.equal(service.fetchChangeStatus(316406, 316400), 'INCREASE')
    assert.equal(service.fetchChangeStatus(7500, 7505), 'DECREASE')
})
