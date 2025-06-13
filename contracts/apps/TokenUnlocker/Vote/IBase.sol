// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {IAppStorage} from "../IAppStorage.sol";

interface IVoteBase is IAppStorage {
    event ProposalCreated(uint256 proposalId, bytes32 descHash);
    event Voted(address indexed userAddress, uint256 proposalId, uint256 yesVotes, uint256 noVotes, uint256 nonce);
}
