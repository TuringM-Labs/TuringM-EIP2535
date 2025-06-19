import initData from './utils/initData'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(`test:${scope}`)
describe(scope, () => {
    let marketId = ''
    before(async () => {
        const rz = await initData()
        marketId = rz.marketId
    });

    step('should make profit distribution successed', async () => {
        const facet = await getFacetWithSignerKey('TuringMarketApp', 'AdminFacet', 'adminRoleB')
        const stableCoinAddress = await getContractAddress('USDTMock')
        const dateString = getDateString()
        const brokerageAmount = ethers.utils.parseUnits('60', 6)
        const revenueAmount = ethers.utils.parseUnits('40', 6)
        const details = [true, brokerageAmount, revenueAmount, revenueAmount * 20 / 100, revenueAmount * 15 / 100, revenueAmount * 10 / 100, revenueAmount * 5 / 100, revenueAmount * 50 / 100]
        await expect(facet.profitDistribution(dateString, stableCoinAddress, brokerageAmount, revenueAmount))
            .to.emit(facet, "ProfitDistribution")
            .withArgs(dateString, stableCoinAddress, details);
    })
});