import { getVaultByKey } from '../../utils/getVaultByKey'

export const doStake = async () => {
    const users = await getUnnamedAccounts();
    const payoutkey = 'ecosystemDevelopment'
    const operator = await getSignerByKey(payoutkey)
    const to = users[0]
    const { vaultId } = getVaultByKey(payoutkey)

    const amount = parseEther('1000')

    const reason = `payout to ${to} with ${amount} for test staking`
    const typeData = getConfig('TYPEHASH_PAYOUT')
    const data = {
        vaultId,
        to,
        amount,
        reason,
        nonce: hre.useNonce()
    }
    const opSig = await signEIP712Data('TokenUnlockerApp', typeData, data, operator)
    const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
    const vault = await facet.getVault(vaultId)
    const tokenAddress = vault.tokenAddress

    const tx = await facet.payoutToken(vaultId, to, amount, reason, data.nonce, opSig)
    await tx.wait()

    const facetStaking = await getFacetWithSignerKey('TokenUnlockerApp', 'StakingFacet', 'stakingRoleC')
    const signer = await ethers.getSigner(to)

    const typeDataStake = getConfig('TYPEHASH_STAKE')
    const dataStake = {
        userAddress: to, 
        tokenAddress, 
        amount, 
        nonce: hre.useNonce()
    }
    const userSig = await signEIP712Data('TokenUnlockerApp', typeDataStake, dataStake, signer)
    await permitERC20('TuringToken', to, 'TokenUnlockerApp', 'vaultRoleB')
    const scheduleIndex = await facetStaking.getStakeSchedulesCount()
    const tx2 = await facetStaking.stake(to, tokenAddress, amount, dataStake.nonce, userSig)
    const tuitContract = await getContractWithSignerKey('TuringToken', 'nobody')

    await expect(tx2)
        .to.emit(tuitContract, 'Transfer')
        .withArgs(dataStake.userAddress, await getContractAddress('TokenUnlockerApp'), dataStake.amount)
        .to.emit(facetStaking, 'Staked')
        .withArgs(dataStake.userAddress, tokenAddress, dataStake.amount, dataStake.nonce, scheduleIndex)

    return {
        userAddress: dataStake.userAddress,
        tokenAddress,
        amount: dataStake.amount,
        scheduleIndex,
    }
}