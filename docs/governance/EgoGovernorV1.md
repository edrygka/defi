# Solidity API

## EgoGovernorV1

### DEFAULT_ADMIN_ROLE

```solidity
bytes32 DEFAULT_ADMIN_ROLE
```

### DAO_ADMIN_ROLE

```solidity
bytes32 DAO_ADMIN_ROLE
```

### AUTONOMOUS_DAO_ROLE

```solidity
bytes32 AUTONOMOUS_DAO_ROLE
```

### token

```solidity
contract IVotes token
```

Token to determine weights of votes

### accessRegistry

```solidity
contract IAccessControl accessRegistry
```

Access control contract

### quorumNumerator

```solidity
uint256 quorumNumerator
```

Percentage of total supply to reach quorum

### autonomousQuorumNumerator

```solidity
uint256 autonomousQuorumNumerator
```

Percentage of total supply to reach quorum for autonomous proposal

### denominator

```solidity
uint256 denominator
```

Denominator for percentages calculations

### votingDelay

```solidity
uint32 votingDelay
```

Delay betwen proposal creation time and voting start in blocks

### votingPeriod

```solidity
uint32 votingPeriod
```

Voting duration in blocks

### preventLateQuorum

```solidity
uint32 preventLateQuorum
```

Voting period till proposal will still be active if quorum reached

### proposalThreshold

```solidity
uint256 proposalThreshold
```

Threshold in tokens to be able create proposal

### blocksPerProposals

```solidity
uint32 blocksPerProposals
```

Limit of blocks per proposal creation for each address

### proposals

```solidity
mapping(uint256 => struct IEgoGovernorV1.Proposal) proposals
```

### lastProposalCreation

```solidity
mapping(address => uint32) lastProposalCreation
```

### hasVoted

```solidity
mapping(uint256 => mapping(address => bool)) hasVoted
```

### onlyRole

```solidity
modifier onlyRole(bytes32 role)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(struct IEgoGovernorV1.InitializeParams _initParams) external
```

_Initializes interface to init staking storage_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _initParams | struct IEgoGovernorV1.InitializeParams | initializer params |

### setPercentages

```solidity
function setPercentages(uint256 _newQuorumNumerator, uint256 _newAutonomousNumerator, uint256 _newDenominator) external
```

Admin function for setting percentages for quorums

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newQuorumNumerator | uint256 | new quorum numerator |
| _newAutonomousNumerator | uint256 | new quorum numerator for autonomous proposals |
| _newDenominator | uint256 | new quorum denominator |

### setTimestamps

```solidity
function setTimestamps(uint32 _newVotingDelay, uint32 _newVotingPeriod, uint32 _newPreventLateQuorum) external
```

Admin function for setting the voting delay

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newVotingDelay | uint32 | new voting delay, in blocks |
| _newVotingPeriod | uint32 | new voting period, in blocks |
| _newPreventLateQuorum | uint32 | new extended deadline, in blocks |

### setLimits

```solidity
function setLimits(uint256 _newProposalThreshold, uint32 _newBlocksPerProposals) external
```

Admin function for setting the proposal threshold and proposal limits

| Name | Type | Description |
| ---- | ---- | ----------- |
| _newProposalThreshold | uint256 | new proposal threshold |
| _newBlocksPerProposals | uint32 | new proposal limit per blocks |

### rejectProposal

```solidity
function rejectProposal(uint256 _proposalId) external
```

_Admin can reject proposal if it's malicious_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal to reject |

### cancelProposal

```solidity
function cancelProposal(uint256 _proposalId) external
```

_External cancel mechanism. Marks proposal as cancelled._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal to cancel |

### castVote

```solidity
function castVote(uint256 _proposalId, enum IEgoGovernorV1.VoteType _vote, string _reason) external returns (uint256)
```

_Cast a vote with a reason_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal to cast vote |
| _vote | enum IEgoGovernorV1.VoteType | 0 - against, 1 - for |
| _reason | string | string descrition of casted vote |

### hashProposal

```solidity
function hashProposal(address[] _targets, uint256[] _values, string[] _signatures, bytes[] _calldatas, string _description) public pure returns (uint256)
```

_Hashing function used to (re)build the proposal id from the proposal details..

The proposal id is produced by hashing the RLC encoded `targets` array, the `values` array, the `calldatas` array
and the descriptionHash (bytes32 which itself is the keccak256 hash of the description string). This proposal id
can be produced from the proposal data which is part of the {ProposalCreated} event. It can even be computed in
advance, before the proposal is submitted.

Note that the chainId and the governor address are not part of the proposal id computation. Consequently, the
same proposal (with same operation and same description) will have the same id if submitted on multiple governors
across multiple networks. This also means that in order to execute the same operation twice (on the same
governor) the proposer will have to change the description in order to avoid proposal id conflicts._

### state

```solidity
function state(uint256 _proposalId) external view returns (enum IEgoGovernorV1.ProposalState)
```

_Current state of a proposal, following Compound's convention_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposalId | uint256 | ID of proposal to get status |

### propose

```solidity
function propose(address[] _targets, uint256[] _values, string[] _signatures, bytes[] _calldatas, string _description) external returns (uint256)
```

_Create a new proposal. Vote start (currentTimestamp + votingDelay) blocks and ends
(currentTimestamp + votingDelay + votingPeriod) blocks._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _targets | address[] | list of contracts addresses governance need to call |
| _values | uint256[] | eth values for proposal calls |
| _signatures | string[] | function signatures for proposal calls |
| _calldatas | bytes[] | calldatas for proposal calls |
| _description | string | string description of the proposal |

### proposeAutonomous

```solidity
function proposeAutonomous(address[] _targets, uint256[] _values, string[] _signatures, bytes[] _calldatas, string _description, address _account) external returns (uint256)
```

_Create a new proposal only for autonomous proposer._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _targets | address[] | list of contracts addresses governance need to call |
| _values | uint256[] | eth values for proposal calls |
| _signatures | string[] | function signatures for proposal calls |
| _calldatas | bytes[] | calldatas for proposal calls |
| _description | string | string description of the proposal |
| _account | address | address of proposer |

### _countVote

```solidity
function _countVote(uint256 _proposalId, address _account, enum IEgoGovernorV1.VoteType _vote, uint256 _weight) private
```

PRIVATE FUNCTIONS

### _setPercentages

```solidity
function _setPercentages(uint256 _newQuorumNumerator, uint256 _newAutonomousNumerator, uint256 _newDenominator) private
```

### _setTimestamps

```solidity
function _setTimestamps(uint32 _newVotingDelay, uint32 _newVotingPeriod, uint32 _newPreventLateQuorum) private
```

### _setLimits

```solidity
function _setLimits(uint256 _newProposalThreshold, uint32 _newBlocksPerProposals) private
```

### _proposalDeadline

```solidity
function _proposalDeadline(struct IEgoGovernorV1.Proposal _proposal) private pure returns (uint32)
```

### _state

```solidity
function _state(struct IEgoGovernorV1.Proposal _proposal) internal view returns (enum IEgoGovernorV1.ProposalState)
```

_Current state of a proposal, following Compound's convention_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposal | struct IEgoGovernorV1.Proposal | proposal to get status |

### _quorumReached

```solidity
function _quorumReached(struct IEgoGovernorV1.Proposal _proposal) internal view returns (bool)
```

_Amount of votes already cast passes the threshold limit._

| Name | Type | Description |
| ---- | ---- | ----------- |
| _proposal | struct IEgoGovernorV1.Proposal | Proposal |

### _propose

```solidity
function _propose(address[] _targets, uint256[] _values, string[] _signatures, bytes[] _calldatas, string _description, address account) internal returns (uint256)
```

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address) internal
```

UUPSUpgradeable support

### supportsInterface

```solidity
function supportsInterface(bytes4 _interfaceId) public view returns (bool)
```

_Check contract supports provided interface_

| Name | Type | Description |
| ---- | ---- | ----------- |
| _interfaceId | bytes4 | id of the interface |

