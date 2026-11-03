const test = require('node:test')
const assert = require('node:assert/strict')
const { ConflictException, BadRequestException } = require('@nestjs/common')
const { SmsTaskUtilsService, isPlanTimeDue, parsePlanTime } = require('../dist/modules/task/task.utils.service')

const future = new Date(Date.now() + 60 * 60 * 1000)
const past = new Date(Date.now() - 60 * 1000)

test('空的计划时间视为已经到点', () => {
    assert.equal(isPlanTimeDue(null, new Date()), true)
    assert.equal(isPlanTimeDue(undefined, new Date()), true)
})

test('未来计划时间未到点，过去计划时间已到点', () => {
    assert.equal(isPlanTimeDue(future, new Date()), false)
    assert.equal(isPlanTimeDue(past, new Date()), true)
})

test('未到点的待发送任务可以改期，并拒绝早于当前时间的新时间', () => {
    const utils = new SmsTaskUtilsService()
    const task = { status: 'pending', version: 1, planTime: future }
    assert.doesNotThrow(() => utils.assertPending(task))
    assert.doesNotThrow(() => utils.assertVersion(task, 1))
    const next = utils.assertPlanTimeChange(task, new Date(Date.now() + 2 * 60 * 60 * 1000))
    assert.ok(next.getTime() > Date.now())
    assert.throws(() => utils.assertPlanTimeChange(task, past), BadRequestException)
})

test('已到发送时间或版本不一致时不能改期', () => {
    const utils = new SmsTaskUtilsService()
    assert.throws(() => utils.assertPlanTimeChange({ planTime: null }, future), ConflictException)
    assert.throws(() => utils.assertVersion({ version: 2 }, 1), ConflictException)
    assert.throws(() => utils.assertPending({ status: 'sending' }), ConflictException)
})

test('计划时间字符串可以解析', () => {
    const date = parsePlanTime('2026-11-03 18:00:00')
    assert.equal(Number.isNaN(date.getTime()), false)
})
