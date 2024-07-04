// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

interface IEgoGovernorV1 {
    enum ProposalState {
        Succeeded, // vote successful
        Defeated, // vote didn't reach quorum
        Active, // voting ongoing
        Pending, // voting didn't start
        Cancelled, // can be cancelled by proposer
        Rejected, // can be rejected by DAO admin
        NotExist // proposal doesn't exist
    }

    enum VoteType {
        Against,
        For
    }

    struct Proposal {
        address account; // 160
        uint32 voteStart; // 160 + 64 = 224
        uint32 voteEnd; // 64
        uint32 extendedDeadline; // 128
        bool rejected; // 136
        bool cancelled; // 144
        uint againstVotes;
        uint forVotes;
    }

    // Params for initialize function
    struct InitializeParams {
        address accessRegistry;
        address token;
        uint quorumNumerator;
        uint autonomousQuorumNumerator;
        uint denominator;
        uint32 votingDelay;
        uint32 votingPeriod;
        uint32 preventLateQuorum;
        uint32 blocksPerProposals;
        uint proposalThreshold;
    }

    event ProposalCreated(
        uint indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint[] values,
        string[] signatures,
        bytes[] calldatas,
        uint startBlock,
        uint endBlock,
        string description
    );
    event SetQuorumNumerator(uint newQuorumNumerator);
    event SetAutonomousQuorumNumerator(uint newAutonomousQuorumNumerator);
    event SetDenominator(uint newDenominator);
    event SetVotingDelay(uint32 newVotingDelay);
    event SetVotingPeriod(uint32 newVotingPeriod);
    event SetPreventLateQuorum(uint32 newPreventLateQuorum);
    event SetProposalThreshold(uint newProposalThreshold);
    event SetBlocksPerProposals(uint blocksPerProposals);
    event ProposalExtended(uint indexed proposalId, uint32 extendedDeadline);
    event ProposalRejected(uint proposalId);
    event ProposalCancelled(uint proposalId);
    event VoteCast(
        address indexed voter,
        uint proposalId,
        VoteType vote,
        uint weight,
        string reason
    );

    function proposals(uint _proposalId)
        external
        view
        returns (
            address account,
            uint32 voteStart,
            uint32 voteEnd,
            uint32 extendedDeadline,
            bool rejected,
            bool cancelled,
            uint againstVotes,
            uint forVotes
        );

    function hashProposal(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external pure returns (uint);

    function state(uint _proposalId) external view returns (ProposalState);

    function votingDelay() external view returns (uint32);

    function proposalThreshold() external view returns (uint);

    function votingPeriod() external view returns (uint32);

    function quorumNumerator() external view returns (uint);

    function blocksPerProposals() external view returns (uint32);

    function propose(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description
    ) external returns (uint proposalId);

    function proposeAutonomous(
        address[] memory _targets,
        uint[] memory _values,
        string[] memory _signatures,
        bytes[] memory _calldatas,
        string memory _description,
        address _account
    ) external returns (uint proposalId);

    function cancelProposal(uint _proposalId) external;

    function castVote(
        uint _proposalId,
        VoteType _vote,
        string calldata _reason
    ) external returns (uint balance);

    function quorumReached(uint _proposalId) external view returns (bool);
}
