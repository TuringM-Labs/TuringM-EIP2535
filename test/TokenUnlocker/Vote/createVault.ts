import initData from '../utils/initData'
import { createProposal } from './utils/createProposal';
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('should successed', async () => {
        await createProposal('a cool proposal')
    })

    step('should revertedWith("Description hash already exists")', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')
       
        const descHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('a cool proposal'))
        const duration = 3600 * 24 * 7
        await expect(facet.createProposal(descHash, duration))
            .to.revertedWith("Description hash already exists")
    })
});