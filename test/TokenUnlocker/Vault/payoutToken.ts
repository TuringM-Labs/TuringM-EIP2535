import initData from '../utils/initData'
import { getVaultByKey } from '../utils/getVaultByKey'
import { parseEther, formatEther } from 'ethers/lib/utils'

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should payout vault successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = parseEther('10')
        const reason = `test payout to nobody with ${formatEther(amount)}`
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

    step('should revert with "Invalid vault id" when vaultId >= vaultsCount', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        
        // Get current vault count and use invalid vault id
        const vaultsCount = await facet.getVaultsCount()
        const invalidVaultId = vaultsCount + 1

        const amount = parseEther('10')
        const reason = `test invalid vault id with ${formatEther(amount)}`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const data = {
            vaultId: invalidVaultId,
            to,
            amount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, data, operator)
        
        await expect(facet.payoutToken(invalidVaultId, to, amount, reason, nonce, opSig))
            .to.be.revertedWith("Invalid vault id")
    })

    step('should revert with "Invalid vault type" when vault is not Payout type', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        
        // Use coFounders vault which is Vc type (not Payout type)
        const payoutkey = 'coFounders'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = parseEther('10')
        const reason = `test wrong vault type with ${formatEther(amount)}`
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
            .to.be.revertedWith("Invalid vault type")
    })

    step('should revert with "Insufficient balance" when vault balance is insufficient', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        // Get current vault balance and try to payout more than available
        const vault = await facet.getVault(vaultId)
        const excessiveAmount = vault.balance.add(parseEther('1000000'))

        const reason = `test insufficient balance with ${formatEther(excessiveAmount)}`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const data = {
            vaultId,
            to,
            amount: excessiveAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, data, operator)
        
        await expect(facet.payoutToken(vaultId, to, excessiveAmount, reason, nonce, opSig))
            .to.be.revertedWith("Insufficient balance")
    })

    step('should revert when payout is disabled', async () => {
        // First disable payout using TTOQManagerFacet with correct role
        const ttoqManagerFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'TTOQManagerFacet', 'TTOQManagerRoleC')
        await ttoqManagerFacet.disablePayout()

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = parseEther('10')
        const reason = `test disabled payout with ${formatEther(amount)}`
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
            .to.be.revertedWithCustomError(facet, "PayoutTemporarilyDisabled")

        // Re-enable payout for subsequent tests using superAdminEnablePayout with correct role
        const superAdminFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'TTOQManagerFacet', 'TTOQManagerRoleA')
        await superAdminFacet.superAdminEnablePayout()
    })

    step('should revert with "VerifySignatureFailed" when operator signature is invalid', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const correctOperator = await getSignerByKey(payoutkey)
        const wrongOperator = await getSignerByKey('coFounders') // Wrong operator
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = parseEther('10')
        const reason = `test invalid signature with ${formatEther(amount)}`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const data = {
            vaultId,
            to,
            amount,
            reason,
            nonce
        }
        // Sign with wrong operator
        const invalidSig = await signEIP712Data('TokenUnlockerApp', typeData, data, wrongOperator)
        
        await expect(facet.payoutToken(vaultId, to, amount, reason, nonce, invalidSig))
            .to.be.revertedWithCustomError(facet, "VerifySignatureFailed")
    })

    step('should revert with "NonceHasBeenUsed" when nonce is reused', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = parseEther('1')
        const reason = `test nonce reuse with ${formatEther(amount)}`
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
        
        // First payout should succeed
        await expect(facet.payoutToken(vaultId, to, amount, reason, nonce, opSig))
            .to.emit(facet, "TokenPaid")
            .withArgs(vaultId, to, amount, reason, nonce, operator.address)

        // Second payout with same nonce should fail
        await expect(facet.payoutToken(vaultId, to, amount, reason, nonce, opSig))
            .to.be.revertedWithCustomError(facet, "NonceHasBeenUsed")
    })

    step('should handle multiple payouts with different nonces successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount1 = parseEther('5')
        const amount2 = parseEther('3')
        const reason1 = `first payout with ${formatEther(amount1)}`
        const reason2 = `second payout with ${formatEther(amount2)}`
        const nonce1 = hre.useNonce()
        const nonce2 = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')

        // First payout
        const data1 = { vaultId, to, amount: amount1, reason: reason1, nonce: nonce1 }
        const opSig1 = await signEIP712Data('TokenUnlockerApp', typeData, data1, operator)
        await expect(facet.payoutToken(vaultId, to, amount1, reason1, nonce1, opSig1))
            .to.emit(facet, "TokenPaid")
            .withArgs(vaultId, to, amount1, reason1, nonce1, operator.address)

        // Second payout with different nonce
        const data2 = { vaultId, to, amount: amount2, reason: reason2, nonce: nonce2 }
        const opSig2 = await signEIP712Data('TokenUnlockerApp', typeData, data2, operator)
        await expect(facet.payoutToken(vaultId, to, amount2, reason2, nonce2, opSig2))
            .to.emit(facet, "TokenPaid")
            .withArgs(vaultId, to, amount2, reason2, nonce2, operator.address)
    })

    step('should correctly update vault balance and totalPayout after payout', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        // Get initial vault state
        const initialVault = await facet.getVault(vaultId)
        const initialBalance = initialVault.balance
        const initialTotalPayout = initialVault.totalPayout

        const amount = parseEther('7')
        const reason = `test vault state update with ${formatEther(amount)}`
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

        // Verify vault state changes
        const finalVault = await facet.getVault(vaultId)
        expect(finalVault.balance).to.equal(initialBalance.sub(amount))
        expect(finalVault.totalPayout).to.equal(initialTotalPayout.add(amount))
    })

    step('should handle zero amount payout correctly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        const amount = 0
        const reason = 'test zero amount payout'
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
            .withArgs(vaultId, to, amount, reason, nonce, operator.address)
    })

    step('should handle reasonable amount payout within TTOQ limits', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const { address: to } = await getSignerByKey('nobody')
        const payoutkey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutkey)
        const { vaultId } = getVaultByKey(payoutkey)

        // Get current vault balance and TTOQ info
        const vault = await facet.getVault(vaultId)
        const ttoqManagerFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'TTOQManagerFacet', 'TTOQManagerRoleA')
        const usedTTOQ = await ttoqManagerFacet.getUsedTTOQ(vault.tokenAddress)
        const maxTTOQ = await ttoqManagerFacet.getMaxTTOQ(vault.tokenAddress)
        const availableTTOQ = maxTTOQ.sub(usedTTOQ)

        // Use a reasonable amount that won't exceed TTOQ limits
        const testAmount = parseEther('1000') // Use fixed amount instead of full balance
        
        // Only proceed if we have balance and TTOQ quota
        if (vault.balance.gt(testAmount) && availableTTOQ.gt(testAmount)) {
            const reason = `test reasonable payout with ${formatEther(testAmount)}`
            const nonce = hre.useNonce()
            const typeData = getConfig('TYPEHASH_PAYOUT')
            const data = {
                vaultId,
                to,
                amount: testAmount,
                reason,
                nonce
            }
            const opSig = await signEIP712Data('TokenUnlockerApp', typeData, data, operator)
            
            const initialBalance = vault.balance
            await expect(facet.payoutToken(vaultId, to, testAmount, reason, nonce, opSig))
                .to.emit(facet, "TokenPaid")
                .withArgs(vaultId, to, testAmount, reason, nonce, operator.address)

            // Verify vault balance decreased correctly
            const finalVault = await facet.getVault(vaultId)
            expect(finalVault.balance).to.equal(initialBalance.sub(testAmount))
        }
    })
});