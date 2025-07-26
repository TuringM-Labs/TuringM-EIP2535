// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Facet} from "../../../Facet.sol";
import {VaultBase} from "./Base.sol";
import {IVaultFacet} from "./IFacet.sol";
import {AccessControlBase} from "../../../facets/AccessControl/Base.sol";
import {TTOQManagerBase} from "../../../facets/TTOQManager/Base.sol";
import "../../../utils/IERC20.sol";

contract VaultFacet is IVaultFacet, VaultBase, AccessControlBase, TTOQManagerBase, Facet {
    function VaultFacet_init(uint8 roleA, uint8 roleB, uint8 roleC) external onlyInitializing {
        // A Level Security role
        _setFunctionAccess(this.adminWithdrawPaymentToken.selector, roleA, true);
        _setFunctionAccess(this.adminUpdateVaultOperator.selector, roleA, true);
        // B Level Security role
        _setFunctionAccess(this.investToken.selector, roleB, true);
        _setFunctionAccess(this.allocateLinearUnlockedTokens.selector, roleB, true);
        _setFunctionAccess(this.payoutToken.selector, roleB, true);
        _setFunctionAccess(this.payoutTokenAndLinearUnlock.selector, roleB, true);
        _setFunctionAccess(this.claimUnlockedTokens.selector, roleB, true);
        _setFunctionAccess(this.quitInvestRefund.selector, roleB, true);
        _setFunctionAccess(this.doInvestRefund.selector, roleB, true);
        // C Level Security role
        _setFunctionAccess(this.createVault.selector, roleC, true);
        _setFunctionAccess(this.depositToken.selector, roleC, true);

        _addInterface(type(IVaultFacet).interfaceId);
    }

    function adminWithdrawPaymentToken(address paymentToken, uint256 amount, address to) external whenNotPaused protected nonReentrant {
        _isPayoutDisabled();
        require(s.withdrawablePaymentTokenMap[paymentToken] >= amount, "Insufficient balance");
        s.withdrawablePaymentTokenMap[paymentToken] -= amount;
        _tokenTransferOutQuoteCheck("adminWithdrawPaymentToken", paymentToken, amount);
        require(IERC20(paymentToken).transfer(to, amount), "Transfer failed");
    }

    function adminUpdateVaultOperator(uint256 vaultId, address operator) external whenNotPaused protected {
        require(vaultId < s.vaultsCount, "Invalid vault id");
        s.vaultsMap[vaultId].operator = operator;
        emit VaultOperatorUpdated(vaultId, operator);
    }

    function createVault(Vault memory vault_) external whenNotPaused protected nonReentrant returns (uint256 vaultId) {
        address paymentTokenAddress = address(0);
        if (vault_.vaultType == VaultType.Vc) {
            require(vault_.paymentTokenAddress != address(0), "Invalid payment token address");
            paymentTokenAddress = vault_.paymentTokenAddress;
        }
        Vault memory vault = Vault({
            name: vault_.name,
            vaultType: vault_.vaultType, // vc, linearUnlocked, payout
            tokenAddress: vault_.tokenAddress,
            operator: vault_.operator,
            createdAt: block.timestamp,
            totalDeposit: 0, // How many tokens are deposited
            balance: 0, // Current vault balance
            // payout
            totalPayout: 0, // How many tokens are spent
            // vc
            canShareRevenue: vault_.canShareRevenue, // Is it the token share of the profit that vc invested in
            unlockedSince: vault_.unlockedSince, // This is just the calculation time starting point, not the unlocking time starting point. The unlocking time starting point is this time + 365 days
            unlockedDuration: vault_.unlockedDuration, // 360*3 days;
            paymentTokenAddress: paymentTokenAddress, // Payment token address, only for Vc vault type
            allocatedAmount: 0, // total allocated token amount
            paymentAmount: 0, // vc pay StableCoin, get token, this is the total income in StableCoin, not token
            // vc and linearUnlocked
            claimedAmount: 0 // How many tokens have been claimed after expiration
        });
        vaultId = s.vaultsCount;
        s.vaultsCount++;
        s.vaultsMap[vaultId] = vault;
        emit VaultCreated(vaultId, vault.name, vault.vaultType, vault.tokenAddress, paymentTokenAddress, vault.operator);
        return vaultId;
    }

    function depositToken(uint256 vaultId, uint256 amount) external protected whenNotPaused nonReentrant {
        require(vaultId < s.vaultsCount, "Invalid vault id");
        Vault storage vault = s.vaultsMap[vaultId];
        require(IERC20(vault.tokenAddress).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        vault.balance += amount;
        vault.totalDeposit += amount;
        emit TokenDeposited(msg.sender, vaultId, vault.tokenAddress, amount);
    }

    function investToken(
        AllocateParams memory allocateParams,
        bytes memory userSig,
        bytes memory operatorSig
    ) external protected whenNotPaused nonReentrant {
        uint256 vaultId = allocateParams.vaultId;
        address userAddress = allocateParams.userAddress;
        uint256 tokenAmount = allocateParams.tokenAmount;
        uint256 paymentAmount = allocateParams.paymentAmount;
        bool canRefund = allocateParams.canRefund;
        bool isShareRevenue = allocateParams.isShareRevenue;
        uint256 canRefundDuration = allocateParams.canRefundDuration;
        uint256 nonce = allocateParams.nonce;
        require(tokenAmount > 0 && paymentAmount > 0, "Invalid token amount or payment amount");
        require(tokenAmount <= paymentAmount * 2 * 1e13, "Token price must be at least 0.05");
        _useNonce(userAddress, nonce);
        _validateVault(vaultId, VaultType.Vc);

        Vault storage vault = s.vaultsMap[vaultId];
        require(vault.balance >= tokenAmount, "Insufficient vault balance");
        vault.balance -= tokenAmount;
        vault.allocatedAmount += tokenAmount;
        vault.paymentAmount += paymentAmount;
        _useNonce(vault.operator, nonce);

        bytes memory encodedDataUser = abi.encode(
            TYPEHASH_INVEST_USER,
            vaultId,
            userAddress,
            tokenAmount,
            paymentAmount,
            isShareRevenue,
            canRefund,
            canRefundDuration,
            nonce
        );
        _verifySignature(userAddress, userSig, encodedDataUser);
        bytes memory encodedDataOperator = abi.encode(
            TYPEHASH_INVEST_OPERATOR,
            vaultId,
            userAddress,
            tokenAmount,
            paymentAmount,
            isShareRevenue,
            canRefund,
            canRefundDuration,
            nonce
        );
        _verifySignature(vault.operator, operatorSig, encodedDataOperator);

        require(IERC20(vault.paymentTokenAddress).transferFrom(userAddress, address(this), paymentAmount), "Transfer payment token failed");
        _allocateTokens(allocateParams);

        s.totalInvestTokenAmount += tokenAmount;
        s.userInvestAmount[userAddress] += tokenAmount;
        // only can not refund schedule can have votingPower
        if (canRefund == false) {
            s.userVotingPowerMap[userAddress] += tokenAmount;
            s.totalVotingPower += tokenAmount;
            s.withdrawablePaymentTokenMap[vault.paymentTokenAddress] += paymentAmount;
            if (isShareRevenue) {
                s.userShareRevenueBalance[userAddress] += tokenAmount;
                s.totalShareRevenueAmount += tokenAmount;
            }
        }

        emit TokenInvested(vaultId, userAddress, allocateParams, vault.operator);
    }

    function allocateLinearUnlockedTokens(
        AllocateParams memory allocateParams,
        bytes memory operatorSig
    ) external protected whenNotPaused nonReentrant {
        uint256 vaultId = allocateParams.vaultId;
        address userAddress = allocateParams.userAddress;
        uint256 tokenAmount = allocateParams.tokenAmount;
        uint256 paymentAmount = allocateParams.paymentAmount;
        bool canRefund = allocateParams.canRefund;
        uint256 canRefundDuration = allocateParams.canRefundDuration;
        uint256 nonce = allocateParams.nonce;

        require(userAddress != address(0), "User address should not be zero address");
        require(tokenAmount > 0, "Token amount should be greater than zero");
        require(paymentAmount == 0, "Payment amount should be zero");
        require(canRefund == false, "Can refund should be false");

        _validateVault(vaultId, VaultType.LinearUnlocked);
        Vault storage vault = s.vaultsMap[vaultId];

        require(vault.balance >= tokenAmount, "Insufficient vault balance");
        vault.balance -= tokenAmount;
        vault.allocatedAmount += tokenAmount;

        bytes memory encodedDataOperator = abi.encode(
            TYPEHASH_ALLOCATE_LINEAR_UNLOCKED_TOKENS,
            vaultId,
            userAddress,
            tokenAmount,
            paymentAmount,
            canRefund,
            canRefundDuration,
            nonce
        );
        _verifySignature(vault.operator, operatorSig, encodedDataOperator);
        _useNonce(vault.operator, nonce);
        _allocateTokens(allocateParams);

        s.userVotingPowerMap[userAddress] += tokenAmount;
        s.totalVotingPower += tokenAmount;
    }

    function payoutToken(
        uint256 vaultId,
        address to,
        uint256 amount,
        string memory reason,
        uint256 nonce,
        bytes memory operatorSig
    ) external protected whenNotPaused nonReentrant {
        _isPayoutDisabled();
        _validateVault(vaultId, VaultType.Payout);

        Vault storage vault = s.vaultsMap[vaultId];
        _useNonce(vault.operator, nonce);
        require(vault.balance >= amount, "Insufficient balance");
        vault.balance -= amount;
        vault.totalPayout += amount;

        bytes memory encodedDataOperator = abi.encode(TYPEHASH_PAYOUT, vaultId, to, amount, keccak256(bytes(reason)), nonce);
        _verifySignature(vault.operator, operatorSig, encodedDataOperator);
        _tokenTransferOutQuoteCheck("payoutToken", vault.tokenAddress, amount);
        require(IERC20(vault.tokenAddress).transfer(to, amount), "Transfer failed");
        emit TokenPaid(vaultId, to, amount, reason, nonce, vault.operator);
    }

    function payoutTokenAndLinearUnlock(
        AllocateParams memory allocateParams,
        string memory reason,
        bytes memory operatorSig
    ) external protected whenNotPaused nonReentrant {
        _isPayoutDisabled();
        uint256 vaultId = allocateParams.vaultId;
        address userAddress = allocateParams.userAddress;
        uint256 tokenAmount = allocateParams.tokenAmount;
        require(allocateParams.paymentAmount == 0, "Payment amount should be zero");
        require(allocateParams.canRefund == false, "Can refund should be false");
        require(allocateParams.canRefundDuration == 0, "Can refund duration should be zero");

        uint256 nonce = allocateParams.nonce;
        _validateVault(vaultId, VaultType.Payout);

        Vault storage vault = s.vaultsMap[vaultId];
        _useNonce(vault.operator, nonce);
        require(vault.balance >= tokenAmount, "Insufficient balance");
        vault.balance -= tokenAmount;
        vault.totalPayout += tokenAmount;

        bytes memory encodedDataOperator = abi.encode(TYPEHASH_PAYOUT_AND_LOCK, vaultId, userAddress, tokenAmount, keccak256(bytes(reason)), nonce);
        _verifySignature(vault.operator, operatorSig, encodedDataOperator);
        _tokenTransferOutQuoteCheck("payoutToken", vault.tokenAddress, tokenAmount);
        _allocateTokens(allocateParams);
        emit TokenPaid(vaultId, userAddress, tokenAmount, reason, nonce, vault.operator);
    }

    function claimUnlockedTokens(
        uint256 scheduleId,
        uint256 amount,
        uint256 nonce,
        bytes memory userSig
    ) external protected whenNotPaused nonReentrant {
        _isPayoutDisabled();
        require(scheduleId < s.unlockedSchedulesCount, "Invalid schedule id");
        UnlockedSchedule storage schedule = s.unlockedSchedulesMap[scheduleId];
        require(schedule.hasRefunded == false, "Schedule already refunded");

        address userAddress = schedule.userAddress;

        bytes memory encodedDataUser = abi.encode(TYPEHASH_CLAIM_UNLOCKED_TOKEN, scheduleId, amount, nonce);
        _verifySignature(userAddress, userSig, encodedDataUser);
        _useNonce(userAddress, nonce);

        uint256 availableAmount = schedule.allocationAmount - schedule.claimedAmount;
        require(availableAmount > 0 && availableAmount >= amount, "Insufficient availableAmount");

        // calculate canClaimAmount
        uint256 timestamp = block.timestamp;
        uint256 canUnlockedAmount = _calcCanUnlockedAmount(schedule, timestamp);
        uint256 canClaimAmount = canUnlockedAmount - schedule.claimedAmount;
        require(canClaimAmount >= amount, "Insufficient canClaimAmount");
        schedule.claimedAmount += amount;

        Vault storage vault = s.vaultsMap[schedule.vaultId];
        require(vault.balance >= amount, "Insufficient vault balance");
        vault.balance -= amount;
        _tokenTransferOutQuoteCheck("claimUnlockedTokens", vault.tokenAddress, amount);
        require(IERC20(vault.tokenAddress).transfer(userAddress, amount), "Transfer failed");

        s.userBalance[userAddress] -= amount;

        if (schedule.isShareRevenue) {
            s.userShareRevenueBalance[userAddress] -= amount;
            s.totalShareRevenueAmount -= amount;
            require(s.userShareRevenueBalance[userAddress] >= 0, "Insufficient userShareRevenueBalance");
        }
        vault.claimedAmount += amount;

        s.userVotingPowerMap[userAddress] -= amount;
        s.totalVotingPower -= amount;

        emit TokenClaimed(schedule.vaultId, userAddress, amount, schedule.startTime, schedule.duration, block.timestamp);
    }

    // user want to quit invest refund, so user can claim profit and have voting power for the investment
    function quitInvestRefund(uint256 scheduleId, uint256 nonce, bytes memory userSig) external protected whenNotPaused nonReentrant {
        require(scheduleId < s.unlockedSchedulesCount, "Invalid schedule id");
        UnlockedSchedule storage schedule = s.unlockedSchedulesMap[scheduleId];
        require(schedule.canRefund == true, "This investment is non-refundable");
        schedule.canRefund = false;

        address userAddress = schedule.userAddress;

        bytes memory encodedDataUser = abi.encode(TYPEHASH_INVEST_QUIT_REFUND, scheduleId, nonce);
        _verifySignature(userAddress, userSig, encodedDataUser);
        _useNonce(userAddress, nonce);
        s.userVotingPowerMap[userAddress] += schedule.allocationAmount;
        s.totalVotingPower += schedule.allocationAmount;
        if (schedule.isShareRevenue) {
            s.userShareRevenueBalance[userAddress] += schedule.allocationAmount;
            s.totalShareRevenueAmount += schedule.allocationAmount;
        }

        Vault storage vault = s.vaultsMap[schedule.vaultId];
        s.withdrawablePaymentTokenMap[vault.paymentTokenAddress] += schedule.paymentAmount;
    }

    function doInvestRefund(uint256 scheduleId, uint256 nonce, bytes memory userSig) external protected whenNotPaused nonReentrant {
        _isPayoutDisabled();
        require(scheduleId < s.unlockedSchedulesCount, "Invalid schedule id");
        UnlockedSchedule storage schedule = s.unlockedSchedulesMap[scheduleId];
        require(schedule.hasRefunded == false, "This investment has already been refunded");
        schedule.hasRefunded = true;
        require(schedule.canRefund == true, "This investment is non-refundable");
        schedule.canRefund = false;

        require((schedule.startTime + schedule.canRefundDuration) < block.timestamp, "Refund waiting time span not reach yet");

        address userAddress = schedule.userAddress;

        bytes memory encodedDataUser = abi.encode(TYPEHASH_INVEST_DO_REFUND, scheduleId, nonce);
        _verifySignature(userAddress, userSig, encodedDataUser);
        _useNonce(userAddress, nonce);

        Vault storage vault = s.vaultsMap[schedule.vaultId];

        s.userInvestAmount[userAddress] -= schedule.allocationAmount;
        s.totalInvestTokenAmount -= schedule.allocationAmount;

        // return user's payment
        require(vault.paymentAmount >= schedule.paymentAmount, "Insufficient payment balance");
        vault.paymentAmount -= schedule.paymentAmount;
        // security check
        _tokenTransferOutQuoteCheck("doInvestRefund", vault.paymentTokenAddress, schedule.paymentAmount);
        require(IERC20(vault.paymentTokenAddress).transfer(userAddress, schedule.paymentAmount), "Refund transfer failed");
        // add token amount back to vault
        vault.balance += schedule.allocationAmount;
        vault.allocatedAmount -= schedule.allocationAmount;
        emit TokenRefunded(schedule.vaultId, scheduleId, userAddress, schedule.allocationAmount, schedule.paymentAmount, schedule);
    }

    // getters
    function getVault(uint256 vaultId) external view returns (Vault memory vault) {
        vault = s.vaultsMap[vaultId];
        return vault;
    }

    function getUserUnlockedSchedulesList(
        address user,
        uint256 page,
        uint256 pageSize
    ) external view returns (UnlockedSchedule[] memory schedules, uint256 count) {
        uint256[] memory scheduleIds = s.userUnlockedScheduleIdsMap[user];
        require(page > 0, "Invalid page");
        require(pageSize > 0, "Invalid pageSize");

        count = scheduleIds.length;
        uint256 start = (page - 1) * pageSize;
        if (start >= scheduleIds.length) {
            return (new UnlockedSchedule[](0), 0);
        }

        uint256 end = start + pageSize;
        if (end > scheduleIds.length) {
            end = scheduleIds.length;
        }

        schedules = new UnlockedSchedule[](end - start);
        for (uint256 i = start; i < end; i++) {
            uint256 scheduleIndex = scheduleIds[i];
            require(scheduleIndex < s.unlockedSchedulesCount, "Invalid schedule ID");
            schedules[i - start] = s.unlockedSchedulesMap[scheduleIndex];
        }

        return (schedules, count);
    }

    function getUnlockedSchedule(
        uint256 scheduleId,
        uint256 timestamp
    ) external view returns (UnlockedSchedule memory schedule, uint256 canUnlockedAmount) {
        require(scheduleId < s.unlockedSchedulesCount, "Invalid schedule ID");
        schedule = s.unlockedSchedulesMap[scheduleId];
        canUnlockedAmount = _calcCanUnlockedAmount(schedule, timestamp);
        return (schedule, canUnlockedAmount);
    }

    function getInvestAmount(address user) external view returns (uint256 amount) {
        return s.userInvestAmount[user];
    }

    // User balance, including available and unclaimed balance
    function getUserBalance(address user) external view returns (uint256 amount) {
        return s.userBalance[user];
    }

    // The token balance that users can share profits with will decrease as users claim
    function getShareRevenueTokenBalance(address user) external view returns (uint256 amount) {
        return s.userShareRevenueBalance[user];
    }

    function getTotalShareRevenueAmount() external view returns (uint256 amount) {
        return s.totalShareRevenueAmount;
    }

    function getTotalInvestTokenAmount() external view returns (uint256 amount) {
        return s.totalInvestTokenAmount;
    }

    function getWithdrawablePaymentTokenAmount(address tokenAddress) external view returns (uint256 amount) {
        return s.withdrawablePaymentTokenMap[tokenAddress];
    }

    function getVaultsCount() external view returns (uint256 count) {
        return s.vaultsCount;
    }

    function getUnlockedSchedulesCount() external view returns (uint256 count) {
        return s.unlockedSchedulesCount;
    }
}
