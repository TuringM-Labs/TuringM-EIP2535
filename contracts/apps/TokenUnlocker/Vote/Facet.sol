// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Facet} from "../../../Facet.sol";
import {VoteBase} from "./Base.sol";
import {IVoteFacet} from "./IFacet.sol";
import {UserNonceBase} from "../../../facets/UserNonce/Base.sol";
import {AccessControlBase} from "../../../facets/AccessControl/Base.sol";
import "../../../utils/IERC20.sol";

contract VoteFacet is IVoteFacet, VoteBase, AccessControlBase, UserNonceBase, Facet {
    function VoteFacet_init(uint8 roleC) external onlyInitializing {
        _setFunctionAccess(this.createProposal.selector, roleC, true);
        _setFunctionAccess(this.vote.selector, roleC, true);
        _setFunctionAccess(this.syncVotingPowerFromStakeScheduleIds.selector, roleC, true);

        _addInterface(type(IVoteFacet).interfaceId);
    }

    // bytes32 public descHash = keccak256(bytes(desc));
    function createProposal(bytes32 descHash, uint256 duration) external protected {
        require(descHash != bytes32(0), "Description cannot be empty");
        require(duration > 0, "Voting duration must be greater than 0");
        require(s.proposalDescHashMap[descHash] == false, "Description hash already exists");
        s.proposalDescHashMap[descHash] = true;
        uint256 proposalId = s.proposalsCount;
        s.proposalsCount++;
        s.proposalsMap[proposalId] = Proposal({descHash: descHash, startTime: block.timestamp, duration: duration, yesVotes: 0, noVotes: 0});
        emit ProposalCreated(proposalId, descHash);
    }

    function vote(VoteParams memory params, bytes memory userSig) external protected {
        uint256 proposalId = params.proposalId;
        address userAddress = params.userAddress;
        uint256 yesVotes = params.yesVotes;
        uint256 noVotes = params.noVotes;
        uint256 nonce = params.nonce;

        require(0 <= proposalId && proposalId < s.proposalsCount, "Invalid proposal id");
        Proposal storage proposal = s.proposalsMap[proposalId];
        uint256 startTime = proposal.startTime;
        uint256 duration = proposal.duration;
        require(startTime + duration > block.timestamp, "Voting period has ended");

        _useNonce(userAddress, nonce);
        require(yesVotes >= 0 && noVotes >= 0, "yes and no votes must be non-negative");
        require(s.userVotedProposalMap[userAddress][proposalId] == false, "User has already voted on this proposal");
        s.userVotedProposalMap[userAddress][proposalId] = true;
        _verifySignature(userAddress, userSig, abi.encode(TYPEHASH_VOTE, proposalId, userAddress, yesVotes, noVotes, nonce));

        require((yesVotes + noVotes) <= s.userVotingPowerMap[userAddress], "Insufficient voting power");

        proposal.yesVotes += yesVotes;
        proposal.noVotes += noVotes;

        emit Voted(userAddress, proposalId, yesVotes, noVotes, nonce);
    }

    function syncVotingPowerFromStakeScheduleIds(address userAddress, uint256 stakeScheduleId) external protected {
        uint256[] storage arr = s.userPendingVotingPowerStakeScheduleIdsMap[userAddress];
        for (uint256 i = 0; i < arr.length; i++) {
            if (stakeScheduleId == arr[i]) {
                StakeSchedule storage schedule = s.stakeSchedulesMap[stakeScheduleId];
                require(schedule.userAddress == userAddress, "Invalid user address");
                require(schedule.isUnstaked == false, "Stake has been unstaked");
                require(schedule.startTime + 30 days < block.timestamp, "Stake should over 30 days");
                if (i != arr.length - 1) {
                    arr[i] = arr[arr.length - 1];
                }
                arr.pop();
                s.userVotingPowerMap[userAddress] += schedule.amount;
                s.totalVotingPower += schedule.amount;
                return;
            }
        }
    }

    // getter
    function getVotingPower(address userAddress) external view returns (uint256) {
        return s.userVotingPowerMap[userAddress];
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return s.proposalsMap[proposalId];
    }

    function getShouldSyncPendingVotingPowerFromStakeScheduleIds(address userAddress) external view returns (uint256[] memory ids) {
        return _getShouldSyncPendingVotingPowerFromStakeScheduleIds(userAddress);
    }
}
