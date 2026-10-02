// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Basket — one ERC-20 backed by a fixed set of tokens held in this contract.
/// @notice Weights are fixed in token units at creation: `units` of each component back 1e18 basket tokens.
///         Mint by depositing the components (plus the creator fee on top); redeem any time for your
///         pro-rata share of what the vault holds. No owner, no admin, no pause, no upgrade.
contract Basket is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Component {
        address token;
        uint256 units; // raw units of `token` per 1e18 basket tokens
    }

    uint256 public constant MIN_COMPONENTS = 2;
    uint256 public constant MAX_COMPONENTS = 10;
    uint256 public constant MAX_FEE_BPS = 200; // 2%
    uint256 public constant BPS = 10_000;
    uint256 private constant ONE = 1e18;

    address public immutable factory;
    address public immutable creator;
    uint256 public immutable mintFeeBps;

    Component[] private _components;

    event Minted(address indexed payer, address indexed to, uint256 amount, uint256[] deposits, uint256[] fees);
    event Redeemed(address indexed account, uint256 amount, uint256[] amounts);

    error ComponentCount();
    error FeeTooHigh();
    error ZeroToken();
    error ZeroUnits();
    error DuplicateToken();
    error ZeroAmount();
    error FeeOnTransfer(address token);

    constructor(string memory name_, string memory symbol_, Component[] memory components_, address creator_, uint256 mintFeeBps_)
        ERC20(name_, symbol_)
    {
        uint256 n = components_.length;
        if (n < MIN_COMPONENTS || n > MAX_COMPONENTS) revert ComponentCount();
        if (mintFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (creator_ == address(0)) revert ZeroToken();
        for (uint256 i; i < n; ++i) {
            Component memory c = components_[i];
            if (c.token == address(0)) revert ZeroToken();
            if (c.units == 0) revert ZeroUnits();
            for (uint256 j; j < i; ++j) {
                if (components_[j].token == c.token) revert DuplicateToken();
            }
            _components.push(c);
        }
        factory = msg.sender;
        creator = creator_;
        mintFeeBps = mintFeeBps_;
    }

    // ---------------------------------------------------------------- views

    function components() external view returns (Component[] memory) {
        return _components;
    }

    function componentCount() external view returns (uint256) {
        return _components.length;
    }

    /// @notice What minting `amount` costs: `deposits[i]` goes to the vault (rounded up),
    ///         `fees[i]` goes to the creator (rounded down), both pulled from the payer.
    function quoteMint(uint256 amount) public view returns (address[] memory tokens, uint256[] memory deposits, uint256[] memory fees) {
        uint256 n = _components.length;
        tokens = new address[](n);
        deposits = new uint256[](n);
        fees = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            Component storage c = _components[i];
            tokens[i] = c.token;
            deposits[i] = Math.mulDiv(amount, c.units, ONE, Math.Rounding.Ceil);
            fees[i] = (deposits[i] * mintFeeBps) / BPS;
        }
    }

    /// @notice What redeeming `amount` returns: `amount / totalSupply` of each vault balance, rounded down.
    function quoteRedeem(uint256 amount) public view returns (address[] memory tokens, uint256[] memory amounts) {
        uint256 n = _components.length;
        tokens = new address[](n);
        amounts = new uint256[](n);
        uint256 supply = totalSupply();
        for (uint256 i; i < n; ++i) {
            address t = _components[i].token;
            tokens[i] = t;
            if (supply != 0 && amount <= supply) {
                amounts[i] = Math.mulDiv(IERC20(t).balanceOf(address(this)), amount, supply);
            }
        }
    }

    /// @notice Vault balance of every component.
    function vault() external view returns (address[] memory tokens, uint256[] memory balances) {
        uint256 n = _components.length;
        tokens = new address[](n);
        balances = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            tokens[i] = _components[i].token;
            balances[i] = IERC20(tokens[i]).balanceOf(address(this));
        }
    }

    // -------------------------------------------------------------- actions

    /// @notice Pull the components for `amount` basket tokens (and the creator fee) from the caller, mint to `to`.
    function mint(uint256 amount, address to) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        (address[] memory tokens, uint256[] memory deposits, uint256[] memory fees) = quoteMint(amount);
        for (uint256 i; i < tokens.length; ++i) {
            IERC20 t = IERC20(tokens[i]);
            uint256 before = t.balanceOf(address(this));
            t.safeTransferFrom(msg.sender, address(this), deposits[i]);
            if (t.balanceOf(address(this)) - before != deposits[i]) revert FeeOnTransfer(tokens[i]);
            if (fees[i] != 0) t.safeTransferFrom(msg.sender, creator, fees[i]);
        }
        _mint(to, amount);
        emit Minted(msg.sender, to, amount, deposits, fees);
    }

    /// @notice Burn `amount` of your basket tokens and receive `amount / totalSupply` of each vault balance.
    function redeem(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        (address[] memory tokens, uint256[] memory amounts) = quoteRedeem(amount);
        _burn(msg.sender, amount); // reverts if the caller holds less than `amount`
        for (uint256 i; i < tokens.length; ++i) {
            if (amounts[i] != 0) IERC20(tokens[i]).safeTransfer(msg.sender, amounts[i]);
        }
        emit Redeemed(msg.sender, amount, amounts);
    }
}
