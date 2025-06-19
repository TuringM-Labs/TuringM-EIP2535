import { faucetUsersStableCoin } from './faucetUsersStableCoin.ts'
import { faucetUsersTUIT } from './faucetUsersTUIT.ts'
import { prepareMarket } from './prepareMarket.ts'
import { prepareUserOrder } from './prepareUserOrder'
export default createInitData(async ({ deployments }) => {
    await deployments.fixture(['TuringMarket:99_All'])
    const marketId = randomId()

    await faucetUsersStableCoin(10 ** 6);
    await faucetUsersTUIT(10 ** 6);
    await prepareMarket(marketId);
    await prepareUserOrder(marketId);

    return {
        marketId,
    }
})