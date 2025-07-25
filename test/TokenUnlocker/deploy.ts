import initData from './utils/initData'
const scope = getNameForTag(__dirname, __filename)
const theDebug = require('debug')(scope)
describe(scope, () => {
    before(() => initData())

    step('OwnableFacet: should superAdmin be the owner of TokenUnlockerApp', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'OwnableFacet', 'nobody')
        
        const owner = await facet.owner()
        const superAdmin = await getAccountByKey('superAdmin')
        await expect(owner)
            .to.equal(superAdmin);
    })

    step('AccessControlFacet: should superAdmin have superAdmin role', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'AccessControlFacet', 'superAdmin')
        const superAdmin = await getAccountByKey('superAdmin')
        const hasRole = await facet.hasRole(superAdmin, getConfig('ROLE_SUPER_ADMIN'))
        await expect(hasRole)
            .to.equal(true);
    })

    step('AccessControlFacet: should deployer is not the owner of TokenUnlockerApp', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'OwnableFacet', 'nobody')
        const deployer = await getAccountByKey('deployer')
        const owner = await facet.owner()
        await expect(owner)
            .to.not.equal(deployer);
    })

    step('AccessControlFacet: should deployer do not have any roles', async () => {
        const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'AccessControlFacet', 'nobody')
        const deployer = await getAccountByKey('deployer')
        const roles = await facet.userRoles(deployer)
        await expect(roles)
            .to.equal(ethers.constants.HashZero);
    })
});