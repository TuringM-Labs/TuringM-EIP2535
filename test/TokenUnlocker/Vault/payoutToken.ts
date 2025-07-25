import initData from '../utils/initData'
import { getVaultByKey } from '../utils/getVaultByKey'

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should payout vault successed', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = 10
        const reason = `test payout to nobody with ${amount}`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const data = {
            vaultId,
            to,
            amount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, data, operator)
        await expect(facet.payoutToken(vaultId, to, amount, reason, nonce, opSig))
            .to.emit(facet, "TokenPaid")
            .withArgs(vaultId, to, amount, reason, nonce, operator.address);
    })
});