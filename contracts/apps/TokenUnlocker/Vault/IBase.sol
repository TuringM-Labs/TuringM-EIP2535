// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {IAppStorage} from "../IAppStorage.sol";

interface IVaultBase is IAppStorage {
    event VaultCreated(
        uint256 indexed vaultId,
        string name,
        VaultType vaultType,
        address indexed tokenAddress,
        address paymentTokenAddress,
        address indexed operator
    );
    event VaultOperatorUpdated(uint256 indexed vaultId, address indexed operator);
    event TokenDeposited(address indexed user, uint256 indexed vaultId, address indexed tokenAddress, uint256 amount);
    event TokenPaid(uint256 indexed vaultId, address indexed to, uint256 amount, string reason, uint256 nonce, address indexed operator);
    event TokenAllocated(uint256 indexed vaultId, uint256 scheduleIndex, address indexed userAddress, UnlockedSchedule schedule);
    event TokenInvested(uint256 indexed vaultId, address indexed userAddress, AllocateParams allocateParams, address signer);
    event TokenRefunded(
        uint256 indexed vaultId,
        uint256 scheduleIndex,
        address indexed userAddress,
        uint256 allocationAmount,
        uint256 paymentAmount,
        UnlockedSchedule schedule
    );
    event TokenClaimed(uint256 indexed vaultId, address indexed to, uint256 amount, uint256 startTime, uint256 duration, uint256 timestamp);
}
