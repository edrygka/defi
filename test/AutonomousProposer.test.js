const chai = require("chai");
const expect = chai.expect;
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const { ecsign } = require("ethereumjs-util");
const { getApprovalDigest, filterMutativeFunctions } = require("../utils/crypto");
const { mockedAccounts } = require("../utils/mockedAccounts");
const { days } = require("../utils/time");
const { solidity } = require("ethereum-waffle");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

chai.use(solidity);

describe("AutonomousProposer", () => {
  const DECIMALS = BigNumber.from(10).pow(18);

  let EGO;
  let accessRegistry;
  let governor;
  let autoProposer;
  let governorImpl;
  let proxy;
  let owner, alice, bob, daoAdmin;
  let initialSupply;
  let stakeAmount;
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

  const createProposal = async (
    account,
    targets = [bob.address, alice.address],
    values = [BigNumber.from("0"), BigNumber.from("0")],
    signatures = ["method1()", "method2()"],
    calldatas = [Buffer.from("Calldata1"), Buffer.from("Calldata2")],
    description = "Test description of proposal"
  ) => {
    const proposalId = await governor.hashProposal(targets, values, signatures, calldatas, description);

    await expect(autoProposer.connect(account).create(targets, values, signatures, calldatas, description))
      .to.emit(autoProposer, "AutonomousProposalCreated")
      .withArgs(
        account.address,
        proposalId,
        targets,
        values,
        signatures,
        calldatas.map((val) => "0x" + val.toString("hex")),
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

    // deploy ego governor contract
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

    // deploy autonomous proposer contract
    stakeAmount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
    const AutonomousProposer = await ethers.getContractFactory("AutonomousProposer");
    autoProposer = await AutonomousProposer.deploy(EGO.address, governor.address, stakeAmount);

    // grant dao admin role
    const DAO_ADMIN_ROLE = governor.DAO_ADMIN_ROLE();
    await accessRegistry.grantRole(DAO_ADMIN_ROLE, daoAdmin.address);

    // grant autonomous dao role
    const AUTONOMOUS_DAO_ROLE = governor.AUTONOMOUS_DAO_ROLE();
    await accessRegistry.grantRole(AUTONOMOUS_DAO_ROLE, autoProposer.address);

    // real blockchain has 16M blocks(we need more than blocksPerProposals blocks to be mined
    // in order to let code behave as expected)
    mine(blocksPerProposals * 2);

    snapshot = await ethers.provider.send("evm_snapshot", [+Date.now()]);
  });

  afterEach(async () => {
    await ethers.provider.send("evm_revert", [snapshot]);
  });

  describe("Initialization", () => {
    it("initialized all storage variables", async () => {
      expect(await autoProposer.token()).to.be.eq(EGO.address);
      expect(await autoProposer.governor()).to.be.eq(governor.address);
      expect(await autoProposer.stakeAmount()).to.be.eq(stakeAmount);
    });

    it("should revert on deploy if governor address wrong", async () => {
      const AutoProposer = await ethers.getContractFactory("AutonomousProposer");
      await expect(AutoProposer.deploy(EGO.address, accessRegistry.address, stakeAmount)).to.be.revertedWith(
        "AP: UNSUPPORTED_INTERFACE"
      );
    });
  });

  describe("Create", () => {
    it("should create autonomous proposal successfully", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);
    });

    it("should revert if account tries create second autonomous proposal in short time", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount.mul(2));
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount.mul(2));

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      const targets = [bob.address];
      const values = [BigNumber.from("0")];
      const signatures = ["method1()"];
      const calldatas = [Buffer.from("Calldata1")];
      const description = "Second proposal in a raw";

      await expect(
        autoProposer.connect(alice).create(targets, values, signatures, calldatas, description)
      ).to.be.revertedWith("Governor: LIMIT");
    });

    it("should create 2 proposals in a short time if accounts differ", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      await EGO.transfer(bob.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);
      await EGO.connect(bob).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      const targets = [bob.address];
      const values = [BigNumber.from("0")];
      const signatures = ["method1()"];
      const calldatas = [Buffer.from("Calldata1")];
      const description = "Second proposal in a raw";

      const secondProposalId = await createProposal(bob, targets, values, signatures, calldatas, description);

      expect(await governor.state(secondProposalId)).to.be.eq(ProposalState.Pending);
    });

    it("should create 2 autonomous proposal successfully with a specific interval", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount.mul(2));
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount.mul(2));

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      mine(blocksPerProposals);

      const targets = [bob.address];
      const values = [BigNumber.from("0")];
      const signatures = ["method1()"];
      const calldatas = [Buffer.from("Calldata1")];
      const description = "Second proposal in a raw";

      const secondProposalId = await governor.hashProposal(targets, values, signatures, calldatas, description);

      await expect(autoProposer.connect(alice).create(targets, values, signatures, calldatas, description))
        .to.emit(autoProposer, "AutonomousProposalCreated")
        .withArgs(
          alice.address,
          secondProposalId,
          targets,
          values,
          signatures,
          calldatas.map((val) => "0x" + val.toString("hex")),
          description
        );

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);
      expect(await governor.state(secondProposalId)).to.be.eq(ProposalState.Pending);
    });
  });

  describe("Create with permit", () => {
    it("should create autonomous proposal successfully", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);

      const { chainId } = await ethers.provider.getNetwork();
      const nonce = await EGO.nonces(alice.address);
      const deadline = ethers.constants.MaxUint256;

      const approvalDigest = await getApprovalDigest(
        EGO,
        {
          owner: alice.address,
          spender: autoProposer.address,
          value: stakeAmount,
        },
        nonce,
        deadline,
        chainId
      );
      const { v, r, s } = ecsign(
        Buffer.from(approvalDigest.slice(2), "hex"),
        Buffer.from(mockedAccounts[1].privateKey.slice(2), "hex")
      );

      const digest = {
        deadline: deadline,
        amount: stakeAmount,
        v: v,
        r: r,
        s: s,
      };

      const proposalId = await governor.hashProposal([], [], [], [], "Hello world!");

      await expect(autoProposer.connect(alice).createWithPermit(digest, [], [], [], [], "Hello world!"))
        .to.emit(autoProposer, "AutonomousProposalCreated")
        .withArgs(alice.address, proposalId, [], [], [], [], "Hello world!");

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);
    });
  });

  describe("Cancel", () => {
    it("should cancel proposal successfully", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await expect(autoProposer.connect(alice).cancel(proposalId))
        .to.emit(autoProposer, "AutonomousProposalCancelled")
        .withArgs(proposalId, alice.address);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Cancelled);

      expect(await EGO.balanceOf(alice.address)).to.be.eq(stakeAmount);
    });

    it("should revert on cancellation of proposal if user not author of proposal", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending); // Pending

      await expect(autoProposer.connect(bob).cancel(proposalId)).to.be.revertedWith("AP: INVALID_AUTHOR");
    });
  });

  describe("Withdraw", () => {
    it("should withdraw tokens successfully if proposal finished or rejected", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);

      // transfer EGO's to voter
      const bobAmount = BigNumber.from(2_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(bob.address, bobAmount);
      // To activate ur voting power delegate to yourself
      await EGO.connect(bob).delegate(bob.address);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingPeriod + votingDelay + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);

      await expect(autoProposer.connect(alice).withdraw(proposalId))
        .to.emit(autoProposer, "Withdraw")
        .withArgs(proposalId, alice.address, stakeAmount);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);
    });

    it("should revert on withdraw not from author", async () => {
      // transfer EGO's to proposer
      await EGO.transfer(alice.address, stakeAmount);
      // Approve tokens to allow contract get tokens
      await EGO.connect(alice).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(alice);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingPeriod + votingDelay + 1);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);

      await expect(autoProposer.connect(bob).withdraw(proposalId)).to.be.revertedWith("AP: INVALID_AUTHOR");

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);
    });
  });

  describe("Mutative", () => {
    it("should return only known public mutative functions", async () => {
      const AutoProposerContract = await ethers.getContractFactory("AutonomousProposer");
      const functions = Object.values(AutoProposerContract.interface.functions);

      const { fallbackFnc, mutable } = filterMutativeFunctions(functions);

      expect(fallbackFnc.length).to.be.eq(0);
      expect(mutable).to.be.eql(["cancel", "create", "createWithPermit", "withdraw"]);
    });
  });

  describe("Complex", () => {
    it("should take voting power from creator of autonomous proposal", async () => {
      // transfer EGO's to proposer
      const aliceAmount = BigNumber.from(50_000).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(alice.address, aliceAmount);
      await EGO.connect(alice).delegate(alice.address);

      // transfer EGO's to voter
      const bobAmount = BigNumber.from(100).mul(BigNumber.from(10).pow(18));
      await EGO.transfer(bob.address, bobAmount);
      await EGO.connect(bob).delegate(bob.address);
      // Approve tokens to allow contract get tokens
      await EGO.connect(bob).approve(autoProposer.address, stakeAmount);

      const proposalId = await createProposal(bob);

      expect(await EGO.balanceOf(bob.address)).to.be.eq(0);

      await mine(votingDelay + 1);

      await expect(governor.connect(bob).castVote(proposalId, VoteType.for, ""))
        .to.emit(governor, "VoteCast")
        .withArgs(bob.address, proposalId, 1, 0, "");

      await expect(governor.connect(alice).castVote(proposalId, VoteType.for, ""))
        .to.emit(governor, "VoteCast")
        .withArgs(alice.address, proposalId, 1, aliceAmount, "");

      await expect(autoProposer.connect(bob).withdraw(proposalId)).to.be.revertedWith("AP: NOT_FINISHED");

      await mine(votingPeriod);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Succeeded);

      await expect(autoProposer.connect(bob).withdraw(proposalId))
        .to.emit(autoProposer, "Withdraw")
        .withArgs(proposalId, bob.address, stakeAmount);

      expect(await EGO.balanceOf(bob.address)).to.be.eq(stakeAmount);

      await expect(autoProposer.connect(bob).withdraw(proposalId)).to.be.revertedWith("AP: INVALID_AUTHOR");
    });
  });

  describe("Quorum", () => {
    let signers;

    beforeEach(async () => {
      // set autonomous quorum numerator to 50, set denominator to 100
      await expect(governor.setPercentages("10", "50", "100")).not.to.be.reverted;

      expect(await governor.autonomousQuorumNumerator()).to.be.eq("50");
      expect(await governor.denominator()).to.be.eq("100");

      // 7 users total vote, each has 1/10 of total suppply
      // the numerator is 50, denominator is 100,
      // which gives us 1/2 of total supply required for quorum
      // it means at least 5 users need to vote

      // take new users
      signers = (await ethers.getSigners()).slice(6, 14);
    });

    it("cast votes 1 by 1, quorum reached, proposal succeeded", async () => {
      const [a, b, c, d, e, f, g, h] = signers;

      const amount = BigNumber.from(100_000).mul(DECIMALS);

      await Promise.all(signers.map((s) => EGO.transfer(s.address, amount)));
      await Promise.all(signers.map((s) => EGO.connect(s).delegate(s.address)));

      // Approve tokens to allow contract get tokens
      await EGO.connect(b).approve(autoProposer.address, amount);

      const proposalId = await createProposal(b);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + 1);

      // voting started
      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      const castVoteChecked = async (u, vote) => {
        await expect(governor.connect(u).castVote(proposalId, vote, ""))
          .to.emit(governor, "VoteCast")
          .withArgs(u.address, proposalId, vote, amount, "");
      };

      // 4 users still not enough
      for (const u of [a, c, d, e]) {
        await castVoteChecked(u, VoteType.for);
        expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);
        expect(await governor.quorumReached(proposalId)).to.be.false;
      }

      // 5-th user gives quorum
      await castVoteChecked(f, VoteType.against);
      expect(await governor.quorumReached(proposalId)).to.be.true;

      for (const u of [g, h]) {
        await castVoteChecked(u, VoteType.against);
        expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);
      }

      await mine(votingPeriod);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Succeeded);
    });

    it("cast votes 1 by 1, quorum reached, proposal defeated", async () => {
      const [a, b, c, d, e, f, g, h] = signers;

      const amount = BigNumber.from(100_000).mul(DECIMALS);

      await Promise.all(signers.map((s) => EGO.transfer(s.address, amount)));
      await Promise.all(signers.map((s) => EGO.connect(s).delegate(s.address)));

      // Approve tokens to allow contract get tokens
      await EGO.connect(b).approve(autoProposer.address, amount);

      const proposalId = await createProposal(b);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Pending);

      await mine(votingDelay + 1);

      // voting started
      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);

      const castVoteChecked = async (u, vote) => {
        await expect(governor.connect(u).castVote(proposalId, vote, ""))
          .to.emit(governor, "VoteCast")
          .withArgs(u.address, proposalId, vote, amount, "");
      };

      // 4 users still not enough
      for (const u of [a, c, d]) {
        await castVoteChecked(u, VoteType.for);
        expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);
        expect(await governor.quorumReached(proposalId)).to.be.false;
      }

      await castVoteChecked(e, VoteType.against);
      expect(await governor.quorumReached(proposalId)).to.be.false;

      // 5-th user gives quorum
      await castVoteChecked(f, VoteType.against);
      expect(await governor.quorumReached(proposalId)).to.be.true;

      for (const u of [g, h]) {
        await castVoteChecked(u, VoteType.against);
        expect(await governor.state(proposalId)).to.be.eq(ProposalState.Active);
      }

      await mine(votingPeriod);

      expect(await governor.state(proposalId)).to.be.eq(ProposalState.Defeated);
    });
  });
});
