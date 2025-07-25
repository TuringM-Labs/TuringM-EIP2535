import { faucetUsersStableCoin } from '../../TuringMarket/utils/faucetUsersStableCoin.ts'
import { faucetUsersTUIT } from '../../TuringMarket/utils/faucetUsersTUIT.ts'

export default createInitData(async ({ deployments }) => {
    await deployments.fixture(['TokenUnlocker:99_All'])

    await faucetUsersStableCoin(10 ** 3);
    await faucetUsersTUIT(10 ** 3);
    return {
    }
})