import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should coFounders quitInvestRefund successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'coFounders'
        const tokenAmount = '10'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = true

        const { paymentTokenAddress, facet, tokenAllocatedArgs, tokenInvestedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const rz = await facet.getUnlockedSchedule(scheduleId, await time.latest())
        const schedule1 = rz.schedule
        const withdrawablePaymentTokenAmount1 = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        expect(schedule1.canRefund).to.equal(true)
        expect(schedule1.hasRefunded).to.equal(false)
        
        const data = {
            scheduleId,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        const tx = await facet.quitInvestRefund(scheduleId, nonce, userSig)
        await tx.wait()
        const rz2 = await facet.getUnlockedSchedule(scheduleId, await time.latest())
        const schedule2 = rz2.schedule
        const withdrawablePaymentTokenAmount2 = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)

        expect(withdrawablePaymentTokenAmount2).to.equal(withdrawablePaymentTokenAmount1.add(schedule2.paymentAmount))
        expect(schedule2.canRefund).to.equal(false)
        expect(schedule2.hasRefunded).to.equal(false)
    })
});