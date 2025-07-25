import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'coFounders'
        const tokenAmount = '10'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = true

        for (let i = 0; i < 12; i++){
            await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        }
        const rz = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'superAdmin')
        const {schedules, count} = await facet.getUserUnlockedSchedulesList(userAddress, 1, 10)
        expect(count).to.equal(13)
        expect(schedules[0].paymentAmount).to.equal(rz.paymentAmount)
        expect(schedules[0].allocationAmount).to.equal(rz.tokenAmount)
    })

});