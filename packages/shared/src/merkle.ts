import { encodePacked, keccak256, type Hex } from 'viem';

/**
 * Generates an unguessable 128-bit (16-byte) random secret represented as a 32-character hex string.
 * Printed under the scratch-off layer on the package.
 * Works seamlessly in both browser and Node.js environments.
 */
export function generateUnitSecret(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('crypto');
  return nodeCrypto.randomBytes(16).toString('hex');
}

/**
 * Backward compatibility alias for generateUnitSecret.
 */
export const generateUnitToken = generateUnitSecret;

/**
 * Computes keccak256(secret) for the 128-bit secret.
 */
export function computeSecretHash(secret: string): Hex {
  let clean = secret.trim().toLowerCase();
  if (!clean.startsWith('0x')) {
    clean = `0x${clean}`;
  }
  return keccak256(clean as Hex);
}

/**
 * Formats a unit token/secret into an EVM bytes32 value.
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
 * Leaf = keccak256(abi.encodePacked(uint256 batchId, uint32 serial, bytes32 secretHash))
 */
export function computeUnitLeaf(
  batchId: bigint | number,
  serial: number,
  secretHash: Hex
): Hex {
  return keccak256(
    encodePacked(
      ['uint256', 'uint32', 'bytes32'],
      [BigInt(batchId), serial, secretHash]
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
  secret: string;
  secretHash: Hex;
  token?: string;
  tokenBytes32?: Hex;
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
    secret: string;
    secretHash: Hex;
    leaf: Hex;
  }> = [];

  const leaves: Hex[] = [];

  for (let serial = 0; serial < count; serial++) {
    const secret = generateUnitSecret();
    const secretHash = computeSecretHash(secret);
    const leaf = computeUnitLeaf(batchId, serial, secretHash);

    unitsData.push({
      serial,
      secret,
      secretHash,
      leaf,
    });
    leaves.push(leaf);
  }

  const { root, proofs } = buildMerkleTree(leaves);

  const units: GeneratedUnit[] = unitsData.map((u, i) => ({
    ...u,
    token: u.secret,
    tokenBytes32: u.secretHash,
    proof: proofs[i],
  }));

  return { units, root };
}

