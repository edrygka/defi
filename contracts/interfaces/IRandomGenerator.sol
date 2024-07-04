// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface IRandomGenerator {
    struct Request {
        bool exists;
        bool fulfilled;
        uint[] randoms;
    }

    function getRandomWord(address _sale, uint _index)
        external
        view
        returns (uint);

    function getRandomLength(address _sale) external view returns (uint);

    function requestRandom(
        uint16 _confirmations,
        uint32 _callbackGasLimit,
        uint32 _numWords
    ) external returns (uint requestId);
}
