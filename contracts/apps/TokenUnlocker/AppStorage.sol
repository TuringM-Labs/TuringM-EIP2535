// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {IAppStorage} from "./IAppStorage.sol";

contract AppStorage is IAppStorage {
    struct Storage {
        // vault
        uint256 vaultsCount;
        mapping(uint256 => Vault) vaultsMap;
        uint256 unlockedSchedulesCount;
        mapping(uint256 => UnlockedSchedule) unlockedSchedulesMap;
        mapping(address => uint256[]) userUnlockedScheduleIdsMap; // user => scheduleId[]: All unlock plans for the user
        mapping(address => uint256) userInvestAmount; // user => amount: The total amount of user's cumulative investment
        mapping(address => uint256) userBalance; // user => balance: The user's balance in the token management contract
        mapping(address => uint256) userShareProfitBalance; // user => balance: The user's shareable profit balance in the token management contract will decrease as the user claims
        uint256 totalInvestTokenAmount; // The total number of tokens invested by all users is used to calculate the proportion of profits that users can share
        mapping(address => uint256) withdrawablePaymentTokenMap; // paymentTokenAddress => balance: how much payment token can be withdrawn by admin
        // staking
        mapping(address => bool) enabledStakingTokenMap; // token => true: staking token
        mapping(address => uint256) totalStakingAmountMap; // token => balance: The balance of the staking token in the token management contract
        mapping(address => mapping(address => uint256)) userStakingAmountMap; // tokenAddress => (userAddress => amount): The total amount of user's cumulative staking
        uint256 stakeSchedulesCount;
        mapping(uint256 => StakeSchedule) stakeSchedulesMap; // scheduleId => StakeSchedule: All stake plans
        mapping(address => uint256[]) userStakeScheduleIdsMap; // userAddress => scheduleId[]: All staking plans for the user
        // voting
        uint256 proposalsCount;
        mapping(uint256 => Proposal) proposalsMap; // proposalId => Proposal: All proposals
        mapping(bytes32 => bool) proposalDescHashMap; // descHash => true: proposal desc hash
        mapping(address => mapping(uint256 => bool)) userVotedProposalMap; // userAddress => (proposalId => bool)
        mapping(address => uint256[]) userPendingVotingPowerStakeScheduleIdsMap; // userAddress => scheduleId[]: All pending sync voting power staking plans for the user
        mapping(address => uint256) userVotingPowerMap; // userAddress => votingPower: The user's voting power
        uint256 totalVotingPower; // The total voting power of all users
        bool isPayoutDisabled;
    }
    Storage internal s;
    // TYPEHASH
    bytes32 constant TYPEHASH_PAYOUT = keccak256("Payout(uint256 vaultId,address to,uint256 amount,string reason,uint256 nonce)");
    bytes32 constant TYPEHASH_CLAIM_UNLOCKED_TOKEN = keccak256("ClaimUnlockedToken(uint256 scheduleId,uint256 amount,uint256 nonce)");
    bytes32 constant TYPEHASH_ALLOCATE_LINEAR_UNLOCKED_TOKENS =
        keccak256(
            "AllocateLinearUnlockedTokens(uint256 vaultId,address userAddress,uint256 tokenAmount,uint256 paymentAmount,bool canRefund,uint256 canRefundDuration,uint256 nonce)"
        );
    bytes32 constant TYPEHASH_INVEST_USER =
        keccak256(
            "InvestUser(uint256 vaultId,address userAddress,uint256 tokenAmount,uint256 paymentAmount,bool canRefund,uint256 canRefundDuration,uint256 nonce)"
        );
    bytes32 constant TYPEHASH_INVEST_OPERATOR =
        keccak256(
            "InvestOperator(uint256 vaultId,address userAddress,uint256 tokenAmount,uint256 paymentAmount,bool canRefund,uint256 canRefundDuration,uint256 nonce)"
        );
    bytes32 constant TYPEHASH_STAKE = keccak256("Stake(address userAddress,address tokenAddress,uint256 amount,uint256 nonce)");
    bytes32 constant TYPEHASH_UNSTAKE = keccak256("Unstake(uint256 scheduleIndex,uint256 nonce)");
    bytes32 constant TYPEHASH_VOTE = keccak256("Vote(uint256 proposalId,address userAddress,uint256 yesVotes,uint256 noVotes,uint256 nonce)");
    bytes32 constant TYPEHASH_INVEST_QUIT_REFUND = keccak256("QuitInvestRefund(uint256 scheduleId,uint256 nonce)");
    bytes32 constant TYPEHASH_INVEST_DO_REFUND = keccak256("DoInvestRefund(uint256 scheduleId,uint256 nonce)");
}
