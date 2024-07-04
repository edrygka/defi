// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    string public baseURI;

    constructor(
        string memory __baseURI,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) {
        baseURI = __baseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function safeMint(address to, uint tokenId) external {
        _safeMint(to, tokenId);
    }

    function mint(address to, uint tokenId) external {
        _mint(to, tokenId);
    }

    function burn(uint tokenId) external {
        _burn(tokenId);
    }
}
