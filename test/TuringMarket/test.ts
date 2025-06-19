import { step, xstep } from 'mocha-steps'
import initData from './utils/initData'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(`test:${scope}`)
describe.skip(scope, () => {
    before(() => initData())

    step('a successed test', async () => {
        theDebug('successed')
    })

    xstep('skip a test', async () => {

    })
});