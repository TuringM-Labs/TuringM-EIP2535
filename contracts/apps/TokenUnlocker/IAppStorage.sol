// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IAppStorage {
    enum VaultType {
        Vc, // Linear unlock, get after payment
        LinearUnlocked, // Linear unlock, can be directly allocated
        Payout // Can be directly allocated and circulated
    }

    struct Vault {
        string name;
        VaultType vaultType;
        address tokenAddress;
        address operator;
        uint256 createdAt;
        uint256 totalDeposit;
        uint256 balance;
        // for payout
        uint256 totalPayout; // vault direct payout, only for payout vault type, not for vc or linearUnlocked
        // for vc
        bool isShareProfit; // Is it the token share of the profit that vc invested in?
        // This is only the starting point of the calculation time, not the starting point of the unlocking time.
        // The starting point of the unlocking time is this time + 365 days
        uint256 unlockedSince;
        // How many years will it take to unlock linearly? This does not include the lock-up period of the first year.
        // 365*4 days means that after the lock-up period of the first year, the 4-year linear unlocking is completed
        uint256 unlockedDuration;
        address paymentTokenAddress;
        // total allocated token amount, vc is for sold, and linearUnlocked is for direct allocation
        uint256 allocatedAmount;
        // vc pay StableCoin, get token, this is the total income in StableCoin, not token
        uint256 paymentAmount;
        // for vc and linearUnlocked
        // claimed amount for vc and linearUnlocked vault type
        uint256 claimedAmount;
    }

    struct AllocateParams {
        uint256 vaultId;
        address userAddress;
        uint256 tokenAmount;
        uint256 paymentAmount;
        bool canRefund;
        uint256 canRefundDuration;
        uint256 nonce;
    }

    struct UnlockedSchedule {
        uint256 vaultId;
        address userAddress;
        uint256 allocationAmount;
        uint256 claimedAmount;
        uint256 startTime;
        uint256 duration;
        uint256 paymentAmount;
        bool isShareProfit; // whether it is the token share of profit that vc invested
        bool canRefund;
        uint256 canRefundDuration;
        bool hasRefunded;
    }

    struct StakeSchedule {
        address userAddress;
        address tokenAddress;
        uint256 amount;
        uint256 startTime;
        bool isUnstaked;
    }

    struct Proposal {
        bytes32 descHash;
        uint256 startTime;
        uint256 duration;
        uint256 yesVotes;
        uint256 noVotes;
    }

    struct VoteParams {
        uint256 proposalId;
        address userAddress;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 nonce;
    }
}
