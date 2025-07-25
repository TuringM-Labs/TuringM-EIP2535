import initData from '../utils/initData'
import { doStake } from '../Staking/utils/doStake';
import { createProposal } from './utils/createProposal';
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should successed', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')

        const { userAddress, amount, scheduleIndex } = await doStake()
        const newTimestamp = (await time.latest()) + 3600 * 24 * 30
        await time.increaseTo(newTimestamp)
        await facet.syncVotingPowerFromStakeScheduleIds(userAddress, scheduleIndex)

        const {proposalId} = await createProposal('test')
        const typeData = getConfig('TYPEHASH_VOTE')
        const data = {
            proposalId,
            userAddress,
            yesVotes: amount.div(2),
            noVotes: amount.div(2),
            nonce: hre.useNonce()
        }

        const signer = await ethers.getSigner(userAddress)
        const userSig = await signEIP712Data('TokenUnlockerApp', typeData, data, signer)

        await expect(facet.vote(data, userSig))
            .to.emit(facet, "Voted")
            .withArgs(userAddress, proposalId, data.yesVotes, data.noVotes, data.nonce);
    })
});