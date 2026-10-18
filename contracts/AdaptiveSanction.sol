// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * LokPulse AdaptiveSanction
 * --------------------------
 * Production sketch for the sanction + DBT escrow flow.
 * Quorum size is set from off-chain LokScore at attestation time:
 *   score >= 80 → quorum 2
 *   score >= 60 → quorum 3
 *   else        → quorum 4 (+ mentor flag off-chain)
 *
 * Frontend demo uses equivalent ECDSA attestations via ethers.js
 * so judges can verify signatures without a testnet key during pitch.
 */
contract AdaptiveSanction {
    address public nsfdcAdmin;
    mapping(address => bool) public isVerifier;

    struct Case {
        bytes32 reportHash;
        address beneficiary;
        uint256 loanAmount;
        uint8 quorumRequired;
        uint8 signatureCount;
        bool mentorRequired;
        bool released;
        mapping(address => bool) signed;
    }

    mapping(bytes32 => Case) private cases;
    mapping(bytes32 => bool) public caseExists;

    event CaseOpened(bytes32 indexed caseId, bytes32 reportHash, uint8 quorum, uint256 loanAmount);
    event CaseSigned(bytes32 indexed caseId, address indexed verifier, uint8 count);
    event EscrowReleased(bytes32 indexed caseId, address indexed beneficiary, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == nsfdcAdmin, "not admin");
        _;
    }

    constructor(address[] memory verifiers) {
        nsfdcAdmin = msg.sender;
        for (uint256 i = 0; i < verifiers.length; i++) {
            isVerifier[verifiers[i]] = true;
        }
    }

    function openCase(
        bytes32 caseId,
        bytes32 reportHash,
        address beneficiary,
        uint256 loanAmount,
        uint8 quorumRequired,
        bool mentorRequired
    ) external onlyAdmin {
        require(!caseExists[caseId], "exists");
        require(quorumRequired >= 2 && quorumRequired <= 5, "bad quorum");
        Case storage c = cases[caseId];
        c.reportHash = reportHash;
        c.beneficiary = beneficiary;
        c.loanAmount = loanAmount;
        c.quorumRequired = quorumRequired;
        c.mentorRequired = mentorRequired;
        caseExists[caseId] = true;
        emit CaseOpened(caseId, reportHash, quorumRequired, loanAmount);
    }

    function signCase(bytes32 caseId) external {
        require(isVerifier[msg.sender], "not verifier");
        require(caseExists[caseId], "missing");
        Case storage c = cases[caseId];
        require(!c.released, "released");
        require(!c.signed[msg.sender], "already");
        c.signed[msg.sender] = true;
        c.signatureCount += 1;
        emit CaseSigned(caseId, msg.sender, c.signatureCount);
    }

    function release(bytes32 caseId) external onlyAdmin {
        require(caseExists[caseId], "missing");
        Case storage c = cases[caseId];
        require(!c.released, "released");
        require(c.signatureCount >= c.quorumRequired, "no quorum");
        c.released = true;
        // In production: trigger PFMS / DBT rail; here we emit the release event.
        emit EscrowReleased(caseId, c.beneficiary, c.loanAmount);
    }

    function getCase(bytes32 caseId)
        external
        view
        returns (
            bytes32 reportHash,
            address beneficiary,
            uint256 loanAmount,
            uint8 quorumRequired,
            uint8 signatureCount,
            bool mentorRequired,
            bool released
        )
    {
        Case storage c = cases[caseId];
        return (
            c.reportHash,
            c.beneficiary,
            c.loanAmount,
            c.quorumRequired,
            c.signatureCount,
            c.mentorRequired,
            c.released
        );
    }
}
