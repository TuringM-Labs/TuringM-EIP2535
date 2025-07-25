import initData from '../utils/initData'
import { doStake } from './utils/doStake'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should stake successed', async () => {
        await doStake()
    })
});