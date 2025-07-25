import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'strategicInvestors'
        const tokenAmount = '1099'
        const paymentAmount = '204'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const stableCoinContract = await getContractWithSignerKey('USDTMock', 'nobody')

        const amount = parseUnits(paymentAmount, 6)
        const from = await getContractAddress('TokenUnlockerApp')
        const to = await getAccountByKey('projectReserve')

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.emit(stableCoinContract, 'Transfer')
            .withArgs(from, to, amount)
    })
});