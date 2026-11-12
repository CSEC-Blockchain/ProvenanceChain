import { describe, it, expect } from 'vitest';
import {
  generateUnitToken,
  tokenToBytes32,
  computeUnitLeaf,
  hashPair,
  buildMerkleTree,
  verifyMerkleProof,
  generateBatchUnits,
} from '../src/merkle.js';
import { keccak256, encodePacked } from 'viem';

describe('Merkle & Unit Token Utilities', () => {
  it('generates 128-bit unguessable tokens (32 hex characters)', () => {
    const token1 = generateUnitToken();
    const token2 = generateUnitToken();
    expect(token1).toHaveLength(32);
    expect(token2).toHaveLength(32);
    expect(token1).not.toBe(token2);
    expect(/^[0-9a-f]{32}$/.test(token1)).toBe(true);
  });

  it('formats tokens into bytes32 correctly', () => {
    const raw = 'e4d9b2a7c8f1034e9a8b7c6d5e4f3a21';
    const b32 = tokenToBytes32(raw);
    expect(b32).toBe(`0x${raw}00000000000000000000000000000000`);
    expect(b32).toHaveLength(66); // '0x' + 64 hex characters = 32 bytes
  });

  it('hashes pairs commutatively matching EVM bytes32 ordering', () => {
    const hashA = keccak256(encodePacked(['string'], ['apple']));
    const hashB = keccak256(encodePacked(['string'], ['banana']));

    const pair1 = hashPair(hashA, hashB);
    const pair2 = hashPair(hashB, hashA);

    expect(pair1).toBe(pair2);

    // Verify ordering
    const sorted = BigInt(hashA) < BigInt(hashB)
      ? keccak256(encodePacked(['bytes32', 'bytes32'], [hashA, hashB]))
      : keccak256(encodePacked(['bytes32', 'bytes32'], [hashB, hashA]));
    expect(pair1).toBe(sorted);
  });

  it('builds valid Merkle tree and verifies 1 unit', () => {
    const { units, root } = generateBatchUnits(1n, 1);
    expect(units).toHaveLength(1);
    expect(root).toBe(units[0].leaf);
    expect(verifyMerkleProof(root, units[0].leaf, units[0].proof)).toBe(true);
  });

  it('builds valid Merkle tree and verifies 2 units (power of 2)', () => {
    const { units, root } = generateBatchUnits(1n, 2);
    expect(units).toHaveLength(2);
    for (const unit of units) {
      expect(verifyMerkleProof(root, unit.leaf, unit.proof)).toBe(true);
    }
  });

  it('builds valid Merkle tree and verifies odd unit counts (3 units)', () => {
    const { units, root } = generateBatchUnits(42n, 3);
    expect(units).toHaveLength(3);
    for (const unit of units) {
      expect(verifyMerkleProof(root, unit.leaf, unit.proof)).toBe(true);
    }
  });

  it('builds valid Merkle tree and verifies a 50-unit batch', () => {
    const batchId = 100n;
    const count = 50;
    const { units, root } = generateBatchUnits(batchId, count);

    expect(units).toHaveLength(count);
    expect(root).toMatch(/^0x[0-9a-f]{64}$/);

    for (let i = 0; i < count; i++) {
      const u = units[i];
      expect(u.serial).toBe(i);
      const ok = verifyMerkleProof(root, u.leaf, u.proof);
      expect(ok).toBe(true);
    }
  });

  it('fails verification on tampered leaf, serial, or token', () => {
    const batchId = 5n;
    const { units, root } = generateBatchUnits(batchId, 10);
    const target = units[3];

    // Valid passes
    expect(verifyMerkleProof(root, target.leaf, target.proof)).toBe(true);

    // Tampered token
    const fakeToken = tokenToBytes32('00000000000000000000000000000000');
    const fakeLeaf = computeUnitLeaf(batchId, target.serial, fakeToken);
    expect(verifyMerkleProof(root, fakeLeaf, target.proof)).toBe(false);

    // Tampered serial
    const fakeSerialLeaf = computeUnitLeaf(batchId, target.serial + 1, target.tokenBytes32);
    expect(verifyMerkleProof(root, fakeSerialLeaf, target.proof)).toBe(false);

    // Tampered batchId
    const fakeBatchLeaf = computeUnitLeaf(batchId + 1n, target.serial, target.tokenBytes32);
    expect(verifyMerkleProof(root, fakeBatchLeaf, target.proof)).toBe(false);

    // Tampered proof element
    const corruptedProof = [...target.proof];
    corruptedProof[0] = keccak256(encodePacked(['string'], ['corrupt']));
    expect(verifyMerkleProof(root, target.leaf, corruptedProof)).toBe(false);
  });
});

