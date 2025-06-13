// SPDX-License-Identifier: MIT License
pragma solidity 0.8.20;

import {Facet} from "../../Facet.sol";
import {AccessControlBase} from "./Base.sol";
import {IAccessControlFacet} from "./IFacet.sol";
import {ROLE_SUPER_ADMIN} from "../../Constants.sol";

contract AccessControlFacet is IAccessControlFacet, AccessControlBase, Facet {
    function AccessControlFacet_init(address superAdminAddress) external onlyInitializing {
        _setUserRole(superAdminAddress, ROLE_SUPER_ADMIN, true);
        _setFunctionAccess(this.setFunctionAccess.selector, ROLE_SUPER_ADMIN, true);
        _setFunctionAccess(this.setUserRole.selector, ROLE_SUPER_ADMIN, true);

        _addInterface(type(IAccessControlFacet).interfaceId);
    }

    /// @inheritdoc IAccessControlFacet
    function setFunctionAccess(bytes4 functionSig, uint8 role, bool enabled) external onlyAuthorized {
        _setFunctionAccess(functionSig, role, enabled);
    }

    /// @inheritdoc IAccessControlFacet
    function setUserRole(address user, uint8 role, bool enabled) external onlyAuthorized {
        _setUserRole(user, role, enabled);
    }

    /// @inheritdoc IAccessControlFacet
    function canCall(address user, bytes4 functionSig) external view returns (bool) {
        return _canCall(user, functionSig);
    }

    /// @inheritdoc IAccessControlFacet
    function userRoles(address user) external view returns (bytes32) {
        return _userRoles(user);
    }

    /// @inheritdoc IAccessControlFacet
    function functionRoles(bytes4 functionSig) external view returns (bytes32) {
        return _functionRoles(functionSig);
    }

    /// @inheritdoc IAccessControlFacet
    function hasRole(address user, uint8 role) external view returns (bool) {
        return _hasRole(user, role);
    }

    /// @inheritdoc IAccessControlFacet
    function roleHasAccess(uint8 role, bytes4 functionSig) external view returns (bool) {
        return _roleHasAccess(role, functionSig);
    }
}
