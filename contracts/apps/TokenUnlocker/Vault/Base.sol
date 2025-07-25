// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IVaultBase} from "./IBase.sol";
import {AppStorage} from "../AppStorage.sol";
import {EIP712Base} from "../../../facets/EIP712/Base.sol";
import {UserNonceBase} from "../../../facets/UserNonce/Base.sol";

abstract contract VaultBase is AppStorage, IVaultBase, UserNonceBase, EIP712Base {
    function _calcCanUnlockedAmount(UnlockedSchedule memory schedule, uint256 timestamp) internal pure returns (uint256) {
        if (schedule.canRefund) {
            return 0;
        }
        // The first year is locked
        uint256 unlockingStartTime = schedule.startTime + 365 days;
        if (unlockingStartTime > timestamp) {
            return 0;
        }

        uint256 totalMonths = schedule.duration / 30 days;
        require(totalMonths > 0, "Duration too short");

        uint256 baseAmount = schedule.allocationAmount / ((totalMonths * (totalMonths + 1)) / 2);

        uint256 elapsed = timestamp - unlockingStartTime;
        uint256 monthsPassed = elapsed / 30 days;

        if (monthsPassed >= totalMonths) {
            return schedule.allocationAmount;
        }

        uint256 daysInCurrentMonth = elapsed % 30 days;
        uint256 currentMonthRatio = (daysInCurrentMonth * 1e18) / 30 days;

        uint256 totalReleased = baseAmount * ((monthsPassed * (monthsPassed + 1)) / 2);

        totalReleased += (baseAmount * (monthsPassed + 1) * currentMonthRatio) / 1e18;

        return totalReleased > schedule.allocationAmount ? schedule.allocationAmount : totalReleased;
    }

    function _validateVault(uint256 vaultId, VaultType vaultType) internal view {
        require(vaultId < s.vaultsCount, "Invalid vault id");
        require(s.vaultsMap[vaultId].vaultType == vaultType, "Invalid vault type");
    }

    function _allocateTokens(AllocateParams memory allocateParams) internal {
        uint256 vaultId = allocateParams.vaultId;
        Vault storage vault = s.vaultsMap[vaultId];
        uint256 startTime = block.timestamp;
        if (vault.unlockedSince > block.timestamp) {
            startTime = vault.unlockedSince;
        }
        address userAddress = allocateParams.userAddress;
        uint256 allocationAmount = allocateParams.tokenAmount;
        bool isShareRevenue = allocateParams.isShareRevenue;
        if (isShareRevenue) {
            require(vault.canShareRevenue, "can not share revenue");
        }

        UnlockedSchedule memory schedule = UnlockedSchedule({
            vaultId: vaultId,
            userAddress: userAddress,
            allocationAmount: allocationAmount,
            claimedAmount: 0,
            startTime: startTime,
            duration: vault.unlockedDuration,
            paymentAmount: allocateParams.paymentAmount,
            isShareRevenue: isShareRevenue,
            canRefund: allocateParams.canRefund,
            canRefundDuration: allocateParams.canRefundDuration,
            hasRefunded: false
        });

        uint256 scheduleIndex = s.unlockedSchedulesCount;
        s.unlockedSchedulesCount++;
        s.unlockedSchedulesMap[scheduleIndex] = schedule;
        s.userBalance[userAddress] += allocationAmount; // Record the user's balance in the token management contract
        s.userUnlockedScheduleIdsMap[userAddress].push(scheduleIndex); // Record the unlocking plan of this user

        emit TokenAllocated(vaultId, scheduleIndex, userAddress, schedule);
    }
}
