// SPDX-License-Identifier: MIT
pragma solidity 0.8.8;

import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "./interfaces/IRandomGenerator.sol";
import "./utils/CommonChecks.sol";

/// @title Random generator contract
contract RandomGenerator is
    IRandomGenerator,
    CommonChecks,
    ERC165,
    VRFConsumerBaseV2
{
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant ADD_SEED_ROLE = keccak256("ADD_SEED_ROLE");

    IAccessControl public accessRegistry;
    VRFCoordinatorV2Interface public vrfCoordinator;
    uint64 public subscriptionId;
    bytes32 public keyHash;

    mapping(uint => address) public sales;
    mapping(address => Request) public requests;

    constructor(
        address _accessRegistry,
        address _vrfCoordinator,
        bytes32 _keyHash,
        uint32 _subscriptionId
    )
        VRFConsumerBaseV2(_vrfCoordinator)
        notZeroAddress(_accessRegistry)
        notZeroAddress(_vrfCoordinator)
    {
        require(
            IERC165(_accessRegistry).supportsInterface(
                type(IAccessControl).interfaceId
            ),
            "RG: UNSUPPORTED_INTERFACE"
        );

        accessRegistry = IAccessControl(_accessRegistry);
        vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
        _setKeyHash(_keyHash);
        _setSubscriptionId(_subscriptionId);
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
            _interfaceId == type(IRandomGenerator).interfaceId ||
            super.supportsInterface(_interfaceId);
    }

    modifier onlyRole(bytes32 _role) {
        require(accessRegistry.hasRole(_role, msg.sender), "RG: FORBIDDEN");
        _;
    }

    /**
     * @dev Returns random value for specific sale
     * @param _sale address of sale contract
     * @param _index number of random value in array
     * @return random value
     */
    function getRandomWord(address _sale, uint _index)
        external
        view
        returns (uint)
    {
        return requests[_sale].randoms[_index];
    }

    /**
     * @dev Returns length of random array for specific sale
     * @param _sale address of sale contract
     * @return random array length
     */
    function getRandomLength(address _sale) external view returns (uint) {
        return requests[_sale].randoms.length;
    }

    /// @dev Setter for keyHash variable
    /// @param _newKeyHash keyHsah for chainlink random requests
    function setKeyHash(bytes32 _newKeyHash)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setKeyHash(_newKeyHash);
    }

    /// @dev Setter for subscriptionId variable
    /// @param _newSubscriptionId id of subcription for chainlink random requests
    function setSubscriptionId(uint32 _newSubscriptionId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setSubscriptionId(_newSubscriptionId);
    }

    /// @dev Request random number for sale. There should be enough LINK before request
    /// @param _confirmations how many blocks you'd like the oracle to wait before responding to the request
    /// @param _callbackGasLimit gas limit of reverse(callback) function
    /// @param _numWords the number of uint256 random values
    /// @return requestId Request
    function requestRandom(
        uint16 _confirmations,
        uint32 _callbackGasLimit,
        uint32 _numWords
    ) public onlyRole(ADD_SEED_ROLE) returns (uint requestId) {
        Request storage request = requests[msg.sender];
        require(!request.exists, "RG: ALREADY_REQUESTED");

        requestId = vrfCoordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            _confirmations,
            _callbackGasLimit,
            _numWords
        );
        sales[requestId] = msg.sender;
        request.exists = true;
    }

    function fulfillRandomWords(uint _requestId, uint[] memory _randomWords)
        internal
        override
    {
        address sale = sales[_requestId];
        Request storage request = requests[sale];
        require(request.exists && !request.fulfilled, "RG: EXISTS");

        request.fulfilled = true;
        request.randoms = _randomWords;
    }

    function _setKeyHash(bytes32 _newKeyHash) internal {
        keyHash = _newKeyHash;
    }

    function _setSubscriptionId(uint32 _newSubscriptionId) internal {
        subscriptionId = _newSubscriptionId;
    }
}
