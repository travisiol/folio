// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// Test token standing in for a stock token (18 decimals, open mint). Local tests only.
contract MockStock is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Takes 1% of every transfer: a basket must refuse it on mint.
contract FeeOnTransferToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 cut = value / 100;
            super._update(from, address(0xdead), cut);
            super._update(from, to, value - cut);
        } else {
            super._update(from, to, value);
        }
    }
}

interface IBasketActions {
    function mint(uint256 amount, address to) external;

    function redeem(uint256 amount) external;
}

/// Calls back into the basket during a transfer, to prove the reentrancy guard holds.
contract ReentrantToken is ERC20 {
    address public target;
    bool public onRedeem; // false: re-enter mint, true: re-enter redeem

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(address target_, bool onRedeem_) external {
        target = target_;
        onRedeem = onRedeem_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        address t = target;
        if (t != address(0) && (from == t || to == t)) {
            target = address(0);
            if (onRedeem) IBasketActions(t).redeem(1);
            else IBasketActions(t).mint(1e18, address(this));
        }
    }
}
