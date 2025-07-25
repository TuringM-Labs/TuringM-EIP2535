export const prepareMarket = async marketId => {
    const facet = await getFacetWithSignerKey('TuringMarketApp', 'MarketManagerFacet', 'marketManagerRoleB')
    await facet.createMarket(marketId)
}