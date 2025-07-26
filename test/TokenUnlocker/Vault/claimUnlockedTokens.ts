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
        const paymentAmount = '500'
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

    step('should fail when schedule is already refunded', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[1]
        const payoutKey = 'coFounders'
        const tokenAmount = '100'
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = true

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        // First do a refund to set hasRefunded = true
        const refundNonce = hre.useNonce()
        const typeDataRefund = getConfig('TYPEHASH_INVEST_DO_REFUND')
        const userSigner = await ethers.getSigner(userAddress)
        const refundData = {
            scheduleId,
            nonce: refundNonce,
        }
        const refundSig = await signEIP712Data('TokenUnlockerApp', typeDataRefund, refundData, userSigner)
        
        // Wait for refund period to pass
        await time.increase(canRefundDuration + 1)
        await facet.doInvestRefund(scheduleId, refundNonce, refundSig)

        // Now try to claim from refunded schedule
        const claimNonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const amount = parseEther('100')
        const claimData = {
            scheduleId,
            amount,
            nonce: claimNonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, claimData, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, amount, claimNonce, userSig)
        ).to.be.revertedWith("Schedule already refunded")
    })

    step('should fail with invalid schedule id', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[2]
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        
        const invalidScheduleId = 99999
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const amount = parseEther('100')
        const data = {
            scheduleId: invalidScheduleId,
            amount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(
            facet.claimUnlockedTokens(invalidScheduleId, amount, nonce, userSig)
        ).to.be.revertedWith("Invalid schedule id")
    })

    step('should fail when claiming more than available amount', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[3]
        const payoutKey = 'coFounders'
        const tokenAmount = '100'
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const newTimestamp = Number(startTime) + oneYearSeconds + 100

        await time.increaseTo(newTimestamp)

        const rz = await facet.getUnlockedSchedule(scheduleId, newTimestamp)
        const canClaimAmount = rz.canUnlockedAmount.sub(rz.schedule.claimedAmount)
        
        // Try to claim more than available
        const excessiveAmount = canClaimAmount.add(parseEther('1'))
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount: excessiveAmount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, excessiveAmount, nonce, userSig)
        ).to.be.revertedWith("Insufficient canClaimAmount")
    })

    step('should fail when claiming before unlock time', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[4]
        const payoutKey = 'coFounders'
        const tokenAmount = '100'
        const paymentAmount = '5.00001'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        // Try to claim before one year lock period
        const amount = parseEther('100')
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, amount, nonce, userSig)
        ).to.be.revertedWith("Insufficient canClaimAmount")
    })

    step('should fail with invalid signature', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[5]
        const wrongUserAddress = users[6]
        const payoutKey = 'coFounders'
        const tokenAmount = '100'
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const newTimestamp = Number(startTime) + oneYearSeconds + 100

        await time.increaseTo(newTimestamp)

        const amount = parseEther('100')
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        // Sign with wrong user
        const wrongUserSigner = await ethers.getSigner(wrongUserAddress)
        const data = {
            scheduleId,
            amount,
            nonce,
        }
        const wrongUserSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, wrongUserSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, amount, nonce, wrongUserSig)
        ).to.be.revertedWithCustomError(facet, "VerifySignatureFailed")
    })

    step('should fail with reused nonce', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[7]
        const payoutKey = 'coFounders'
        const tokenAmount = '100'
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        // Wait long enough to ensure substantial tokens are unlocked
        const firstTimestamp = Number(startTime) + oneYearSeconds + 8 * 30 * 24 * 60 * 60 // 1 year + 8 months

        await time.increaseTo(firstTimestamp)

        // Check how much is available at first timestamp
        const rz1 = await facet.getUnlockedSchedule(scheduleId, firstTimestamp)
        const canClaimAmount1 = rz1.canUnlockedAmount.sub(rz1.schedule.claimedAmount)
        
        // Use a small amount for first claim
        const firstAmount = canClaimAmount1.div(10) // 1/10 of available
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount: firstAmount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        // First claim should succeed
        await facet.claimUnlockedTokens(scheduleId, firstAmount, nonce, userSig)

        // Wait more time to ensure more tokens are unlocked for the second attempt
        const secondTimestamp = firstTimestamp + 2 * 30 * 24 * 60 * 60 // Additional 2 months
        await time.increaseTo(secondTimestamp)

        // Check how much is available at second timestamp
        const rz2 = await facet.getUnlockedSchedule(scheduleId, secondTimestamp)
        const canClaimAmount2 = rz2.canUnlockedAmount.sub(rz2.schedule.claimedAmount)
        
        // Use smaller amount for second claim
        const secondAmount = canClaimAmount2.div(20) // 1/20 of available
        
        // Second claim with same nonce should fail with nonce error
        const data2 = {
            scheduleId,
            amount: secondAmount,
            nonce, // Same nonce
        }
        const userSig2 = await signEIP712Data('TokenUnlockerApp', typeDataUser, data2, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, secondAmount, nonce, userSig2)
        ).to.be.revertedWithCustomError(facet, "NonceHasBeenUsed")
    })

    step('should fail when claiming exceeds available allocation', async () => {
        // This test verifies that allocation amount check works correctly
        // User tries to claim more than their allocated amount
        
        const users = await getUnnamedAccounts();
        const userAddress = users[14]
        const payoutKey = 'coFounders'
        const tokenAmount = '50' // User gets 100 tokens
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const newTimestamp = Number(startTime) + oneYearSeconds + 365 * 24 * 60 * 60 // 2 years for full unlock

        await time.increaseTo(newTimestamp)

        // Try to claim more than allocated amount (50 tokens)
        const excessiveAmount = parseEther('100') // Try to claim 100 tokens when only allocated 50
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount: excessiveAmount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, excessiveAmount, nonce, userSig)
        ).to.be.revertedWith("Insufficient availableAmount")
    })

    step('should handle shareRevenue balance edge case', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[9]
        const payoutKey = 'coFounders'
        const tokenAmount = '100' // Use smaller amount to ensure full unlock
        const paymentAmount = '5'
        const canRefundDuration = 1000
        const isShareRevenue = true
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        // Wait for full unlock period (1 year lock + 3 years unlock = 4 years total)
        const fullUnlockTimestamp = Number(startTime) + oneYearSeconds + 3 * oneYearSeconds

        await time.increaseTo(fullUnlockTimestamp)

        // Check how much is actually unlocked
        const rz = await facet.getUnlockedSchedule(scheduleId, fullUnlockTimestamp)
        const totalUnlocked = rz.canUnlockedAmount
        
        // First, claim most of the tokens to reduce shareRevenue balance
        const firstClaimAmount = totalUnlocked.mul(75).div(100) // 75% of unlocked amount
        const firstNonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const firstData = {
            scheduleId,
            amount: firstClaimAmount,
            nonce: firstNonce,
        }
        const firstUserSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, firstData, userSigner)

        await facet.claimUnlockedTokens(scheduleId, firstClaimAmount, firstNonce, firstUserSig)

        // Check updated unlock status
        const rz2 = await facet.getUnlockedSchedule(scheduleId, fullUnlockTimestamp)
        const remainingUnlocked = rz2.canUnlockedAmount.sub(rz2.schedule.claimedAmount)
        
        // Try to claim remaining amount, should succeed
        const remainingAmount = remainingUnlocked.div(2) // Half of remaining
        const secondNonce = hre.useNonce()
        const secondData = {
            scheduleId,
            amount: remainingAmount,
            nonce: secondNonce,
        }
        const secondUserSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, secondData, userSigner)

        const tx = await facet.claimUnlockedTokens(scheduleId, remainingAmount, secondNonce, secondUserSig)
        const receipt = await tx.wait()

        expect(receipt).to.emit(facet, "TokenClaimed")

        // Verify shareRevenue balance is properly updated
        const finalShareRevenueBalance = await facet.getShareRevenueTokenBalance(userAddress)
        const expectedReduction = firstClaimAmount.add(remainingAmount)
        const initialShareRevenue = parseEther(tokenAmount)
        expect(finalShareRevenueBalance).to.equal(initialShareRevenue.sub(expectedReduction))
    })

    step('should fail when trying to claim from canRefund schedule before quitting refund', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[10]
        const payoutKey = 'coFounders'
        const tokenAmount = '1000'
        const paymentAmount = '50'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = true

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const newTimestamp = Number(startTime) + oneYearSeconds + 100

        await time.increaseTo(newTimestamp)

        const amount = parseEther('100')
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        // Should fail because canRefund schedules can't be claimed until user quits refund
        await expect(
            facet.claimUnlockedTokens(scheduleId, amount, nonce, userSig)
        ).to.be.revertedWith("Insufficient canClaimAmount")
    })

    step('should fail when claiming more than total allocation', async () => {
        const users = await getUnnamedAccounts();
        const userAddress = users[11]
        const payoutKey = 'coFounders'
        const tokenAmount = '1000'
        const paymentAmount = '50'
        const canRefundDuration = 1000
        const isShareRevenue = false
        const canRefund = false

        const { facet, tokenAllocatedArgs } = await doInvestToken(userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund)
        const scheduleId = tokenAllocatedArgs.scheduleIndex

        const startTime = await time.latest()
        const oneYearSeconds = 365 * 24 * 60 * 60
        const newTimestamp = Number(startTime) + oneYearSeconds + 100

        await time.increaseTo(newTimestamp)

        // Try to claim more than the total allocation
        const excessiveAmount = parseEther(tokenAmount).add(parseEther('1'))
        
        const nonce = hre.useNonce()
        const typeDataUser = getConfig('TYPEHASH_CLAIM_UNLOCKED_TOKEN')
        const userSigner = await ethers.getSigner(userAddress)
        const data = {
            scheduleId,
            amount: excessiveAmount,
            nonce,
        }
        const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, data, userSigner)

        await expect(
            facet.claimUnlockedTokens(scheduleId, excessiveAmount, nonce, userSig)
        ).to.be.revertedWith("Insufficient availableAmount")
    })
});