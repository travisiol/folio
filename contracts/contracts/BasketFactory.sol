// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Basket} from "./Basket.sol";

/// @title BasketFactory — anyone creates a Basket; the caller becomes its creator (fee recipient).
/// @notice No owner and no allowlist: any ERC-20 can be a component. The site only offers verified tokens.
contract BasketFactory {
    address[] private _all;
    mapping(address => address[]) private _byCreator;
    mapping(address => bool) public isBasket;

    event BasketCreated(address indexed basket, address indexed creator, string name, string symbol, uint256 mintFeeBps);

    function create(string calldata name, string calldata symbol, Basket.Component[] calldata components, uint256 mintFeeBps)
        external
        returns (address basket)
    {
        basket = address(new Basket(name, symbol, components, msg.sender, mintFeeBps));
        _all.push(basket);
        _byCreator[msg.sender].push(basket);
        isBasket[basket] = true;
        emit BasketCreated(basket, msg.sender, name, symbol, mintFeeBps);
    }

    function count() external view returns (uint256) {
        return _all.length;
    }

    /// @notice Baskets in creation order, `limit` of them from `offset`.
    function baskets(uint256 offset, uint256 limit) external view returns (address[] memory page) {
        uint256 n = _all.length;
        if (offset >= n) return new address[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) page[i - offset] = _all[i];
    }

    function basketsOf(address creator) external view returns (address[] memory) {
        return _byCreator[creator];
    }
}
