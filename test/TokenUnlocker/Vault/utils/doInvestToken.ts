import { getVaultByKey } from '../../utils/getVaultByKey'

export const doInvestToken = async (userAddress, payoutKey, tokenAmount, paymentAmount, canRefundDuration, isShareRevenue, canRefund) => {
    const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VaultFacet', 'vaultRoleB')
    
    const operator = await getSignerByKey(payoutKey)
    const { vaultId } = getVaultByKey(payoutKey)

    const vault = await facet.getVault(vaultId)
    const paymentTokenAddress = vault.paymentTokenAddress
    const tokenAddress = vault.tokenAddress
    tokenAmount = parseEther(tokenAmount.toString())
    paymentAmount = parseUnits(paymentAmount.toString(), 6)

    const nonce = hre.useNonce()
    const typeDataUser = getConfig('TYPEHASH_INVEST_USER')
    const typeDataOperator = getConfig('TYPEHASH_INVEST_OPERATOR')
    const allocateParams = {
        vaultId,
        userAddress,
        tokenAmount,
        paymentAmount,
        isShareRevenue,
        canRefund,
        canRefundDuration,
        nonce,
    }

    const userSigner = await ethers.getSigner(userAddress)
    const userSig = await signEIP712Data('TokenUnlockerApp', typeDataUser, allocateParams, userSigner)
    const operatorSig = await signEIP712Data('TokenUnlockerApp', typeDataOperator, allocateParams, operator)
    await permitERC20('USDTMock', userAddress, 'TokenUnlockerApp', 'deployer')

    const unlockerAddress = await getContractAddress('TokenUnlockerApp')
    const usdtMock = await getContractWithSignerKey('USDTMock', 'deployer')
    const userBalance1 = await usdtMock.balanceOf(userAddress)
    const unlockerBalance1 = await usdtMock.balanceOf(unlockerAddress)
    const investAmount1 = await facet.getInvestAmount(userAddress)
    const tx = await facet.investToken(allocateParams, userSig, operatorSig)
    const receipt = await tx.wait()

    expect(receipt)
        .to.emit(facet, "TokenAllocated")
        .to.emit(facet, 'TokenInvested')

    // read the two event's data
    const tokenAllocatedEvent = receipt.events?.find(event => event.event === 'TokenAllocated')
    const tokenInvestedEvent = receipt.events?.find(event => event.event === 'TokenInvested')
    const tokenAllocatedArgs = _.pick(tokenAllocatedEvent?.args, ['vaultId', 'userAddress', 'scheduleIndex', 'schedule' ])
    const tokenInvestedArgs = _.pick(tokenInvestedEvent?.args, ['vaultId', 'userAddress', 'allocateParams', 'signer'])
    
    const userBalance2 = await usdtMock.balanceOf(userAddress)
    const unlockerBalance2 = await usdtMock.balanceOf(unlockerAddress)
    const investAmount2 = await facet.getInvestAmount(userAddress)

    expect(userBalance2).to.equal(userBalance1.sub(paymentAmount))
    expect(unlockerBalance1).to.equal(unlockerBalance2.sub(paymentAmount))
    expect(investAmount2).to.equal(investAmount1.add(tokenAmount))

    return {
        facet,
        paymentAmount,
        paymentTokenAddress,
        tokenAmount,
        tokenAddress,
        tokenAllocatedArgs,
        tokenInvestedArgs,
    }
}