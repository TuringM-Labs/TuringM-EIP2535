import initData from '../utils/initData'

const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)

describe(scope, () => {
    before(() => initData())

    step('should create Vc vault successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 3 // 3 years
        const name = 'test vc vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 0n // VaultType.Vc
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: true,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress,
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, paymentTokenAddress, operator)
    })

    step('should create LinearUnlocked vault successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 2 // 2 years
        const name = 'test linear unlocked vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 1n // VaultType.LinearUnlocked
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000", // Not required for LinearUnlocked
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, "0x0000000000000000000000000000000000000000", operator)
    })

    step('should create Payout vault successfully', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const name = 'test payout vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 2n // VaultType.Payout
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince: 0,
            unlockedDuration: 0, // Not required for Payout
            paymentTokenAddress: "0x0000000000000000000000000000000000000000", // Not required for Payout
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, "0x0000000000000000000000000000000000000000", operator)
    })

    step('should fail when Vc vault has zero payment token address', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 3
        const name = 'invalid vc vault'
        const vaultType = 0n // VaultType.Vc
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: true,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000", // Invalid for Vc type
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.be.revertedWith("Invalid payment token address")
    })

    step('should fail when caller does not have vaultRoleC permission', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'nobody') // Wrong role
        const tokenAddress = await getContractAddress('TuringToken')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 3
        const name = 'unauthorized vault'
        const vaultType = 0n
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: true,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress,
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.be.revertedWithCustomError(facet, "CallerIsNotAuthorized")
    })

    step('should handle edge case with maximum duration', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 365 * 100 // 100 years - extreme but valid
        const name = 'long duration vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 0n
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress,
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, paymentTokenAddress, operator)

        // Verify vault was created correctly
        const vault = await facet.getVault(vaultId)
        expect(vault.unlockedDuration).to.equal(unlockedDuration)
        expect(vault.name).to.equal(name)
        expect(vault.vaultType).to.equal(vaultType)
    })

    step('should handle edge case with future unlockedSince timestamp', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const futureTimestamp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365 // 1 year in the future
        const unlockedDuration = 3600 * 24 * 30 * 12 * 2 // 2 years
        const name = 'future start vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 1n // LinearUnlocked
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince: futureTimestamp,
            unlockedDuration,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000",
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, "0x0000000000000000000000000000000000000000", operator)

        // Verify vault was created with future timestamp
        const vault = await facet.getVault(vaultId)
        expect(vault.unlockedSince).to.equal(futureTimestamp)
    })

    step('should handle vault with empty name', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 6 // 6 months
        const name = '' // Empty name
        const vaultId = await facet.getVaultsCount()
        const vaultType = 2n // Payout
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000",
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId, name, vaultType, tokenAddress, "0x0000000000000000000000000000000000000000", operator)

        // Verify vault was created with empty name
        const vault = await facet.getVault(vaultId)
        expect(vault.name).to.equal("")
    })

    step('should verify vault creation increments vaultsCount correctly', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator = await getAccountByKey('projectReserve')

        const initialCount = await facet.getVaultsCount()
        
        const data = {
            name: 'count test vault',
            vaultType: 2n, // Payout
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince: 0,
            unlockedDuration: 0,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000",
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await facet.createVault(data)
        
        const finalCount = await facet.getVaultsCount()
        expect(finalCount).to.equal(initialCount.add(1))
    })

    step('should verify vault data integrity after creation', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 5 // 5 years
        const name = 'data integrity test vault'
        const vaultId = await facet.getVaultsCount()
        const vaultType = 0n // Vc
        
        const data = {
            name,
            vaultType,
            tokenAddress,
            operator,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: true,
            unlockedSince,
            unlockedDuration,
            paymentTokenAddress,
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await facet.createVault(data)
        
        // Verify all data was stored correctly
        const vault = await facet.getVault(vaultId)
        expect(vault.name).to.equal(name)
        expect(vault.vaultType).to.equal(vaultType)
        expect(vault.tokenAddress).to.equal(tokenAddress)
        expect(vault.operator).to.equal(operator)
        expect(vault.canShareRevenue).to.equal(true)
        expect(vault.unlockedSince).to.equal(unlockedSince)
        expect(vault.unlockedDuration).to.equal(unlockedDuration)
        expect(vault.paymentTokenAddress).to.equal(paymentTokenAddress)
        expect(vault.totalDeposit).to.equal(0)
        expect(vault.balance).to.equal(0)
        expect(vault.totalPayout).to.equal(0)
        expect(vault.allocatedAmount).to.equal(0)
        expect(vault.paymentAmount).to.equal(0)
        expect(vault.claimedAmount).to.equal(0)
        // createdAt should be set to current block timestamp
        expect(vault.createdAt).to.be.gt(0)
    })

    step('should allow multiple vaults with same name but different operators', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const operator1 = await getAccountByKey('projectReserve')
        const operator2 = await getAccountByKey('coFounders')

        const name = 'duplicate name vault'
        const vaultId1 = await facet.getVaultsCount()
        
        const data1 = {
            name,
            vaultType: 2n, // Payout
            tokenAddress,
            operator: operator1,
            createdAt: 0n,
            totalDeposit: 0n,
            balance: 0n,
            totalPayout: 0n,
            canShareRevenue: false,
            unlockedSince: 0,
            unlockedDuration: 0,
            paymentTokenAddress: "0x0000000000000000000000000000000000000000",
            allocatedAmount: 0n,
            paymentAmount: 0n,
            claimedAmount: 0n,
        }

        await expect(facet.createVault(data1))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId1, name, 2n, tokenAddress, "0x0000000000000000000000000000000000000000", operator1)

        const vaultId2 = await facet.getVaultsCount()
        const data2 = {
            ...data1,
            operator: operator2
        }

        await expect(facet.createVault(data2))
            .to.emit(facet, "VaultCreated")
            .withArgs(vaultId2, name, 2n, tokenAddress, "0x0000000000000000000000000000000000000000", operator2)

        // Verify both vaults exist with different operators
        const vault1 = await facet.getVault(vaultId1)
        const vault2 = await facet.getVault(vaultId2)
        expect(vault1.operator).to.equal(operator1)
        expect(vault2.operator).to.equal(operator2)
        expect(vault1.name).to.equal(vault2.name)
    })
})