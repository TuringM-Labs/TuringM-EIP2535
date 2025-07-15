import initData from '../utils/initData'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should create vault successed', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleC')
        const tokenAddress = await getContractAddress('TuringToken')
        const paymentTokenAddress = await getContractAddress('USDTMock')
        const operator = await getAccountByKey('projectReserve')

        const unlockedSince = Math.floor(Date.now() / 1000)
        const unlockedDuration = 3600 * 24 * 30 * 12 * 3 // 3 year
        const name = 'coFounders vault'
        const vaultId = await facet.getVaultsCount();
        const vaultType = 0n;
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
            .withArgs(vaultId, name, vaultType, tokenAddress, paymentTokenAddress, operator);
    })
});