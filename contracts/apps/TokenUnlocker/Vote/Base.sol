// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IVoteBase} from "./IBase.sol";
import {AppStorage} from "../AppStorage.sol";
import {EIP712Base} from "../../../facets/EIP712/Base.sol";

abstract contract VoteBase is AppStorage, IVoteBase, EIP712Base {
    function _addPendingVotingPowerStakeScheduleIndex(address userAddress, uint256 scheduleIndex) internal {
        s.userPendingVotingPowerStakeScheduleIdsMap[userAddress].push(scheduleIndex);
    }

    function _removeVotingPowerFromStake(address userAddress, uint256 index, uint256 tokenAmount) internal {
        uint256[] storage arr = s.userPendingVotingPowerStakeScheduleIdsMap[userAddress];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == index) {
                if (i != arr.length - 1) {
                    arr[i] = arr[arr.length - 1];
                }
                arr.pop();
                return;
            }
        }

        s.userVotingPowerMap[userAddress] -= tokenAmount;
        s.totalVotingPower -= tokenAmount;
    }

    function _getShouldSyncPendingVotingPowerFromStakeScheduleIds(address userAddress) internal view returns (uint256[] memory ids) {
        uint256[] storage arr = s.userPendingVotingPowerStakeScheduleIdsMap[userAddress];
        ids = new uint256[](arr.length);
        uint256 validCount = 0;

        for (uint256 i = 0; i < arr.length; i++) {
            uint256 scheduleIndex = arr[i];
            StakeSchedule storage schedule = s.stakeSchedulesMap[scheduleIndex];
            if (schedule.isUnstaked == false && block.timestamp > schedule.startTime + 30 days) {
                ids[validCount] = scheduleIndex;
                validCount++;
            }
        }

        // Resize array to actual valid entries
        assembly {
            mstore(ids, validCount)
        }
        return ids;
    }
}
