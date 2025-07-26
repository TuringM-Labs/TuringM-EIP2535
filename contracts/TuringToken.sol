// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TuringToken is ERC20, ERC20Permit {
    uint8 private constant _DECIMALS = 18;

    constructor(address vaultDepositorAddress, uint256 totalSupply) ERC20("Turing Token", "TUIT") ERC20Permit("Turing Token") {
        _mint(vaultDepositorAddress, totalSupply);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
