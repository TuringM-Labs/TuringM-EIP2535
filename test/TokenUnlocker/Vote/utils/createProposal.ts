export const createProposal = async (desc) => {
    const facet = await getFacetWithSignerKey('TokenUnlockerApp', 'VoteFacet', 'voteRoleC')
       
    const descHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(desc))
    const duration = 3600 * 24 * 7
    const proposalId = await facet.getProposalsCount();
    await expect(facet.createProposal(descHash, duration))
        .to.emit(facet, "ProposalCreated")
        .withArgs(proposalId, descHash);
    
    return {
        proposalId,
    }
}
