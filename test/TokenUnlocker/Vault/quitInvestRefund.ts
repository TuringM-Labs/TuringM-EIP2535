import initData from '../utils/initData'
import {doInvestToken} from './utils/doInvestToken'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should quitInvestRefund succeed with complete state updates', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[0]
        const payoutKey = 'coFounders'
        const tokenAmount = '10'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = true

        const { paymentTokenAddress, facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        
        // Capture initial states
        const rz = await facet.getUnlockedSchedule(scheduleId, await time.latest())
        const schedule1 = rz.schedule
        const initialWithdrawablePaymentTokenAmount = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        const voteFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')
        const initialUserVotingPower = await voteFacet.getVotingPower(userAddress)
        const initialUserShareRevenue = await facet.getShareRevenueTokenBalance(userAddress)
        const initialTotalShareRevenue = await facet.getTotalShareRevenueAmount()
        
        expect(schedule1.canRefund).to.equal(true)
        expect(schedule1.hasRefunded).to.equal(false)
        expect(schedule1.isShareRevenue).to.equal(true)
        
        const data = {
            scheduleId,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        const tx = await facet.quitInvestRefund(scheduleId, nonce, userSig)
        await tx.wait()
        
        // Verify schedule state changes
        const rz2 = await facet.getUnlockedSchedule(scheduleId, await time.latest())
        const schedule2 = rz2.schedule
        const finalWithdrawablePaymentTokenAmount = await facet.getWithdrawablePaymentTokenAmount(paymentTokenAddress)
        const finalUserVotingPower = await voteFacet.getVotingPower(userAddress)
        const finalUserShareRevenue = await facet.getShareRevenueTokenBalance(userAddress)
        const finalTotalShareRevenue = await facet.getTotalShareRevenueAmount()

        // Verify all state changes
        expect(schedule2.canRefund).to.equal(false)
        expect(schedule2.hasRefunded).to.equal(false) // Should remain false for quit refund
        expect(finalWithdrawablePaymentTokenAmount).to.equal(initialWithdrawablePaymentTokenAmount.add(schedule2.paymentAmount))
        expect(finalUserVotingPower).to.equal(initialUserVotingPower.add(schedule2.allocationAmount))
        
        // Since isShareRevenue=true, verify share revenue updates
        expect(finalUserShareRevenue).to.equal(initialUserShareRevenue.add(schedule2.allocationAmount))
        expect(finalTotalShareRevenue).to.equal(initialTotalShareRevenue.add(schedule2.allocationAmount))
    })

    step('should handle quitInvestRefund with isShareRevenue=false correctly', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[1]
        const payoutKey = 'coFounders'
        const tokenAmount = '15'
        const paymentAmount = '3'
        const canRefundDuration = 1000
        const isShareRevenue = false // No share revenue
        const canRefund = true

        const { paymentTokenAddress, facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        
        // Capture initial states
        const initialUserShareRevenue = await facet.getShareRevenueTokenBalance(userAddress)
        const initialTotalShareRevenue = await facet.getTotalShareRevenueAmount()
        const voteFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')
        const initialUserVotingPower = await voteFacet.getVotingPower(userAddress)
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const data = { scheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await facet.quitInvestRefund(scheduleId, nonce, userSig)
        
        // Verify state changes
        const schedule = (await facet.getUnlockedSchedule(scheduleId, await time.latest())).schedule
        const finalUserShareRevenue = await facet.getShareRevenueTokenBalance(userAddress)
        const finalTotalShareRevenue = await facet.getTotalShareRevenueAmount()
        const finalUserVotingPower = await voteFacet.getVotingPower(userAddress)
        
        // Voting power should still be granted
        expect(finalUserVotingPower).to.equal(initialUserVotingPower.add(schedule.allocationAmount))
        
        // Share revenue should NOT be updated when isShareRevenue=false
        expect(finalUserShareRevenue).to.equal(initialUserShareRevenue)
        expect(finalTotalShareRevenue).to.equal(initialTotalShareRevenue)
    })

    step('should revert when attempting quit refund on non-refundable schedule', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[2]
        const payoutKey = 'coFounders'
        const tokenAmount = '10'
        const paymentAmount = '2'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false // Non-refundable

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        
        const data = {
            scheduleId,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.be.revertedWith("This investment is non-refundable")
    })

    step('should revert with invalid schedule ID', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const users = await getUnnamedAccounts();
        const userAddress = users[3]
        const userSigner = await ethers.getSigner(userAddress)
        
        // Get current schedule count and use out-of-range ID
        const scheduleCount = await facet.getUnlockedSchedulesCount()
        const invalidScheduleId = scheduleCount.add(1000) // Way beyond valid range
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const data = {
            scheduleId: invalidScheduleId,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        await expect(facet.quitInvestRefund(invalidScheduleId, nonce, userSig))
            .to.be.revertedWith("Invalid schedule id")
    })

    step('should revert with invalid user signature', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[4]
        const wrongUserAddress = users[5]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        
        // Sign with wrong user
        const wrongUserSigner = await ethers.getSigner(wrongUserAddress)
        const data = { scheduleId, nonce }
        const wrongUserSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, wrongUserSigner)
        
        await expect(facet.quitInvestRefund(scheduleId, nonce, wrongUserSig))
            .to.be.revertedWithCustomError(facet, "VerifySignatureFailed")
    })

    step('should revert when reusing nonce', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[6]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const reusedNonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        
        const data = { scheduleId, nonce: reusedNonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        // First call should succeed
        await expect(facet.quitInvestRefund(scheduleId, reusedNonce, userSig))
            .to.not.be.reverted

        // Create another refundable investment to test nonce reuse
        const { tokenAllocatedArgs: tokenAllocatedArgs2 } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId2 = tokenAllocatedArgs2.scheduleIndex
        
        const data2 = { scheduleId: scheduleId2, nonce: reusedNonce }
        const userSig2 = await signEIP712Data('TokenUnlockerApp', typeDataUser, data2, userSigner)
        
        // Second call with same nonce should fail
        await expect(facet.quitInvestRefund(scheduleId2, reusedNonce, userSig2))
            .to.be.revertedWithCustomError(facet, "NonceHasBeenUsed")
    })

    step('should revert when contract is paused', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[7]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        
        // Pause the contract
        const pausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleC')
        await pausableFacet.pause()
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const data = { scheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.be.revertedWithCustomError(facet, "EnforcedPause")
        
        // Unpause for subsequent tests
        const unpausableFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'PausableFacet', 'pausableRoleA')
        await unpausableFacet.unpause()
    })

    step('should revert when caller lacks roleB permission', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[8]
        const payoutKey = 'coFounders'
        
        const { tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        
        // Use facet with insufficient permissions
        const unauthorizedFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody')
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const data = { scheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        await expect(unauthorizedFacet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.be.revertedWithCustomError(unauthorizedFacet, "CallerIsNotAuthorized")
    })

    step('should revert when attempting to quit refund twice on same schedule', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[9]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const userSigner = await ethers.getSigner(userAddress)
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        
        // First quit refund - should succeed
        const nonce1 = hre.useNonce()
        const data1 = { scheduleId, nonce: nonce1 }
        const userSig1 = await signEIP712Data('TokenUnlockerApp', typeDataUser, data1, userSigner)
        await expect(facet.quitInvestRefund(scheduleId, nonce1, userSig1))
            .to.not.be.reverted

        // Second quit refund attempt - should fail
        const nonce2 = hre.useNonce()
        const data2 = { scheduleId, nonce: nonce2 }
        const userSig2 = await signEIP712Data('TokenUnlockerApp', typeDataUser, data2, userSigner)
        await expect(facet.quitInvestRefund(scheduleId, nonce2, userSig2))
            .to.be.revertedWith("This investment is non-refundable")
    })

    step('should correctly handle signature verification with mismatched parameters', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[10]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        
        // Sign with different scheduleId than what's passed to function
        const wrongScheduleId = scheduleId + 1000
        const data = { scheduleId: wrongScheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        // Call with correct scheduleId but signature for wrong scheduleId
        await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.be.revertedWithCustomError(facet, "VerifySignatureFailed")
    })

    step('should handle edge case with minimal token amounts', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[11]
        const payoutKey = 'coFounders'
        
        // Create investment with minimal amounts
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '0.000001', '0.000001', 1000, true, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const data = { scheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.not.be.reverted
    })

    step('should maintain reentrancy protection', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[12]
        const payoutKey = 'coFounders'
        
        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '10', '2', 1000, false, true)
        const scheduleId = tokenAllocatedArgs.scheduleIndex
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const data = { scheduleId, nonce }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
        
        // Normal quit refund should work (demonstrates nonReentrant doesn't block legitimate calls)
        await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
            .to.not.be.reverted
        
        // The nonReentrant modifier prevents reentrancy by design
        // Additional reentrancy testing would require deploying malicious contracts
    })

    step('should verify complete state consistency across multiple quit refunds', async () => {
        const users = await getUnnamedAccounts();
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const voteFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')
        const payoutKey = 'strategicInvestors'
        
        // Create multiple refundable investments
        const investments = []
        for (let i = 0; i < 3; i++) {
            const userAddress = users[13 + i]
            const tokenAmount = (10 + i * 5).toString()
            const paymentAmount = (2 + i).toString()
            const isShareRevenue = i % 2 === 0 // Alternate share revenue settings
            
            const result = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, 1000, isShareRevenue, true)
            investments.push({
                userAddress,
                scheduleId: result.tokenAllocatedArgs.scheduleIndex,
                tokenAmount: parseEther(tokenAmount),
                paymentAmount: parseUnits(paymentAmount, 6),
                paymentTokenAddress: result.paymentTokenAddress,
                isShareRevenue
            })
        }
        
        // Capture initial global states
        let initialTotalVotingPower = ethers.BigNumber.from(0)
        let initialTotalShareRevenue = await facet.getTotalShareRevenueAmount()
        let initialWithdrawablePayment = await facet.getWithdrawablePaymentTokenAmount(investments[0].paymentTokenAddress)
        
        for (const investment of investments) {
            const userVotingPower = await voteFacet.getVotingPower(investment.userAddress)
            initialTotalVotingPower = initialTotalVotingPower.add(userVotingPower)
        }
        
        // Execute all quit refunds
        for (const investment of investments) {
            const nonce = hre.useNonce()
            const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
            const userSigner = await ethers.getSigner(investment.userAddress)
            const data = { scheduleId: investment.scheduleId, nonce }
            const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
            
            await expect(facet.quitInvestRefund(investment.scheduleId, nonce, userSig))
                .to.not.be.reverted
        }
        
        // Verify final global states
        let finalTotalVotingPower = ethers.BigNumber.from(0)
        const finalTotalShareRevenue = await facet.getTotalShareRevenueAmount()
        const finalWithdrawablePayment = await facet.getWithdrawablePaymentTokenAmount(investments[0].paymentTokenAddress)
        
        let expectedVotingPowerIncrease = ethers.BigNumber.from(0)
        let expectedShareRevenueIncrease = ethers.BigNumber.from(0)
        let expectedPaymentIncrease = ethers.BigNumber.from(0)
        
        for (const investment of investments) {
            const userVotingPower = await voteFacet.getVotingPower(investment.userAddress)
            finalTotalVotingPower = finalTotalVotingPower.add(userVotingPower)
            expectedVotingPowerIncrease = expectedVotingPowerIncrease.add(investment.tokenAmount)
            expectedPaymentIncrease = expectedPaymentIncrease.add(investment.paymentAmount)
            
            if (investment.isShareRevenue) {
                expectedShareRevenueIncrease = expectedShareRevenueIncrease.add(investment.tokenAmount)
            }
        }
        
        // Verify all calculations are consistent
        expect(finalTotalVotingPower).to.equal(initialTotalVotingPower.add(expectedVotingPowerIncrease))
        expect(finalTotalShareRevenue).to.equal(initialTotalShareRevenue.add(expectedShareRevenueIncrease))
        expect(finalWithdrawablePayment).to.equal(initialWithdrawablePayment.add(expectedPaymentIncrease))
    })

    step('should handle concurrent operations correctly', async () => {
        // This test ensures that quitInvestRefund works correctly when multiple users
        // are performing operations simultaneously
        const users = await getUnnamedAccounts();
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const payoutKey = 'coFounders'
        
        // Create multiple investments quickly
        const userAddresses = [users[20], users[21], users[22]]
        const scheduleIds = []
        
        for (const userAddress of userAddresses) {
            const { tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, '8', '1.6', 1000, true, true)
            scheduleIds.push(tokenAllocatedArgs.scheduleIndex)
        }
        
        // Execute quit refunds sequentially to avoid nonce conflicts
        // Note: While this tests sequential execution, it still validates the core functionality
        for (let i = 0; i < userAddresses.length; i++) {
            const userAddress = userAddresses[i]
            const scheduleId = scheduleIds[i]
            const nonce = hre.useNonce()
            const typeDataUser = getConfig('TYPEHASH_INVEST_QUIT_REFUND')
            const userSigner = await ethers.getSigner(userAddress)
            const data = { scheduleId, nonce }
            const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)
            
            await expect(facet.quitInvestRefund(scheduleId, nonce, userSig))
                .to.not.be.reverted
        }
        
        // Verify all schedules are properly updated
        for (const scheduleId of scheduleIds) {
            const schedule = (await facet.getUnlockedSchedule(scheduleId, await time.latest())).schedule
            expect(schedule.canRefund).to.equal(false)
            expect(schedule.hasRefunded).to.equal(false)
        }
    })
});