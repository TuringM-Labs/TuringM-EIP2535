// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;
import {IAppStorage} from "../IAppStorage.sol";

interface IStakingBase is IAppStorage {
    event StakingTokenStatusUpdated(address indexed tokenAddress, bool isEnabled);
    event Staked(address indexed userAddress, address tokenAddress, uint256 amount, uint256 nonce, uint256 scheduleIndex);
    event Unstaked(address indexed userAddress, address tokenAddress, uint256 amount, uint256 nonce, uint256 scheduleIndex);
}
