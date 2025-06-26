import initData from '../utils/initData'
import { doStake } from './utils/doStake'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should unstake successed', async () => {
        const { scheduleIndex, userAddress, tokenAddress, amount } = await doStake()
        const facetStaking = await getFacetWithSignerKey('TokenUnlockerApp', 'StakingFacet', 'stakingRoleB')
        const typeData = getConfig('TYPEHASH_UNSTAKE')
        const data = {
            scheduleIndex,
            nonce: hre.useNonce()
        }
        const userSigner = await ethers.getSigner(userAddress)
        const userSig = await signEIP712Data('TokenUnlockerApp', typeData, data, userSigner)
        
        const tx = await facetStaking.unstake(scheduleIndex, data.nonce, userSig)
        const tuitContract = await getContractWithSignerKey('TuringToken', 'nobody')

        await expect(tx)
            .to.emit(tuitContract, 'Transfer')
                .withArgs(await getContractAddress('TokenUnlockerApp'), userAddress, amount)
            .to.emit(facetStaking, 'Unstaked')
                .withArgs(userAddress, tokenAddress, amount, data.nonce, scheduleIndex)
    })
});