import { encodePacked, keccak256, type Hex } from 'viem';
import * as crypto from 'crypto';

/**
 * Generates an unguessable 128-bit (16-byte) random token represented as a 32-character hex string.
 * Used on physical unit QR codes.
 */
export function generateUnitToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Formats a unit token (128-bit / 32 hex chars, or 64 hex chars) into an EVM bytes32 value.
 */
export function tokenToBytes32(token: string): Hex {
  let clean = token.toLowerCase();
  if (clean.startsWith('0x')) {
    clean = clean.slice(2);
  }
  // Pad to 64 hex characters (32 bytes)
  const padded = clean.padEnd(64, '0').slice(0, 64);
  return `0x${padded}`;
}

/**
 * Computes the keccak256 leaf hash for a unit in a batch:
 * Leaf = keccak256(abi.encodePacked(uint256 batchId, uint32 serial, bytes32 token))
 */
export function computeUnitLeaf(
  batchId: bigint | number,
  serial: number,
  tokenBytes32: Hex
): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'uint32', 'bytes32'],
      [BigInt(batchId), serial, tokenBytes32]
    )
  );
}

/**
 * OpenZeppelin-compatible commutative pair hashing:
 * a < b ? keccak256(a, b) : keccak256(b, a)
 */
export function hashPair(a: Hex, b: Hex): Hex {
  const bigA = BigInt(a);
  const bigB = BigInt(b);
  if (bigA < bigB) {
    return keccak256(encodePacked(['bytes32', 'bytes32'], [a, b]));
  } else {
    return keccak256(encodePacked(['bytes32', 'bytes32'], [b, a]));
  }
}

/**
 * Constructs a Merkle tree and generates proofs for all leaves.
 * Compatible with OpenZeppelin's MerkleProof.verify.
 */
export function buildMerkleTree(leaves: Hex[]): {
  root: Hex;
  proofs: Hex[][];
} {
  if (leaves.length === 0) {
    throw new Error('Cannot build Merkle tree from empty leaves');
  }

  if (leaves.length === 1) {
    return {
      root: leaves[0],
      proofs: [[]],
    };
  }

  // Initialize proofs for each original leaf
  const proofs: Hex[][] = leaves.map(() => []);

  // Track the original indices in the current layer
  let currentLayerIndices: number[][] = leaves.map((_, i) => [i]);
  let currentLayer: Hex[] = [...leaves];

  while (currentLayer.length > 1) {
    const nextLayer: Hex[] = [];
    const nextLayerIndices: number[][] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1];
        const parent = hashPair(left, right);

        // Every leaf under left gets right added to its proof
        for (const idx of currentLayerIndices[i]) {
          proofs[idx].push(right);
        }
        // Every leaf under right gets left added to its proof
        for (const idx of currentLayerIndices[i + 1]) {
          proofs[idx].push(left);
        }

        nextLayer.push(parent);
        nextLayerIndices.push([...currentLayerIndices[i], ...currentLayerIndices[i + 1]]);
      } else {
        // Odd node promoted to next layer without pairing
        nextLayer.push(currentLayer[i]);
        nextLayerIndices.push(currentLayerIndices[i]);
      }
    }

    currentLayer = nextLayer;
    currentLayerIndices = nextLayerIndices;
  }

  return {
    root: currentLayer[0],
    proofs,
  };
}

/**
 * Verifies a Merkle proof in JS/TS exactly as OpenZeppelin MerkleProof.verify does in Solidity.
 */
export function verifyMerkleProof(root: Hex, leaf: Hex, proof: Hex[]): boolean {
  let computedHash = leaf;
  for (const proofElement of proof) {
    computedHash = hashPair(computedHash, proofElement);
  }
  return computedHash.toLowerCase() === root.toLowerCase();
}

export interface GeneratedUnit {
  serial: number;
  token: string;
  tokenBytes32: Hex;
  leaf: Hex;
  proof: Hex[];
}

export interface GeneratedBatchUnits {
  units: GeneratedUnit[];
  root: Hex;
}

/**
 * Generates all units, leaves, Merkle root, and proofs for a batch.
 */
export function generateBatchUnits(
  batchId: bigint | number,
  count: number
): GeneratedBatchUnits {
  if (count <= 0) {
    throw new Error('Unit count must be greater than 0');
  }

  const unitsData: Array<{
    serial: number;
    token: string;
    tokenBytes32: Hex;
    leaf: Hex;
  }> = [];

  const leaves: Hex[] = [];

  for (let serial = 0; serial < count; serial++) {
    const token = generateUnitToken();
    const tokenBytes32 = tokenToBytes32(token);
    const leaf = computeUnitLeaf(batchId, serial, tokenBytes32);

    unitsData.push({
      serial,
      token,
      tokenBytes32,
      leaf,
    });
    leaves.push(leaf);
  }

  const { root, proofs } = buildMerkleTree(leaves);

  const units: GeneratedUnit[] = unitsData.map((u, i) => ({
    ...u,
    proof: proofs[i],
  }));

  return { units, root };
}

