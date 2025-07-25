import initData from '../utils/initData'
import { getVaultByKey } from '../utils/getVaultByKey'

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should successed', async () => {
        const facetA = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)
        const operatorNew = await getAccountByKey('projectReserve')

        await expect(facetA.adminUpdateVaultOperator(vaultId, operatorNew))
            .to.emit(facetA, "VaultOperatorUpdated")
            .withArgs(vaultId, operatorNew);
        
        // payout should failed with old operator
        const { address: to } = await getSignerByKey('nobody')
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
        const facetB = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')

        await expect(facetB.payoutToken(vaultId, to, amount, reason, nonce, opSig))
            .to.be.revertedWithCustomError(
                facetB,
                "VerifySignatureFailed"
        );
        
        const opSigNew = await signEIP712Data('TokenUnlockerApp', typeData, data, await ethers.getSigner(operatorNew))

        await expect(facetB.payoutToken(vaultId, to, amount, reason, nonce, opSigNew))
            .to.emit(facetB, "TokenPaid")
            .withArgs(vaultId, to, amount, reason, nonce, operatorNew);
    })
});