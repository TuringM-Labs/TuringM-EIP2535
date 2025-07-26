import initData from '../utils/initData'
import { getVaultByKey } from '../utils/getVaultByKey'

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should payout and linear unlocked successed', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'ecosystemDevelopment'
        const tokenAmount = '10'
        const paymentAmount = '0'
        const canRefundDuration = 0
        const isShareRevenue = true
        const canRefund = false
        const nonce = hre.useNonce()

        const operator = await getSignerByKey(payoutKey)
        const { vaultId } = getVaultByKey(payoutKey)

        const allocateParams = {
            vaultId,
            userAddress,
            tokenAmount,
            paymentAmount,
            isShareRevenue,
            canRefund,
            canRefundDuration,
            nonce,
        }
        const typeDataOperator = getConfig('TYPEHASH_PAYOUT_AND_LOCK')
        const reason = `test payout and linear unlock to nobody with ${tokenAmount}`
        const data = {
            vaultId,
            to: userAddress,
            amount: tokenAmount,
            reason,
            nonce
        }
        const operatorSig = await signEIP712Data('TokenUnlockerApp', typeDataOperator, data, operator)
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const scheduleIndex = await facet.getUnlockedSchedulesCount()
        const tx = await facet.payoutTokenAndLinearUnlock(allocateParams, reason, operatorSig)
        const receipt = await tx.wait()
        const schedule = await facet.getUnlockedSchedule(scheduleIndex, Date.now())

        expect(receipt)
            .to.emit(facet, "TokenPaid")
            .withArgs(vaultId, userAddress, tokenAmount, reason, nonce, operator.address)
            .to.emit(facet, "TokenAllocated")
            .withArgs(vaultId, scheduleIndex, userAddress, schedule)
        
    })
});