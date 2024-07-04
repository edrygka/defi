// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.8;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "../utils/CommonChecks.sol";

import "../interfaces/governor/IAutonomousProposer.sol";
import "../interfaces/governor/IEgoGovernorV1.sol";

contract AutonomousProposer is IAutonomousProposer, CommonChecks, ERC165 {
    using SafeERC20 for IERC20;

    /// @notice `EGO` token contract address
    IERC20 public immutable token;
    /// @notice `EgoGovernor` contract address
    IEgoGovernorV1 public immutable governor;
    /// @notice Minimum Ego tokens required to create a autonomous proposal
    uint public immutable stakeAmount;

    /// @notice The proposal authors
    mapping(uint => address) public users;

    /**
     * @notice Construct a factory for autonomous proposals
     * @param _token `EGO` token contract address
     * @param _governor `EgoGovernor` contract address
     * @param _stakeAmount The minimum amount of EGO tokes required for creation of a autonomous proposal
     */
    constructor(
        address _token,
        address _governor,
        uint _stakeAmount
    ) notZeroAddress(_token) notZeroAddress(_governor) {
        require(
            IERC165(_governor).supportsInterface(
                type(IEgoGovernorV1).interfaceId
            ),
            "AP: UNSUPPORTED_INTERFACE"
        );

        token = IERC20(_token);
        governor = IEgoGovernorV1(_governor);
        stakeAmount = _stakeAmount;
    }

    /**
     * @notice Create a new autonomous proposal
     * @param _details permit details
     * @param _targets The ordered list of target addresses for calls to be made
     * @param _values The ordered list of values (i.e. msg.value) to be passed to the calls to be made
     * @param _signatures function signatures for proposal calls
     * @param _calldatas The ordered list of calldata to be passed to each call
     * @param _description The block at which voting begins: holders must delegate their votes prior to this block
     */
    function createWithPermit(
        PermitDetails calldata _details,
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external {
        IERC20Permit(address(token)).permit(
            msg.sender,
            address(this),
            _details.amount,
            _details.deadline,
            _details.v,
            _details.r,
            _details.s
        );

        _create(_targets, _values, _signatures, _calldatas, _description);
    }

    /**
     * @notice Create a new autonomous proposal
     * @notice Call `EGO.approve(AutonomousProposer.address, stakeAmount)` before calling this method
     * @param _targets The ordered list of target addresses for calls to be made
     * @param _values The ordered list of values (i.e. msg.value) to be passed to the calls to be made
     * @param _signatures function signatures for proposal calls
     * @param _calldatas The ordered list of calldata to be passed to each call
     * @param _description The block at which voting begins: holders must delegate their votes prior to this block
     */
    function create(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external {
        _create(_targets, _values, _signatures, _calldatas, _description);
    }

    /**
     * @notice Cancel the autonomous proposal, send back staked EGO tokens
     * @param _proposalId ID of proposal to be cancelled
     */
    function cancel(uint _proposalId) external {
        require(users[_proposalId] == msg.sender, "AP: INVALID_AUTHOR");

        users[_proposalId] = address(0);

        governor.cancelProposal(_proposalId);

        // Transfer staked EGO tokens back to the author
        token.safeTransfer(msg.sender, stakeAmount);

        emit AutonomousProposalCancelled(_proposalId, msg.sender);
    }

    /**
     * @notice Withdraw staked EGO's back if proposal finished or was rejected by admin
     * @param _proposalId ID of proposal
     */
    function withdraw(uint _proposalId) external {
        require(msg.sender == users[_proposalId], "AP: INVALID_AUTHOR");

        IEgoGovernorV1.ProposalState status = governor.state(_proposalId);
        require(
            status == IEgoGovernorV1.ProposalState.Rejected ||
                status == IEgoGovernorV1.ProposalState.Defeated ||
                status == IEgoGovernorV1.ProposalState.Succeeded,
            "AP: NOT_FINISHED"
        );

        users[_proposalId] = address(0);

        // Transfer staked EGO tokens back to the author
        token.safeTransfer(msg.sender, stakeAmount);

        emit Withdraw(_proposalId, msg.sender, stakeAmount);
    }

    /**
     * @dev Check contract supports provided interface
     * @param _interfaceId id of the interface
     */
    function supportsInterface(bytes4 _interfaceId)
        public
        view
        override
        returns (bool)
    {
        return
            _interfaceId == type(IAutonomousProposer).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    function _create(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) private {
        // Stake EGO and force proposal to delegate votes to itself
        token.safeTransferFrom(msg.sender, address(this), stakeAmount);

        // Create governance proposal and save proposal id
        uint govProposalId = governor.proposeAutonomous(
            _targets,
            _values,
            _signatures,
            _calldatas,
            _description,
            msg.sender
        );

        users[govProposalId] = msg.sender;

        emit AutonomousProposalCreated(
            msg.sender,
            govProposalId,
            _targets,
            _values,
            _signatures,
            _calldatas,
            _description
        );
    }
}
