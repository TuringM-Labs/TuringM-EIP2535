import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should claimUnlockedTokens successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'coFounders'
        const tokenAmount = '10000'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        const { tokenAddress, facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const randomSeconds = _.random(0, oneYearSeconds)
        const newTimestamp = Number(startTime) + oneYearSeconds + randomSeconds
        const rz = await facet.getUnlockedSchedule(scheduleId, newTimestamp)
        const canClaimAmount = (rz.canUnlockedAmount.sub(rz.schedule.claimedAmount))
        const amount = parseEther(parseInt(_.random(1, formatEther(canClaimAmount))).toString())
        const data = {
            scheduleId,
            amount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        await time.increaseTo(newTimestamp);
        const tx = await facet.claimUnlockedTokens(scheduleId, amount, nonce, userSig)
        const receipt = await tx.wait()

        expect(receipt)
            .to.emit(facet, "TokenClaimed")
            .to.emit(facet, 'Transfer')
            .withArgs(userAddress, tokenAddress, amount)

        const rz2 = await facet.getUnlockedSchedule(scheduleId, newTimestamp)
        const canClaimAmount2 = rz2.canUnlockedAmount.sub(rz2.schedule.claimedAmount)

        expect(canClaimAmount2).to.equal(canClaimAmount.sub(amount))
    })
});