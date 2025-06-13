# TuringM-EIP2535
<!-- 
[![Version][version-badge]][version-link]
[![License][license-badge]][license-link]
[![Test][ci-badge]][ci-link]

[version-badge]: https://img.shields.io/github/v/release/turingm-eip2535.svg?label=version
[version-link]: https://github.com/turingm-eip2535/releases
[license-badge]: https://img.shields.io/github/license/turingm-eip2535
[license-link]: https://github.com/turingm-eip2535/blob/main/LICENSE.md
[ci-badge]: https://github.com/turingm-eip2535/actions/workflows/Tests.yml/badge.svg
[ci-link]: https://github.com/turingm-eip2535/actions/workflows/Tests.yml -->

## Background

The `TuringM-EIP2535` is an EIP-2535 base smart contract framework that currently includes `TuringMarketApp` and `TokenUnlockerApp` contracts.

The `TuringMarketApp` is an exchange protocol that facilitates atomic swaps between `Conditional ERC1155 NFT Token` assets and an ERC20 collateral asset.

It is intended to be used in a hybrid-decentralized exchange model wherein there is an operator that provides offchain matching services while settlement happens on-chain, non-custodially.

The `TokenUnlockerApp` is a contract that provide users to invest/refund, stake/unstake, vote for proposal for our `TuringM DAO`.

## Documentation

This project introduces the core smart contracts for the TuringMarket and TokenUnlocker applications, built on the EIP-2535 diamond standard. The contracts include:

1. Diamond proxy and facet infrastructure
2. Core functionality facets (AccessControl, ERC1155, EIP712, Pausable, etc.)
3. TuringMarketApp with order matching, market management, and admin features
4. TokenUnlockerApp with staking, voting, vault management, and token distribution

The implementation follows best practices for upgradeable contracts and includes comprehensive storage layouts, interfaces, and base contracts to support the diamond pattern. Key features include:

- Role-based access control
- EIP-712 signed messages
- Pausable functionality
- ERC1155 token standard support
- Custom token transfer quote management
- Diamond loupe and cut functionality

The contracts are designed to be modular, upgradeable, and gas-efficient while maintaining security through extensive use of modifiers, reentrancy guards, and delegate call protections.

## Audit

These contracts have been audited by xxxx and the report is available [here](./audit/xxx.pdf).

## Deployments

| Network          | Address                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| testnet 1          | [#](https://testnet-scan.com/address/#)|


## Notices
Currently we do not provide full project testcases/docs yet, after we launch our project and get target users, we will release our testcases/docs.