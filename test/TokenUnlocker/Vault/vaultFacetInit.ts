import initData from '../utils/initData'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should revert when external user tries to call VaultFacet_init', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const users = await getUnnamedAccounts();
        const attacker = users[0]
        
        // Try to call VaultFacet_init as external user
        const attackerFacet = facet.connect(await ethers.getSigner(attacker))
        
        // Attempt to reinitialize with malicious role assignments
        const maliciousRoleA = 255  // Max uint8 value
        const maliciousRoleB = 255
        const maliciousRoleC = 255
        
        await expect(attackerFacet.VaultFacet_init(maliciousRoleA, maliciousRoleB, maliciousRoleC))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should revert when admin tries to call VaultFacet_init after deployment', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'deployer')
        
        // Even deployer/admin should not be able to reinitialize
        const newRoleA = 1
        const newRoleB = 2  
        const newRoleC = 3
        
        await expect(facet.VaultFacet_init(newRoleA, newRoleB, newRoleC))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should revert when super admin tries to call VaultFacet_init', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'superAdmin')
        
        // Even super admin should not be able to reinitialize
        const newRoleA = 10
        const newRoleB = 20
        const newRoleC = 30
        
        await expect(facet.VaultFacet_init(newRoleA, newRoleB, newRoleC))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should revert when trying to call VaultFacet_init with zero roles', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        
        // Test with zero values (potential bypass attempt)
        await expect(facet.VaultFacet_init(0, 0, 0))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should revert when multiple users try to call VaultFacet_init simultaneously', async () => {
        const users = await getUnnamedAccounts();
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        
        // Test concurrent initialization attempts (potential race condition attack)
        const attackPromises = []
        
        for (let i = 0; i < 5; i++) {
            const attackerAddress = users[i + 1]
            const attackerFacet = facet.connect(await ethers.getSigner(attackerAddress))
            
            const promise = attackerFacet.VaultFacet_init(i, i + 1, i + 2)
                .catch(error => error) // Catch errors to continue testing
                
            attackPromises.push(promise)
        }
        
        const results = await Promise.all(attackPromises)
        
        // All attempts should fail
        for (const result of results) {
            expect(result).to.be.an('error')
            expect(result.message).to.include('NotInitializing')
        }
    })

    step('should revert when calling VaultFacet_init with extreme role values', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        
        // Test with maximum uint8 values (potential overflow attack)
        const maxUint8 = 255
        
        await expect(facet.VaultFacet_init(maxUint8, maxUint8, maxUint8))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should revert when unauthorized contracts try to call VaultFacet_init', async () => {
        // This simulates a malicious contract trying to call the init function
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody')
        
        await expect(facet.VaultFacet_init(1, 2, 3))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should verify that VaultFacet_init cannot be called after successful operations', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        
        // First, perform a normal operation to ensure contract is properly initialized
        const vaultCount = await facet.getVaultsCount()
        expect(vaultCount).to.be.gte(0) // Contract should be working normally
        
        // Now try to reinitialize - should fail
        await expect(facet.VaultFacet_init(5, 6, 7))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
    })

    step('should ensure VaultFacet_init cannot bypass existing access controls', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        const users = await getUnnamedAccounts();
        
        // Verify current access controls are working
        const unauthorizedFacet = facet.connect(await ethers.getSigner(users[10]))
        
        // This should fail due to lack of roleC permission
        await expect(unauthorizedFacet.createVault({
            name: "test vault",
            vaultType: 0,
            tokenAddress: await getContractAddress('TuringToken'),
            operator: users[10],
            createdAt: 0,
            totalDeposit: 0,
            balance: 0,
            totalPayout: 0,
            canShareRevenue: false,
            unlockedSince: Math.floor(Date.now() / 1000),
            unlockedDuration: 365 * 24 * 60 * 60,
            paymentTokenAddress: await getContractAddress('USDTMock'),
            allocatedAmount: 0,
            paymentAmount: 0,
            claimedAmount: 0
        })).to.be.revertedWithCustomError(facet, "CallerIsNotAuthorized")
        
        // Now attempt to use VaultFacet_init to potentially bypass these controls
        await expect(unauthorizedFacet.VaultFacet_init(255, 255, 255))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
        
        // Verify access controls still work after the failed init attempt
        await expect(unauthorizedFacet.createVault({
            name: "test vault 2",
            vaultType: 0,
            tokenAddress: await getContractAddress('TuringToken'),
            operator: users[10],
            createdAt: 0,
            totalDeposit: 0,
            balance: 0,
            totalPayout: 0,
            canShareRevenue: false,
            unlockedSince: Math.floor(Date.now() / 1000),
            unlockedDuration: 365 * 24 * 60 * 60,
            paymentTokenAddress: await getContractAddress('USDTMock'),
            allocatedAmount: 0,
            paymentAmount: 0,
            claimedAmount: 0
        })).to.be.revertedWithCustomError(facet, "CallerIsNotAuthorized")
    })

    step('should verify initialization state cannot be manipulated', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        
        // Test that the contract maintains its initialized state
        // Try multiple init attempts in sequence
        for (let i = 0; i < 3; i++) {
            await expect(facet.VaultFacet_init(i * 10, i * 10 + 1, i * 10 + 2))
                .to.be.revertedWithCustomError(facet, "NotInitializing")
        }
        
        // Verify contract is still functional after all failed attempts
        const vaultCount = await facet.getVaultsCount()
        expect(vaultCount).to.be.gte(0)
        
        // Verify specific functions still work with proper authorization
        const authorizedFacet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        await expect(authorizedFacet.getVaultsCount()).to.not.be.reverted
    })

    step('should prevent potential reentrancy attacks on VaultFacet_init', async () => {
        // This test ensures that even if someone tries to call VaultFacet_init
        // during another operation, it will fail
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        
        // Simulate calling init during normal operation
        const vaultCountPromise = facet.getVaultsCount()
        const initPromise = facet.VaultFacet_init(100, 101, 102)
        
        const [vaultCount, initResult] = await Promise.allSettled([vaultCountPromise, initPromise])
        
        expect(vaultCount.status).to.equal('fulfilled')
        expect(initResult.status).to.equal('rejected')
        expect(initResult.reason.message).to.include('NotInitializing')
    })

    step('should verify that role assignments cannot be changed via VaultFacet_init', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleA')
        
        // Test current role A functionality works
        const users = await getUnnamedAccounts();
        const testAddress = users[15]
        
        // This should work with roleA
        await expect(facet.adminUpdateVaultOperator(0, testAddress))
            .to.not.be.reverted
        
        // Attempt to reinitialize with different roles
        await expect(facet.VaultFacet_init(0, 0, 0))
            .to.be.revertedWithCustomError(facet, "NotInitializing")
        
        // Verify roleA still works after failed init attempt
        await expect(facet.adminUpdateVaultOperator(0, testAddress))
            .to.not.be.reverted
        
        // Verify other roles still work correctly
        const facetB = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
        await expect(facetB.getVaultsCount()).to.not.be.reverted
        
        const facetC = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        await expect(facetC.getVaultsCount()).to.not.be.reverted
    })
}); 