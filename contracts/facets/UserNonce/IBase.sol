// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IUserNonceBase {
    event NonceUsed(address indexed userAddress, uint256 indexed nonce);
}
