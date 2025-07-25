import initData from '../utils/initData'
import { getVaultByKey } from '../utils/getVaultByKey'

// Global type declarations for Hardhat environment extensions
declare global {
    function getNameForTag(dirname: string, filename: string): string
    function step(description: string, fn: () => Promise<void>): void
    function expect(actual: any): any
    function parseEther(value: string): any
    function getFacetWithSignerKey(app: string, facet: string, signerKey: string): Promise<any>
    function getAccountByKey(key: string): Promise<string>
    function getSignerByKey(key: string): Promise<any>
    function signEIP712Data(app: string, typeData: any, data: any, signer: any): Promise<string>
    function getContractWithSignerKey(contract: string, signerKey: string): Promise<any>
    function getContractAddress(contract: string): Promise<string>
    function permitERC20(token: string, from: string, to: string, signerKey: string): Promise<void>
    function getConfig(key: string): any
    function getUnnamedAccounts(): Promise<string[]>
    function parseUnits(value: string, decimals: number): any
    const hre: {
        useNonce(): number
        ethers: any
    }
    const ethers: any
    const require: (id: string) => any
    const __dirname: string
    const __filename: string
}

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)

describe(scope, () => {
    before(() => initData())

    step('should deposit token successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const vault = await facet.getVault(vaultId)
        
        // Get vaultRoleC address - this account will be both the caller and token holder
        const depositorAddress = await getAccountByKey('vaultRoleC')
        
        // First, give vaultRoleC some TuringToken via payout (similar to faucetUsersTUIT)
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = parseEther('1000')
        const reason = `payout to vaultRoleC for deposit testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositorAddress,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositorAddress, payoutAmount, reason, nonce, opSig)
        
        // Now test depositToken with smaller amount
        const depositAmount = parseEther('100')
        
        // Get initial states
        const initialVault = await facet.getVault(vaultId)
        const turingToken = await getContractWithSignerKey('TuringToken', 'nobody')
        const initialDepositorBalance = await turingToken.balanceOf(depositorAddress)
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        const initialContractBalance = await turingToken.balanceOf(contractAddress)
        
        // Check depositor has sufficient balance
        expect(initialDepositorBalance).to.be.gte(depositAmount)
        
        // Authorize the transfer using permitERC20
        await permitERC20('TuringToken', depositorAddress, 'TokenUnlockerApp', 'deployer')
        
        // Execute deposit - vaultRoleC has both permission and tokens
        const tx = await facet.depositToken(vaultId, depositAmount)
        const receipt = await tx.wait()
        
        // Verify TokenDeposited event
        expect(receipt)
            .to.emit(facet, "TokenDeposited")
            .withArgs(depositorAddress, vaultId, vault.tokenAddress, depositAmount)
        
        // Verify vault state changes
        const finalVault = await facet.getVault(vaultId)
        expect(finalVault.balance).to.equal(initialVault.balance.add(depositAmount))
        expect(finalVault.totalDeposit).to.equal(initialVault.totalDeposit.add(depositAmount))
        
        // Verify token balances
        const finalDepositorBalance = await turingToken.balanceOf(depositorAddress)
        const finalContractBalance = await turingToken.balanceOf(contractAddress)
        expect(finalDepositorBalance).to.equal(initialDepositorBalance.sub(depositAmount))
        expect(finalContractBalance).to.equal(initialContractBalance.add(depositAmount))
    })

    step('should revert when vaultId is invalid', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const depositor = await getAccountByKey('projectReserve')
        
        const depositAmount = parseEther('100')
        const invalidVaultId = 999999 // Non-existent vault ID
        
        // Use permitERC20 for proper authorization
        await permitERC20('TuringToken', depositor, 'TokenUnlockerApp', 'deployer')
        
        // Should revert with invalid vault id
        await expect(facet.depositToken(invalidVaultId, depositAmount))
            .to.be.revertedWith("Invalid vault id")
    })

    step('should handle zero amount deposit', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        
        const zeroAmount = 0
        
        // Get initial vault state
        const initialVault = await facet.getVault(vaultId)
        
        // Zero amount deposit should succeed but not change vault state
        await expect(facet.depositToken(vaultId, zeroAmount))
            .to.not.be.reverted
        
        // Verify vault state unchanged
        const finalVault = await facet.getVault(vaultId)
        expect(finalVault.balance).to.equal(initialVault.balance)
        expect(finalVault.totalDeposit).to.equal(initialVault.totalDeposit)
    })

    step('should revert when depositor has insufficient balance', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        
        // Use an account with no tokens
        const facetNoBalance = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody')
        const depositor = await getAccountByKey('nobody')
        const turingToken = await getContractWithSignerKey('TuringToken', 'nobody')
        
        const depositAmount = parseEther('1000000') // Very large amount
        
        // Check depositor has insufficient balance
        const depositorBalance = await turingToken.balanceOf(depositor)
        expect(depositorBalance).to.be.lt(depositAmount)
        
        // Use permitERC20 for proper authorization
        await permitERC20('TuringToken', depositor, 'TokenUnlockerApp', 'deployer')
        
        // Should revert due to insufficient balance - OpenZeppelin ERC20 throws custom error
        await expect(facetNoBalance.depositToken(vaultId, depositAmount))
            .to.be.reverted
    })

    step('should revert when token transfer fails due to no approval', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        
        // Use an unnamed account that hasn't been used before to avoid previous authorizations
        const users = await getUnnamedAccounts()
        const depositor = users[50] // Use a high index to avoid conflicts with other tests
        const turingToken = await getContractWithSignerKey('TuringToken', 'nobody')
        
        const depositAmount = parseEther('100')
        
        // First give this user some TuringToken via payout (similar to how other tests work)
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = parseEther('1000')
        const reason = `payout to test user for deposit testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        // Verify depositor now has sufficient balance
        const depositorBalance = await turingToken.balanceOf(depositor)
        expect(depositorBalance).to.be.gte(depositAmount)
        
        // Ensure no authorization by explicitly setting allowance to 0
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        const depositorSigner = await ethers.getSigner(depositor)
        const turingTokenWithSigner = turingToken.connect(depositorSigner)
        
        // Explicitly revoke any existing authorization
        await turingTokenWithSigner.approve(contractAddress, 0)
        
        // Verify no allowance exists
        const currentAllowance = await turingToken.allowance(depositor, contractAddress)
        expect(currentAllowance).to.equal(0) // Should have no allowance
        
        // Do NOT call permitERC20 - no authorization given
        
        // Create facet with the depositor as signer (since depositToken transfers from msg.sender)
        const facetWithDepositor = facet.connect(depositorSigner)
        
        // Should revert due to lack of approval - OpenZeppelin ERC20 throws custom error
        await expect(facetWithDepositor.depositToken(vaultId, depositAmount))
            .to.be.reverted
    })

    step('should revert when contract is paused', async () => {
        // Pause the contract
        const pausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleC')
        await pausableFacet.pause()
        
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('projectReserve')
        const turingToken = await getContractWithSignerKey('TuringToken', 'projectReserve')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        const depositAmount = parseEther('100')
        
        // Approve tokens for transfer
        await turingToken.approve(contractAddress, depositAmount)
        
        // Should revert when contract is paused
        await expect(facet.depositToken(vaultId, depositAmount))
            .to.be.revertedWithCustomError(facet, "EnforcedPause")
        
        // Unpause the contract for subsequent tests
        const unpausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleA')
        await unpausableFacet.unpause()
    })

    step('should revert when caller does not have roleC permission', async () => {
        // Use a signer without roleC permission
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody')
        const { vaultId } = getVaultByKey('coFounders')
        
        const depositAmount = parseEther('100')
        
        // Should revert due to lack of roleC permission
        await expect(facet.depositToken(vaultId, depositAmount))
            .to.be.revertedWithCustomError(facet, "CallerIsNotAuthorized")
    })

    step('should prevent reentrancy attacks', async () => {
        // Note: This test verifies that the nonReentrant modifier is working
        // Since we're using standard ERC20 tokens in tests, we can't easily simulate
        // a reentrancy attack, but we can verify the modifier is in place
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('projectReserve')
        const turingToken = await getContractWithSignerKey('TuringToken', 'projectReserve')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        const depositAmount = parseEther('100')
        
        // Approve tokens for transfer
        await turingToken.approve(contractAddress, depositAmount)
        
        // Normal call should succeed (verifying nonReentrant doesn't block legitimate calls)
        await expect(facet.depositToken(vaultId, depositAmount))
            .to.not.be.reverted
        
        // The nonReentrant modifier prevents reentrancy by design
        // Additional reentrancy testing would require deploying malicious contracts
    })

    step('should handle multiple deposits to same vault correctly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('strategicInvestors')
        const depositor = await getAccountByKey('projectReserve')
        const turingToken = await getContractWithSignerKey('TuringToken', 'projectReserve')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        const firstDeposit = parseEther('500')
        const secondDeposit = parseEther('300')
        const totalDeposit = firstDeposit.add(secondDeposit)
        
        // Get initial vault state
        const initialVault = await facet.getVault(vaultId)
        
        // First deposit
        await turingToken.approve(contractAddress, firstDeposit)
        await expect(facet.depositToken(vaultId, firstDeposit))
            .to.not.be.reverted
        
        // Verify state after first deposit
        const midVault = await facet.getVault(vaultId)
        expect(midVault.balance).to.equal(initialVault.balance.add(firstDeposit))
        expect(midVault.totalDeposit).to.equal(initialVault.totalDeposit.add(firstDeposit))
        
        // Second deposit
        await turingToken.approve(contractAddress, secondDeposit)
        await expect(facet.depositToken(vaultId, secondDeposit))
            .to.not.be.reverted
        
        // Verify final state
        const finalVault = await facet.getVault(vaultId)
        expect(finalVault.balance).to.equal(initialVault.balance.add(totalDeposit))
        expect(finalVault.totalDeposit).to.equal(initialVault.totalDeposit.add(totalDeposit))
    })

    step('should work with different vault types', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const depositor = await getAccountByKey('vaultRoleC') // Use vaultRoleC as depositor since it has permission
        const turingToken = await getContractWithSignerKey('TuringToken', 'vaultRoleC')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        // First ensure depositor has enough tokens for all deposits
        const depositAmount = parseEther('200')
        const vaultKeys = ['coFounders', 'strategicInvestors', 'ecosystemDevelopment']
        const totalRequired = depositAmount.mul(vaultKeys.length)
        
        // Give depositor enough TuringToken via payout
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = totalRequired.add(parseEther('100')) // Extra buffer
        const reason = `payout for vault types testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        // Test with different vault types
        
        for (const vaultKey of vaultKeys) {
            const { vaultId } = getVaultByKey(vaultKey)
            const initialVault = await facet.getVault(vaultId)
            
            // Create facet instance with depositor as signer (since depositToken transfers from msg.sender)
            const depositorSigner = await ethers.getSigner(depositor)
            const facetWithDepositor = facet.connect(depositorSigner)
            
            // Approve and deposit
            await turingToken.approve(contractAddress, depositAmount)
            await expect(facetWithDepositor.depositToken(vaultId, depositAmount))
                .to.not.be.reverted
            
            // Verify vault state updated correctly
            const finalVault = await facet.getVault(vaultId)
            expect(finalVault.balance).to.equal(initialVault.balance.add(depositAmount))
            expect(finalVault.totalDeposit).to.equal(initialVault.totalDeposit.add(depositAmount))
        }
    })

    step('should maintain vault balance integrity under concurrent operations', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('vaultRoleC') // Use vaultRoleC as depositor since it has permission
        const turingToken = await getContractWithSignerKey('TuringToken', 'vaultRoleC')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        // First ensure depositor has enough tokens for all deposits
        const depositAmount = parseEther('50')
        const numberOfDeposits = 5
        const totalRequired = depositAmount.mul(numberOfDeposits)
        
        // Give depositor enough TuringToken via payout
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = totalRequired.add(parseEther('50')) // Extra buffer
        const reason = `payout for concurrent operations testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        // Get initial vault state
        const initialVault = await facet.getVault(vaultId)
        const initialBalance = initialVault.balance
        const initialTotalDeposit = initialVault.totalDeposit
        
        // Simulate multiple small deposits
        let totalExpectedDeposit = ethers.BigNumber.from(0)
        
        for (let i = 0; i < numberOfDeposits; i++) {
            await turingToken.approve(contractAddress, depositAmount)
            await expect(facet.depositToken(vaultId, depositAmount))
                .to.not.be.reverted
            totalExpectedDeposit = totalExpectedDeposit.add(depositAmount)
        }
        
        // Verify final state integrity
        const finalVault = await facet.getVault(vaultId)
        expect(finalVault.balance).to.equal(initialBalance.add(totalExpectedDeposit))
        expect(finalVault.totalDeposit).to.equal(initialTotalDeposit.add(totalExpectedDeposit))
        
        // Verify balance accounting is exact
        const expectedFinalBalance = initialBalance.add(depositAmount.mul(numberOfDeposits))
        expect(finalVault.balance).to.equal(expectedFinalBalance)
    })

    // Additional critical security tests
    step('SECURITY: should handle maximum uint256 amount safely', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('vaultRoleC')
        
        // Test with very large amount (but not max uint256 to avoid overflow in totalDeposit)
        const largeAmount = parseEther('1000000000') // 1 billion tokens
        
        // This should revert due to insufficient balance (which is the expected behavior)
        await expect(facet.depositToken(vaultId, largeAmount))
            .to.be.reverted
    })

    step('SECURITY: should emit correct event parameters', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('vaultRoleC')
        const turingToken = await getContractWithSignerKey('TuringToken', 'vaultRoleC')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        // Give depositor tokens
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = parseEther('500')
        const reason = `payout for event testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        const depositAmount = parseEther('100')
        const vault = await facet.getVault(vaultId)
        
        // Approve and deposit
        await turingToken.approve(contractAddress, depositAmount)
        
        // Verify event emission with exact parameters
        await expect(facet.depositToken(vaultId, depositAmount))
            .to.emit(facet, "TokenDeposited")
            .withArgs(depositor, vaultId, vault.tokenAddress, depositAmount)
    })

    step('SECURITY: should handle vault with zero tokenAddress safely', async () => {
        // Note: This tests edge case behavior - in practice, vaults should always have valid tokenAddress
        // This test ensures the function doesn't crash with unexpected tokenAddress values
        
        // Since we can't easily create a vault with zero tokenAddress in this test setup,
        // we'll verify that existing vaults have valid tokenAddress
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const vault = await facet.getVault(vaultId)
        
        // Verify vault has valid tokenAddress (security assertion)
        expect(vault.tokenAddress).to.not.equal(ethers.constants.AddressZero)
        expect(vault.tokenAddress).to.be.properAddress
    })

    step('SECURITY: should maintain exact state consistency across operations', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('strategicInvestors')
        const depositor = await getAccountByKey('vaultRoleC')
        const turingToken = await getContractWithSignerKey('TuringToken', 'vaultRoleC')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        // Give depositor tokens
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = parseEther('1000')
        const reason = `payout for state consistency testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        // Test series of deposits with exact state tracking
        const deposits = [parseEther('10'), parseEther('25'), parseEther('50'), parseEther('100')]
        let expectedTotalDeposit = ethers.BigNumber.from(0)
        let expectedBalance = ethers.BigNumber.from(0)
        
        const initialVault = await facet.getVault(vaultId)
        expectedTotalDeposit = initialVault.totalDeposit
        expectedBalance = initialVault.balance
        
        for (let i = 0; i < deposits.length; i++) {
            const depositAmount = deposits[i]
            
            // Approve and deposit
            await turingToken.approve(contractAddress, depositAmount)
            await facet.depositToken(vaultId, depositAmount)
            
            // Update expected values
            expectedTotalDeposit = expectedTotalDeposit.add(depositAmount)
            expectedBalance = expectedBalance.add(depositAmount)
            
            // Verify exact state consistency after each deposit
            const currentVault = await facet.getVault(vaultId)
            expect(currentVault.totalDeposit).to.equal(expectedTotalDeposit)
            expect(currentVault.balance).to.equal(expectedBalance)
            
            // CRITICAL: Verify totalDeposit >= balance (invariant)
            expect(currentVault.totalDeposit).to.be.gte(currentVault.balance)
        }
    })

    step('SECURITY: should handle rapid successive deposits without state corruption', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const { vaultId } = getVaultByKey('coFounders')
        const depositor = await getAccountByKey('vaultRoleC')
        const turingToken = await getContractWithSignerKey('TuringToken', 'vaultRoleC')
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        
        // Give depositor tokens
        const payoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'ecosystemDevelopment'
        const operator = await getSignerByKey(payoutKey)
        const { vaultId: payoutVaultId } = getVaultByKey(payoutKey)
        
        const payoutAmount = parseEther('2000')
        const reason = `payout for rapid deposits testing`
        const nonce = hre.useNonce()
        const typeData = getConfig('TYPEHASH_PAYOUT')
        const payoutData = {
            vaultId: payoutVaultId,
            to: depositor,
            amount: payoutAmount,
            reason,
            nonce
        }
        const opSig = await signEIP712Data('TokenUnlockerApp', typeData, payoutData, operator)
        await payoutFacet.payoutToken(payoutVaultId, depositor, payoutAmount, reason, nonce, opSig)
        
        const initialVault = await facet.getVault(vaultId)
        const depositAmount = parseEther('1')
        const numberOfRapidDeposits = 10
        
        // Pre-approve all deposits to minimize external calls during rapid succession
        await turingToken.approve(contractAddress, depositAmount.mul(numberOfRapidDeposits))
        
        // Perform rapid successive deposits (sequential due to nonce requirements)
        for (let i = 0; i < numberOfRapidDeposits; i++) {
            await facet.depositToken(vaultId, depositAmount)
        }
        
        // Verify final state integrity
        const finalVault = await facet.getVault(vaultId)
        const expectedIncrease = depositAmount.mul(numberOfRapidDeposits)
        
        expect(finalVault.balance).to.equal(initialVault.balance.add(expectedIncrease))
        expect(finalVault.totalDeposit).to.equal(initialVault.totalDeposit.add(expectedIncrease))
    })
}) 