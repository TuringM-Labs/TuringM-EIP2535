import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should coFounders invest token successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'coFounders'
        const tokenAmount = '10'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = true

        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
    })

    step('should strategicInvestors invest token successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'strategicInvestors'
        const tokenAmount = '1099'
        const paymentAmount = '204'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
    })
});