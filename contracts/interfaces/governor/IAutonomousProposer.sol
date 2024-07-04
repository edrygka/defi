// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "../utils/IPermit.sol";

interface IAutonomousProposer is IPermit {
    /// @notice An event emitted when a crowd proposal is created
    event AutonomousProposalCreated(
        address indexed author,
        uint indexed proposalId,
        address[] targets,
        uint[] values,
        string[] signatures,
        bytes[] calldatas,
        string description
    );

    /// @notice An event emitted when the crowd proposal is terminated
    event AutonomousProposalCancelled(
        uint indexed proposalId,
        address indexed author
    );

    /// @notice An event emitted when proposer withdraw his staked EGO's back after proposal rejection
    event Withdraw(
        uint indexed proposalId,
        address indexed account,
        uint amount
    );

    function create(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external;

    function cancel(uint _proposalid) external;

    function withdraw(uint _proposalid) external;
}
