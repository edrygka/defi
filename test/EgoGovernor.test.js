const chai = require("chai");
const expect = chai.expect;
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { filterMutativeFunctions } = require("../utils/crypto");
const { days } = require("../utils/time");
const { solidity } = require("ethereum-waffle");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");
const { cartesianProduct } = require("../utils/math");

chai.use(solidity);

describe("EgoGovernor", () => {
  let EGO;
  let accessRegistry;
  let governor;
  let governorImpl;
  let proxy;
  let owner, alice, bob, daoAdmin;
  let initialSupply;
  let snapshot;
  const votingDelay = days(2) / 15; // 1 block = 15 seconds
  const votingPeriod = days(3) / 15;
  const preventLateQuorum = days(1) / 15;
  const quorumNumerator = BigNumber.from(10);
  const autonomousQuorumNumerator = BigNumber.from(1);
  const denominator = BigNumber.from(100);
  const proposalThreshold = BigNumber.from(50_000).mul(BigNumber.from(10).pow(18));
  const blocksPerProposals = days(7) / 15; // 7 day in block number

  const ProposalState = {
    Succeeded: 0, // vote successful
    Defeated: 1, // vote didn't reach quorum
    Active: 2, // voting ongoing
    Pending: 3, // voting didn't start
    Cancelled: 4, // can be cancelled by proposer
    Rejected: 5, // can be rejected by DAO admin
    NotExist: 6, // proposal doesn't exist
  };

  const VoteType = {
    against: 0,
    for: 1,
  };

  const createProposal = async (account) => {
    const targets = [bob.address, alice.address];
    const values = [BigNumber.from("0"), BigNumber.from("0")];
    const signatures = ["method1()", "method2()"];
    const calldatas = [Buffer.from("Calldata1"), Buffer.from("Calldata2")];
    const description = "Test description of proposal";

    const proposalId = await governor.hashProposal(targets, values, signatures, calldatas, description);

    const latestBlockNumber = await ethers.provider.getBlockNumber();
    const startVoting = latestBlockNumber + votingDelay + 1;

    await expect(governor.connect(account).propose(targets, values, signatures, calldatas, description))
      .to.emit(governor, "ProposalCreated")
      .withArgs(
        proposalId,
        account.address,
        targets,
        values,
        signatures,
        calldatas.map((val) => "0x" + val.toString("hex")),
        startVoting,
        startVoting + votingPeriod,
        description
      );

    return proposalId;
  };

  beforeEach(async () => {
    // deploy EGO token
    [owner, alice, bob, daoAdmin] = await ethers.getSigners();
    initialSupply = BigNumber.from(1_000_000).mul(BigNumber.from(10).pow(18));
    const Token = await ethers.getContractFactory("EGO");
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");

    accessRegistry = await AccessRegistry.deploy(owner.address);
    await accessRegistry.deployed();

    EGO = await Token.deploy(initialSupply, owner.address, accessRegistry.address);

    // deploy Ego governor contract
    const EgoGovernor = await ethers.getContractFactory("EgoGovernorV1");
    governorImpl = await EgoGovernor.deploy();

    const BaseProxy = await ethers.getContractFactory("BaseProxy");
    const encodedInitializeCall = governorImpl.interface.encodeFunctionData("initialize", [
      {
        accessRegistry: accessRegistry.address,
        token: EGO.address,
        quorumNumerator: quorumNumerator,
        autonomousQuorumNumerator: autonomousQuorumNumerator,
        denominator: denominator,
        votingDelay: votingDelay,
        votingPeriod: votingPeriod,
        preventLateQuorum: preventLateQuorum,
        proposalThreshold: proposalThreshold,
        blocksPerProposals: blocksPerProposals,
      },
    ]);
    proxy = await BaseProxy.deploy(governorImpl.address, encodedInitializeCall);

    governor = governorImpl.attach(proxy.address);

    // grant dao admin role
    const DAO_ADMIN_ROLE = governor.DAO_ADMIN_ROLE();
    await accessRegistry.grantRole(DAO_ADMIN_ROLE, daoAdmin.address);

    // real blockchain has 16M blocks(we need more than blocksPerProposals blocks to be mined
    // in order to let code behave as expected)
    mine(blocksPerProposals * 2);

    snapshot = await ethers.provider.send("evm_snapshot", [+Date.now()]);
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshot]);
  });

  describe("Initialization", () => {
    it("should revert on initialization from implementation contract", async () => {
      await expect(
        governorImpl.initialize({
          accessRegistry: accessRegistry.address,
          token: EGO.address,
          quorumNumerator: quorumNumerator,
          autonomousQuorumNumerator: autonomousQuorumNumerator,
          denominator: denominator,
          votingDelay: votingDelay,
          votingPeriod: votingPeriod,
          preventLateQuorum: preventLateQuorum,
          proposalThreshold: proposalThreshold,
          blocksPerProposals: blocksPerProposals,
        })
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("initialize", async () => {
      expect(await governor.token()).to.be.eq(EGO.address);
      expect(await governor.accessRegistry()).to.be.eq(accessRegistry.address);
      expect(await governor.quorumNumerator()).to.be.eq(quorumNumerator);
      expect(await governor.autonomousQuorumNumerator()).to.be.eq(autonomousQuorumNumerator);
      expect(await governor.denominator()).to.be.eq(denominator);
      expect(await governor.votingDelay()).to.be.eq(votingDelay);
      expect(await governor.votingPeriod()).to.be.eq(votingPeriod);
      expect(await governor.preventLateQuorum()).to.be.eq(preventLateQuorum);
      expect(await governor.proposalThreshold()).to.be.eq(proposalThreshold);
      expect(await governor.blocksPerProposals()).to.be.eq(blocksPerProposals);
    });

    it("should revert on initialization if access registry address wrong", async () => {
      const EgoGovernorV1 = await ethers.getContractFactory("EgoGovernorV1");
      const governorImplementation = await EgoGovernorV1.deploy();

      const BaseProxy = await ethers.getContractFactory("BaseProxy");
      const encodedInitializeCall = governorImplementation.interface.encodeFunctionData("initialize", [
        {
          accessRegistry: governor.address, // supports ERC165 but not accessRegistry
          token: EGO.address,
          quorumNumerator: quorumNumerator,
          autonomousQuorumNumerator: autonomousQuorumNumerator,
          denominator: denominator,
          votingDelay: votingDelay,
          votingPeriod: votingPeriod,
          preventLateQuorum: preventLateQuorum,
          proposalThreshold: proposalThreshold,
          blocksPerProposals: blocksPerProposals,
        },
      ]);
      await expect(BaseProxy.deploy(governorImplementation.address, encodedInitializeCall)).to.be.revertedWith(
        "Governor: UNSUPPORTED_INTERFACE"
      );
    });
  });

  describe("Setting", () => {
    const params = cartesianProduct([0, 60, 100], [0, 60, 100], [0, 60, 100]);
    for (const [num, autoNum, denom] of params) {
      it(`should set numerator: ${num}, autonomous numerator: ${autoNum} and denominator: ${denom}`, async () => {
        if (denom === 60 && (num > denom || autoNum > denom)) {
          await expect(governor.setPercentages(num, autoNum, denom)).to.be.reverted;
        } else {
          await expect(governor.setPercentages(num, autoNum, denom)).not.to.be.reverted;
        }
      });
    }

    it("should set quorum numerator successfully", async () => {
      const newQuorumNum = 20;
      await expect(governor.setPercentages(newQuorumNum, 0, 0))
        .to.emit(governor, "SetQuorumNumerator")
        .withArgs(newQuorumNum);

      expect(await governor.quorumNumerator()).to.be.eq(newQuorumNum);
    });

    it("should set autonomous quorum numerator successfully", async () => {
      const newQuorumNum = 5;
      await expect(governor.setPercentages(0, newQuorumNum, 0))
        .to.emit(governor, "SetAutonomousQuorumNumerator")
        .withArgs(newQuorumNum);

      expect(await governor.autonomousQuorumNumerator()).to.be.eq(newQuorumNum);
    });

    it("should set denominator successfully", async () => {
      const newQuorumDen = 100000;
      await expect(governor.setPercentages(0, 0, newQuorumDen))
        .to.emit(governor, "SetDenominator")
        .withArgs(newQuorumDen);

      expect(await governor.denominator()).to.be.eq(newQuorumDen);
    });

    it("should set voting delay successfully", async () => {
      const newDelay = 100000;
      await expect(governor.setTimestamps(newDelay, 0, 0)).to.emit(governor, "SetVotingDelay").withArgs(newDelay);

      expect(await governor.votingDelay()).to.be.eq(newDelay);
    });

    it("should set voting period successfully", async () => {
      const newPeriod = 100000;
      await expect(governor.setTimestamps(0, newPeriod, 0)).to.emit(governor, "SetVotingPeriod").withArgs(newPeriod);

      expect(await governor.votingPeriod()).to.be.eq(newPeriod);
    });

    it("should set prevent late quorum successfully", async () => {
      const newLateQuorum = 100000;
      await expect(governor.setTimestamps(0, 0, newLateQuorum))
        .to.emit(governor, "SetPreventLateQuorum")
        .withArgs(newLateQuorum);

      expect(await governor.preventLateQuorum()).to.be.eq(newLateQuorum);
    });

    it("should set proposal threshold successfully", async () => {
      const newThreshold = 100000;
      await expect(governor.setLimits(newThreshold, 0))
        .to.emit(governor, "SetProposalThreshold")
        .withArgs(newThreshold);

      expect(await governor.proposalThreshold()).to.be.eq(newThreshold);
    });

    it("reverts on setting proposal threshold", async () => {
      await expect(governor.setLimits(initialSupply.add("1"), 0)).to.be.revertedWith("Governor: INVALID_THRESHOLD");

      expect(await governor.proposalThreshold()).to.be.eq(proposalThreshold);
    });

    it("should set blocks per proposal limit successfully", async () => {
      const newBlocksPerProposals = days(1) / 15;
      await expect(governor.setLimits(0, newBlocksPerProposals))
        .to.emit(governor, "SetBlocksPerProposals")
        .withArgs(newBlocksPerProposals);

      expect(await governor.blocksPerProposals()).to.be.eq(newBlocksPerProposals);
    });
  });

  describe("Propose", () => {
    it("state of non-existant proposa is NotExist", async () => {
      expect(await governor.state("12345")).to.be.eq(ProposalState.NotExist);
    });

    it("should create proposal successfully", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);
    });

    it("should revert on creation two proposals in a raw", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      const targets = [bob.address];
      const values = [BigNumber.from("0")];
      const signatures = ["method1()"];
      const calldatas = [Buffer.from("Calldata1")];
      const description = "Second proposal in a raw";

      await expect(
        governor.connect(alice).propose(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: LIMIT");
    });

    it("should revert on proposal creation if user don't have enough tokens", async () => {
      // transfer 45 000 EGO's to proposer, not enough for proposal creation
      await EGO.transfer(alice.address, BigNumber.from(45_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const targets = [bob.address, alice.address];
      const values = [BigNumber.from("0"), BigNumber.from("0")];
      const signatures = ["method1()", "method2()"];
      const calldatas = [Buffer.from("Calldata1"), Buffer.from("Calldata2")];
      const description = "Test description of proposal";

      await expect(
        governor.connect(alice).propose(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: THRESHOLD");
    });

    it("should revert on proposal creation if targets and values lengths not equal", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const targets = [bob.address, alice.address];
      const values = [BigNumber.from("0")];
      const signatures = ["method1()", "method2()"];
      const calldatas = [Buffer.from("Calldata1"), Buffer.from("Calldata2")];
      const description = "Test description of proposal";

      await expect(
        governor.connect(alice).propose(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: INVALID_LENGTH");
    });

    it("should successful create proposal if targets length zero", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const targets = [];
      const values = [];
      const signatures = [];
      const calldatas = [];
      const description = "Test description of proposal";

      const proposalId = await governor.hashProposal(targets, values, signatures, calldatas, description);

      const latestBlockNumber = await ethers.provider.getBlockNumber();
      const startVoting = latestBlockNumber + votingDelay + 1;

      await expect(governor.connect(alice).propose(targets, values, signatures, calldatas, description))
        .to.emit(governor, "ProposalCreated")
        .withArgs(
          proposalId,
          alice.address,
          targets,
          values,
          signatures,
          calldatas.map((val) => "0x" + val.toString("hex")),
          startVoting,
          startVoting + votingPeriod,
          description
        );
    });

    it("should revert on create proposal if proposal with the same targets, values, calldatas and description already exists", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const targets = [bob.address, alice.address];
      const values = [BigNumber.from("0"), BigNumber.from("0")];
      const signatures = ["method1()", "method2()"];
      const calldatas = [Buffer.from("Calldata1"), Buffer.from("Calldata2")];
      const description = "Test description of proposal";

      const proposalId = await governor.hashProposal(targets, values, signatures, calldatas, description);

      const latestBlockNumber = await ethers.provider.getBlockNumber();
      const startVoting = latestBlockNumber + votingDelay + 1;

      await expect(governor.connect(alice).propose(targets, values, signatures, calldatas, description))
        .to.emit(governor, "ProposalCreated")
        .withArgs(
          proposalId,
          alice.address,
          targets,
          values,
          signatures,
          calldatas.map((val) => "0x" + val.toString("hex")),
          startVoting,
          startVoting + votingPeriod,
          description
        );

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(blocksPerProposals);

      await expect(
        governor.connect(alice).propose(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: EXISTS");
    });
  });

  describe("Reject", () => {
    it("should reject proposal successfully", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await expect(governor.connect(daoAdmin).rejectProposal(proposalId))
        .to.emit(governor, "ProposalRejected")
        .withArgs(proposalId);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Rejected);

      await expect(governor.connect(alice).castVote(proposalId, VoteType.for, "")).to.be.revertedWith(
        "Governor: NOT_ACTIVE"
      );

      // Try create new malicious proposal
      const targets = [bob.address];
      const values = [BigNumber.from("0")];
      const signatures = ["stealAllMoney()"];
      const calldatas = [Buffer.from("MyWallet")];
      const description = "I want to steal all platform funds";

      await expect(
        governor.connect(alice).propose(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: LIMIT");
    });

    it("should revert on proposal rejection if callee not dao admin", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await expect(governor.connect(alice).rejectProposal(proposalId)).to.be.revertedWith("Governor: FORBIDDEN");

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);
    });
  });

  describe("Cancel", () => {
    it("should cancel proposal successfully", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await expect(governor.connect(alice).cancelProposal(proposalId))
        .to.emit(governor, "ProposalCancelled")
        .withArgs(proposalId);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Cancelled);
    });

    it("should revert on proposal cancellation if status not pending or active", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + votingPeriod + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);

      await expect(governor.connect(alice).cancelProposal(proposalId)).to.be.revertedWith(
        "Governor: NOT_PENDING_OR_ACTIVE"
      );
    });

    it("should revert on proposal cancellation if sender not proposal creator", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, BigNumber.from(100_000).mul(BigNumber.from(10).pow(18)));
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await expect(governor.connect(bob).cancelProposal(proposalId)).to.be.revertedWith("Governor: WRONG_ACCOUNT");
    });
  });

  describe("CastVote", () => {
    it("should vote on proposal successful", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      await expect(governor.connect(alice).castVote(proposalId, VoteType.for, ""))
        .to.emit(governor, "VoteCast")
        .withArgs(alice.address, proposalId, VoteType.for, aliceAmount, "");

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      await mine(votingPeriod);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Succeeded);
    });

    it("should revert vote on proposal if its not active", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      // transfer EGO's to voter
      const bobAmount = BigNumber.from(2_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(bob.address, bobAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(bob).delegate(bob.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + votingPeriod + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);

      const reason = "Random reason";
      await expect(governor.connect(bob).castVote(proposalId, VoteType.for, reason)).to.be.revertedWith(
        "Governor: NOT_ACTIVE"
      );
    });

    it("should revert vote on proposal if user already voted", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      // transfer EGO's to voter
      const bobAmount = BigNumber.from(2_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(bob.address, bobAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(bob).delegate(bob.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      const reason = "Random reason";
      await expect(governor.connect(bob).castVote(proposalId, VoteType.against, reason))
        .to.emit(governor, "VoteCast")
        .withArgs(bob.address, proposalId, VoteType.against, bobAmount, reason);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      await expect(governor.connect(bob).castVote(proposalId, VoteType.for, "")).to.be.revertedWith(
        "Governor: ALREADY_VOTED"
      );

      await mine(votingPeriod);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);
    });

    it("should revert vote on proposal if support variable not 0 or 1", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      // transfer EGO's to voter
      const bobAmount = BigNumber.from(2_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(bob.address, bobAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(bob).delegate(bob.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      const reason = "Random reason";
      await expect(governor.connect(bob).castVote(proposalId, 3, reason)).to.be.revertedWith(
        "Transaction reverted: function was called with incorrect parameters"
      );
    });

    it("should extend proposal deadline if quorum reached at the end of the proposal", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(100_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(alice).delegate(alice.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + votingPeriod - 20);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      const extendedDeadline = (await ethers.provider.getBlockNumber()) + preventLateQuorum + 1;
      const reason = "Random reason";
      await expect(governor.connect(alice).castVote(proposalId, VoteType.for, reason))
        .to.emit(governor, "VoteCast")
        .withArgs(alice.address, proposalId, VoteType.for, aliceAmount, reason)
        .to.emit(governor, "ProposalExtended")
        .withArgs(proposalId, extendedDeadline);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      await mine(preventLateQuorum - 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      await mine(20);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Succeeded);
    });
  });

  describe("Mutative", () => {
    it("should return only known public mutative functions", async () => {
      const GovernorContract = await ethers.getContractFactory("EgoGovernorV1");
      const functions = Object.values(GovernorContract.interface.functions);

      const { fallbackFnc, mutable } = filterMutativeFunctions(functions);

      expect(fallbackFnc.length).to.be.eq(0);
      expect(mutable).to.be.eql([
        "cancelProposal",
        "castVote",
        "initialize",
        "propose",
        "proposeAutonomous",
        "rejectProposal",
        "setLimits",
        "setPercentages",
        "setTimestamps",
        "upgradeTo",
        "upgradeToAndCall",
      ]);
    });
  });
});
