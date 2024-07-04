// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/ERC165Upgradeable.sol";

import "../interfaces/governor/IEgoGovernorV1.sol";
import "../utils/CommonChecks.sol";

contract EgoGovernorV1 is
    IEgoGovernorV1,
    UUPSUpgradeable,
    Context,
    ERC165Upgradeable,
    CommonChecks
{
    using SafeCast for uint;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant DAO_ADMIN_ROLE = keccak256("DAO_ADMIN_ROLE");
    bytes32 public constant AUTONOMOUS_DAO_ROLE =
        keccak256("AUTONOMOUS_DAO_ROLE");

    /// @notice Token to determine weights of votes
    IVotes public token;
    /// @notice Access control contract
    IAccessControl public accessRegistry;

    /// @notice Percentage of total supply to reach quorum
    uint public quorumNumerator;
    /// @notice Percentage of total supply to reach quorum for autonomous proposal
    uint public autonomousQuorumNumerator;
    /// @notice Denominator for percentages calculations
    uint public denominator;
    /// @notice Delay betwen proposal creation time and voting start in blocks
    uint32 public votingDelay;
    /// @notice Voting duration in blocks
    uint32 public votingPeriod;
    /// @notice Voting period till proposal will still be active if quorum reached
    uint32 public preventLateQuorum;
    /// @notice Threshold in tokens to be able create proposal
    uint public proposalThreshold;
    /// @notice Limit of blocks per proposal creation for each address
    uint32 public blocksPerProposals;

    mapping(uint => Proposal) public proposals;
    mapping(address => uint32) public lastProposalCreation;
    mapping(uint => mapping(address => bool)) public hasVoted;

    modifier onlyRole(bytes32 role) {
        require(
            accessRegistry.hasRole(role, _msgSender()),
            "Governor: FORBIDDEN"
        );
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /**
     * @dev Initializes interface to init staking storage
     * @param _initParams initializer params
     */
    function initialize(InitializeParams calldata _initParams)
        external
        initializer
        notZeroAddress(_initParams.accessRegistry)
        notZeroAddress(_initParams.token)
    {
        require(
            IERC165Upgradeable(_initParams.accessRegistry).supportsInterface(
                type(IAccessControl).interfaceId
            ),
            "Governor: UNSUPPORTED_INTERFACE"
        );
        __UUPSUpgradeable_init();
        __ERC165_init();

        accessRegistry = IAccessControl(_initParams.accessRegistry);
        token = IVotes(_initParams.token);

        _setPercentages(
            _initParams.quorumNumerator,
            _initParams.autonomousQuorumNumerator,
            _initParams.denominator
        );
        _setTimestamps(
            _initParams.votingDelay,
            _initParams.votingPeriod,
            _initParams.preventLateQuorum
        );
        _setLimits(
            _initParams.proposalThreshold,
            _initParams.blocksPerProposals
        );
    }

    /**
     * @notice Admin function for setting percentages for quorums
     * @param _newQuorumNumerator new quorum numerator
     * @param _newAutonomousNumerator new quorum numerator for autonomous proposals
     * @param _newDenominator new quorum denominator
     */
    function setPercentages(
        uint _newQuorumNumerator,
        uint _newAutonomousNumerator,
        uint _newDenominator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setPercentages(
            _newQuorumNumerator,
            _newAutonomousNumerator,
            _newDenominator
        );
    }

    /**
     * @notice Admin function for setting the voting delay
     * @param _newVotingDelay new voting delay, in blocks
     * @param _newVotingPeriod new voting period, in blocks
     * @param _newPreventLateQuorum new extended deadline, in blocks
     */
    function setTimestamps(
        uint32 _newVotingDelay,
        uint32 _newVotingPeriod,
        uint32 _newPreventLateQuorum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTimestamps(
            _newVotingDelay,
            _newVotingPeriod,
            _newPreventLateQuorum
        );
    }

    /**
     * @notice Admin function for setting the proposal threshold and proposal limits
     * @param _newProposalThreshold new proposal threshold
     * @param _newBlocksPerProposals new proposal limit per blocks
     */
    function setLimits(
        uint _newProposalThreshold,
        uint32 _newBlocksPerProposals
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setLimits(_newProposalThreshold, _newBlocksPerProposals);
    }

    /**
     * @dev Admin can reject proposal if it's malicious
     * @param _proposalId ID of proposal to reject
     */
    function rejectProposal(uint _proposalId)
        external
        onlyRole(DAO_ADMIN_ROLE)
    {
        Proposal storage proposal = proposals[_proposalId];

        require(
            _state(proposal) != ProposalState.Rejected,
            "Governor: ALREADY_REJECTED"
        );
        proposal.rejected = true;

        emit ProposalRejected(_proposalId);
    }

    /**
     * @dev External cancel mechanism. Marks proposal as cancelled.
     * @param _proposalId ID of proposal to cancel
     */
    function cancelProposal(uint _proposalId) external {
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.account == _msgSender(), "Governor: WRONG_ACCOUNT");

        ProposalState proposalState = _state(proposal);

        require(
            proposalState == ProposalState.Pending ||
                proposalState == ProposalState.Active,
            "Governor: NOT_PENDING_OR_ACTIVE"
        );
        proposal.cancelled = true;

        emit ProposalCancelled(_proposalId);
    }

    /**
     * @dev Cast a vote with a reason
     * @param _proposalId ID of proposal to cast vote
     * @param _vote 0 - against, 1 - for
     * @param _reason string descrition of casted vote
     */
    function castVote(
        uint _proposalId,
        VoteType _vote,
        string calldata _reason
    ) external returns (uint) {
        Proposal storage proposal = proposals[_proposalId];
        require(
            _state(proposal) == ProposalState.Active,
            "Governor: NOT_ACTIVE"
        );

        address _account = _msgSender();

        uint weight = token.getPastVotes(_account, proposal.voteStart);
        _countVote(_proposalId, _account, _vote, weight);

        if (proposal.extendedDeadline == 0 && _quorumReached(proposal)) {
            uint32 extendedDeadlineValue = block.number.toUint32() +
                preventLateQuorum;

            if (extendedDeadlineValue > _proposalDeadline(proposal)) {
                emit ProposalExtended(_proposalId, extendedDeadlineValue);
            }

            proposal.extendedDeadline = extendedDeadlineValue;
        }

        emit VoteCast(_account, _proposalId, _vote, weight, _reason);

        return weight;
    }

    /**
     * @dev Hashing function used to (re)build the proposal id from the proposal details..
     *
     * The proposal id is produced by hashing the RLC encoded `targets` array, the `values` array, the `calldatas` array
     * and the descriptionHash (bytes32 which itself is the keccak256 hash of the description string). This proposal id
     * can be produced from the proposal data which is part of the {ProposalCreated} event. It can even be computed in
     * advance, before the proposal is submitted.
     *
     * Note that the chainId and the governor address are not part of the proposal id computation. Consequently, the
     * same proposal (with same operation and same description) will have the same id if submitted on multiple governors
     * across multiple networks. This also means that in order to execute the same operation twice (on the same
     * governor) the proposer will have to change the description in order to avoid proposal id conflicts.
     */
    function hashProposal(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) public pure returns (uint) {
        if (_targets.length == 0) {
            return uint(keccak256(bytes(_description)));
        } else {
            return
                uint(
                    keccak256(
                        abi.encode(
                            _targets,
                            _values,
                            _signatures,
                            _calldatas,
                            keccak256(bytes(_description))
                        )
                    )
                );
        }
    }

    /**
     * @dev Current state of a proposal, following Compound's convention
     * @param _proposalId ID of proposal to get status
     */

    function state(uint _proposalId) external view returns (ProposalState) {
        return _state(proposals[_proposalId]);
    }

    /**
     * @dev Create a new proposal. Vote start (currentTimestamp + votingDelay) blocks and ends
     * (currentTimestamp + votingDelay + votingPeriod) blocks.
     * @param _targets list of contracts addresses governance need to call
     * @param _values eth values for proposal calls
     * @param _signatures function signatures for proposal calls
     * @param _calldatas calldatas for proposal calls
     * @param _description string description of the proposal
     */
    function propose(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external returns (uint) {
        address sender = _msgSender();

        return
            _propose(
                _targets,
                _values,
                _signatures,
                _calldatas,
                _description,
                sender
            );
    }

    /**
     * @dev Create a new proposal only for autonomous proposer.
     * @param _targets list of contracts addresses governance need to call
     * @param _values eth values for proposal calls
     * @param _signatures function signatures for proposal calls
     * @param _calldatas calldatas for proposal calls
     * @param _description string description of the proposal
     * @param _account address of proposer
     */
    function proposeAutonomous(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description,
        address _account
    ) external onlyRole(AUTONOMOUS_DAO_ROLE) returns (uint) {
        return
            _propose(
                _targets,
                _values,
                _signatures,
                _calldatas,
                _description,
                _account
            );
    }

    /**
     * @dev Amount of votes already cast passes the threshold limit.
     * @param _proposalId ID of proposal
     */
    function quorumReached(uint _proposalId) external view returns (bool) {
        return _quorumReached(proposals[_proposalId]);
    }

    /**
     * PRIVATE FUNCTIONS
     */

    function _countVote(
        uint _proposalId,
        address _account,
        VoteType _vote,
        uint _weight
    ) private {
        Proposal storage proposal = proposals[_proposalId];

        require(!hasVoted[_proposalId][_account], "Governor: ALREADY_VOTED");
        hasVoted[_proposalId][_account] = true;

        if (_vote == VoteType.For) {
            proposal.forVotes += _weight;
        } else {
            proposal.againstVotes += _weight;
        }
    }

    function _setPercentages(
        uint _newQuorumNumerator,
        uint _newAutonomousNumerator,
        uint _newDenominator
    ) private {
        if (_newDenominator != 0) {
            require(
                _newDenominator >= autonomousQuorumNumerator &&
                    _newDenominator >= quorumNumerator,
                "Governor: INVALID_DENOMINATOR"
            );
            denominator = _newDenominator;
            emit SetDenominator(_newDenominator);
        }
        if (_newQuorumNumerator != 0) {
            require(
                _newQuorumNumerator <= denominator,
                "Governor: INVALID_NUMENATOR"
            );
            quorumNumerator = _newQuorumNumerator;
            emit SetQuorumNumerator(_newQuorumNumerator);
        }
        if (_newAutonomousNumerator != 0) {
            require(
                _newAutonomousNumerator <= denominator,
                "Governor: INVALID_AUTO_NUMENATOR"
            );
            autonomousQuorumNumerator = _newAutonomousNumerator;
            emit SetAutonomousQuorumNumerator(_newAutonomousNumerator);
        }
    }

    function _setTimestamps(
        uint32 _newVotingDelay,
        uint32 _newVotingPeriod,
        uint32 _newPreventLateQuorum
    ) private {
        if (_newVotingDelay != 0) {
            votingDelay = _newVotingDelay;
            emit SetVotingDelay(_newVotingDelay);
        }
        if (_newVotingPeriod != 0) {
            votingPeriod = _newVotingPeriod;
            emit SetVotingPeriod(_newVotingPeriod);
        }
        if (_newPreventLateQuorum != 0) {
            preventLateQuorum = _newPreventLateQuorum;
            emit SetPreventLateQuorum(_newPreventLateQuorum);
        }
    }

    function _setLimits(
        uint _newProposalThreshold,
        uint32 _newBlocksPerProposals
    ) private {
        if (_newProposalThreshold != 0) {
            require(
                token.getPastTotalSupply(block.number - 1) >=
                    _newProposalThreshold,
                "EgoGovernor: INVALID_THRESHOLD"
            );

            proposalThreshold = _newProposalThreshold;
            emit SetProposalThreshold(_newProposalThreshold);
        }
        if (_newBlocksPerProposals != 0) {
            blocksPerProposals = _newBlocksPerProposals;
            emit SetBlocksPerProposals(_newBlocksPerProposals);
        }
    }

    function _proposalDeadline(Proposal memory _proposal)
        private
        pure
        returns (uint32)
    {
        return
            _proposal.voteEnd > _proposal.extendedDeadline
                ? _proposal.voteEnd
                : _proposal.extendedDeadline;
    }

    /**
     * @dev Current state of a proposal, following Compound's convention
     * @param _proposal proposal to get status
     */
    function _state(Proposal memory _proposal)
        internal
        view
        returns (ProposalState)
    {
        if (_proposal.voteStart == 0) {
            return ProposalState.NotExist;
        } else if (_proposal.rejected) {
            return ProposalState.Rejected;
        } else if (_proposal.cancelled) {
            return ProposalState.Cancelled;
        } else if (_proposal.voteStart >= block.number) {
            return ProposalState.Pending;
        } else if (_proposalDeadline(_proposal) >= block.number) {
            return ProposalState.Active;
        } else if (
            _quorumReached(_proposal) &&
            _proposal.forVotes > _proposal.againstVotes
        ) {
            return ProposalState.Succeeded;
        }

        return ProposalState.Defeated;
    }

    /**
     * @dev Amount of votes already cast passes the threshold limit.
     * @param _proposal Proposal
     */
    function _quorumReached(Proposal memory _proposal)
        internal
        view
        returns (bool)
    {
        uint _numerator = accessRegistry.hasRole(
            AUTONOMOUS_DAO_ROLE,
            _proposal.account
        )
            ? autonomousQuorumNumerator
            : quorumNumerator;
        uint _effectiveNumerator = token.getPastTotalSupply(
            _proposal.voteStart
        ) * _numerator;

        return
            _effectiveNumerator / denominator <=
            (_proposal.forVotes + _proposal.againstVotes);
    }

    function _propose(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description,
        address account
    ) internal returns (uint) {
        require(
            accessRegistry.hasRole(AUTONOMOUS_DAO_ROLE, _msgSender()) ||
                token.getPastVotes(account, block.number - 1) >=
                proposalThreshold,
            "Governor: THRESHOLD"
        );

        require(
            block.number.toUint32() - lastProposalCreation[account] >=
                blocksPerProposals,
            "Governor: LIMIT"
        );

        require(
            _targets.length == _values.length &&
                _values.length == _calldatas.length &&
                _calldatas.length == _signatures.length,
            "Governor: INVALID_LENGTH"
        );

        uint proposalId = hashProposal(
            _targets,
            _values,
            _signatures,
            _calldatas,
            _description
        );

        Proposal storage proposal = proposals[proposalId];
        require(proposal.voteStart == 0, "Governor: EXISTS");

        uint32 voteStart = block.number.toUint32() + votingDelay;
        uint32 voteEnd = voteStart + votingPeriod;

        proposal.voteStart = voteStart;
        proposal.voteEnd = voteEnd;
        proposal.account = _msgSender();

        lastProposalCreation[account] = block.number.toUint32();

        emit ProposalCreated(
            proposalId,
            _msgSender(),
            _targets,
            _values,
            _signatures,
            _calldatas,
            voteStart,
            voteEnd,
            _description
        );

        return proposalId;
    }

    /**
     * UUPSUpgradeable support
     */

    function _authorizeUpgrade(address)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    /**
     * IERC165 support
     */

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
            _interfaceId == type(IEgoGovernorV1).interfaceId ||
            super.supportsInterface(_interfaceId);
    }
}
