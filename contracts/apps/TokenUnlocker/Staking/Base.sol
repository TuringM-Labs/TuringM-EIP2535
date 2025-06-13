// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IStakingBase} from "./IBase.sol";
import {AppStorage} from "../AppStorage.sol";
import {EIP712Base} from "../../../facets/EIP712/Base.sol";

abstract contract StakingBase is AppStorage, IStakingBase, EIP712Base {
    function _removeStakeScheduleIndex(address userAddress, uint256 index) internal {
        uint256[] storage arr = s.userStakeScheduleIdsMap[userAddress];
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == index) {
                if (i != arr.length - 1) {
                    arr[i] = arr[arr.length - 1];
                }
                arr.pop();
                return;
            }
        }
    }
}
