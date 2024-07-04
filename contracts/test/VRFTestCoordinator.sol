// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@chainlink/contracts/src/v0.8/VRFCoordinatorV2.sol";

contract TestVRFCoordinator is VRFCoordinatorV2 {
    constructor(
        address link,
        address blockhashStore,
        address linkEthFeed
    ) payable VRFCoordinatorV2(link, blockhashStore, linkEthFeed) {}
}
