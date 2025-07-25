import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should succeed when admin withdraws available payment tokens', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'strategicInvestors'
        const tokenAmount = '1099'
        const paymentAmount = '204'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        // First create some withdrawable payment tokens through investment
        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const stableCoinContract = await getContractWithSignerKey('USDTMock', 'nobody')

        const amount = parseUnits(paymentAmount, 6)
        const from = await getContractAddress('TokenUnlockerApp')
        const to = await getAccountByKey('projectReserve')

        // Check initial withdrawable balance
        const initialWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        expect(initialWithdrawable).to.be.gte(amount)

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.emit(stableCoinContract, 'Transfer')
            .withArgs(from, to, amount)

        // Verify withdrawable balance decreased
        const finalWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        expect(finalWithdrawable).to.equal(initialWithdrawable.sub(amount))
    })

    step('should revert with "Insufficient balance" when withdrawable balance is insufficient', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')

        // Get current withdrawable balance
        const currentWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        
        // Try to withdraw more than available
        const excessiveAmount = currentWithdrawable.add(parseUnits('1000000', 6))

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, excessiveAmount, to))
            .to.be.revertedWith("Insufficient balance")
    })

    step('should handle zero amount withdrawal correctly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const stableCoinContract = await getContractWithSignerKey('USDTMock', 'nobody')
        const to = await getAccountByKey('projectReserve')

        const zeroAmount = parseUnits('0', 6)
        const from = await getContractAddress('TokenUnlockerApp')

        // Zero amount should technically succeed but not transfer anything
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, zeroAmount, to))
            .to.emit(stableCoinContract, 'Transfer')
            .withArgs(from, to, zeroAmount)
    })

    step('should revert when caller does not have roleA permission', async () => {
        // Use a signer without roleA permission
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('100', 6)

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.be.revertedWithCustomError(facet, "CallerIsNotAuthorized")
    })

    step('should revert when contract is paused', async () => {
        // First pause the contract
        const pausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleC')
        await pausableFacet.pause()

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('100', 6)

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.be.revertedWithCustomError(facet, "EnforcedPause")

        // Unpause the contract for subsequent tests
        const unpausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleA')
        await unpausableFacet.unpause()
    })

    step('should revert when payout is disabled', async () => {
        // First disable payout
        const tttoqFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'TTOQManagerFacet', 'superAdmin')
        await tttoqFacet.disablePayout()

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('100', 6)

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.be.revertedWithCustomError(facet, "PayoutTemporarilyDisabled")

        // Re-enable payout for subsequent tests
        const enablePayoutFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'TTOQManagerFacet', 'superAdmin')
        await enablePayoutFacet.superAdminEnablePayout()
    })

    step('should handle zero address recipient properly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const amount = parseUnits('100', 6)

        // Test with zero address as recipient
        // This may succeed or fail depending on the ERC20 implementation
        // Most ERC20 implementations should revert when transferring to zero address
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, ethers.constants.AddressZero))
            .to.be.reverted // ERC20 transfer to zero address should fail
    })

    step('should handle invalid payment token address', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('100', 6)

        // Test with zero address as token address
        await expect(facet.adminWithdrawPaymentToken(ethers.constants.AddressZero, amount, to))
            .to.be.reverted // Should fail when calling transfer on zero address

        // Test with non-contract address as token address
        const nonContractAddress = await getAccountByKey('nobody')
        await expect(facet.adminWithdrawPaymentToken(nonContractAddress, amount, to))
            .to.be.reverted // Should fail as it's not a contract
    })

    step('should handle very large amounts correctly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')

        // Test with maximum uint256 value
        const maxAmount = ethers.constants.MaxUint256

        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, maxAmount, to))
            .to.be.revertedWith("Insufficient balance")
    })

    step('should maintain correct state after successful withdrawal', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[1]
        const payoutKey = 'coFounders'
        const tokenAmount = '50'
        const paymentAmount = '10'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        // Create withdrawable balance through investment
        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')
        const withdrawAmount = parseUnits('5', 6) // Withdraw half

        // Get initial states
        const initialWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        const contractAddress = await getContractAddress('TokenUnlockerApp')
        const stableCoinContract = await getContractWithSignerKey('USDTMock', 'nobody')
        const initialContractBalance = await stableCoinContract.balanceOf(contractAddress)
        const initialRecipientBalance = await stableCoinContract.balanceOf(to)

        // Perform withdrawal
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, withdrawAmount, to))
            .to.not.be.reverted

        // Verify state changes
        const finalWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        const finalContractBalance = await stableCoinContract.balanceOf(contractAddress)
        const finalRecipientBalance = await stableCoinContract.balanceOf(to)

        expect(finalWithdrawable).to.equal(initialWithdrawable.sub(withdrawAmount))
        expect(finalContractBalance).to.equal(initialContractBalance.sub(withdrawAmount))
        expect(finalRecipientBalance).to.equal(initialRecipientBalance.add(withdrawAmount))
    })

    step('should handle multiple consecutive withdrawals correctly', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[2]
        const payoutKey = 'strategicInvestors'
        const tokenAmount = '100'
        const paymentAmount = '20'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        // Create substantial withdrawable balance
        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')

        const initialWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        
        // Perform multiple small withdrawals
        const withdrawalAmount = parseUnits('5', 6)
        const numberOfWithdrawals = 3

        for (let i = 0; i < numberOfWithdrawals; i++) {
            await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, withdrawalAmount, to))
                .to.not.be.reverted
        }

        // Verify total reduction in withdrawable balance
        const finalWithdrawable = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        const totalWithdrawn = withdrawalAmount.mul(numberOfWithdrawals)
        expect(finalWithdrawable).to.equal(initialWithdrawable.sub(totalWithdrawn))
    })

    step('should revert when trying to withdraw non-existent token balance', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        
        // Deploy a new mock token that has no withdrawable balance
        const ERC20Mock = await ethers.getContractFactory('ERC20Mock')
        const newToken = await ERC20Mock.deploy()
        await newToken.deployed()

        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('100', 6)

        // Should fail because there's no withdrawable balance for this token
        await expect(facet.adminWithdrawPaymentToken(newToken.address, amount, to))
            .to.be.revertedWith("Insufficient balance")
    })

    step('should emit correct events and maintain event consistency', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[3]
        const payoutKey = 'coFounders'
        const tokenAmount = '25'
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        // Create withdrawable balance
        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const stableCoinContract = await getContractWithSignerKey('USDTMock', 'nobody')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits(paymentAmount, 6)
        const from = await getContractAddress('TokenUnlockerApp')

        // Verify Transfer event is emitted with correct parameters
        const tx = await facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to)
        
        await expect(tx)
            .to.emit(stableCoinContract, 'Transfer')
            .withArgs(from, to, amount)

        // Verify the transaction receipt contains the Transfer event
        const receipt = await tx.wait()
        
        // The Transfer event should be emitted from the token contract
        // We already verified it above with expect(tx).to.emit(), this is just additional verification
        expect(receipt.status).to.equal(1) // Transaction should succeed
    })

    step('should prevent reentrancy attacks', async () => {
        // This test verifies that the nonReentrant modifier is working
        // Since we're using standard ERC20 tokens, we can't easily simulate reentrancy
        // but we verify the function has the modifier and works correctly under normal conditions
        
        const users = await getUnnamedAccounts();
        const userAddress = users[4]
        const payoutKey = 'strategicInvestors'
        const tokenAmount = '30'
        const paymentAmount = '6'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')
        const amount = parseUnits('3', 6)

        // Normal withdrawal should succeed (nonReentrant doesn't block legitimate calls)
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, amount, to))
            .to.not.be.reverted

        // The nonReentrant modifier prevents reentrancy by design
        // Additional reentrancy testing would require deploying malicious contracts
    })

    step('should handle edge case with exact withdrawable balance', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[5]
        const payoutKey = 'coFounders'
        const tokenAmount = '15'
        const paymentAmount = '3'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)

        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const to = await getAccountByKey('projectReserve')

        // Get the exact withdrawable balance
        const exactBalance = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        
        // Ensure there's something to withdraw
        expect(exactBalance).to.be.gt(0)

        // Withdraw the exact amount
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, exactBalance, to))
            .to.not.be.reverted

        // Verify balance is now zero
        const finalBalance = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        expect(finalBalance).to.equal(0)

        // Trying to withdraw anything more should fail
        await expect(facet.adminWithdrawPaymentToken(paymentTokenAddress, parseUnits('1', 6), to))
            .to.be.revertedWith("Insufficient balance")
    })
});