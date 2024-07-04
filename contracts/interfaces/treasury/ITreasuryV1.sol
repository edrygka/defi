// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface ITreasuryV1 {
    event EthersReceived(address indexed from, uint amount);

    event EthersTransfered(address indexed receiver, uint amount);

    event ERC20Transfered(
        address indexed receiver,
        address indexed tokenAddress,
        uint amount
    );

    event ERC721Transfered(
        address indexed receiver,
        address indexed nftAddress,
        uint tokenId
    );

    event ERC1155Transfered(
        address indexed receiver,
        address indexed tokenAddress,
        uint subtokenId,
        uint amount,
        bytes data
    );

    event ERC1155BatchTransfered(
        address indexed receiver,
        address indexed tokenAddress,
        uint[] subtokenIds,
        uint[] amounts,
        bytes data
    );

    function transferEthers(address _to, uint _amount) external;

    function transferErc20(
        address _token,
        address _to,
        uint _amount
    ) external;

    function transferErc721(
        address _nft,
        address _to,
        uint _tokenId
    ) external;

    function transferErc1155(
        address _token,
        address _to,
        uint _id,
        uint _amount,
        bytes memory _data
    ) external;

    function transferBatchErc1155(
        address _token,
        address _to,
        uint[] memory _ids,
        uint[] memory _amounts,
        bytes memory _data
    ) external;
}
