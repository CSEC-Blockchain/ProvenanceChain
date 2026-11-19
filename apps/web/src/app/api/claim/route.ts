import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { computeSecretHash } from '@provenance/shared';
import { getUnitProof } from '@/lib/db';
import { publicClient, getContractAddress, ProvenanceRegistryABI } from '@/lib/viem';
import { submitClaimUnitOnChain } from '@/lib/relayer';

const ClaimSchema = z.object({
  batchId: z.number().int().positive(),
  serial: z.number().int().nonnegative(),
  secret: z.string().min(1),
});

// Simple in-memory rate limiting map: ip -> { count, expires }
const rateLimitMap = new Map<string, { count: number; expires: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.expires < now) {
    rateLimitMap.set(ip, { count: 1, expires: now + 60_000 });
    return true;
  }
  if (entry.count >= 15) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = ClaimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { batchId, serial, secret } = parsed.data;
    const contractAddress = getContractAddress();

    // 1. Check if already claimed on-chain
    const alreadyClaimed = (await publicClient.readContract({
      address: contractAddress,
      abi: ProvenanceRegistryABI,
      functionName: 'isClaimed',
      args: [BigInt(batchId), serial],
    })) as boolean;

    if (alreadyClaimed) {
      const timestamp = (await publicClient.readContract({
        address: contractAddress,
        abi: ProvenanceRegistryABI,
        functionName: 'claimedAt',
        args: [BigInt(batchId), serial],
      })) as bigint;

      return NextResponse.json({
        status: 'ALREADY_CLAIMED',
        claimedAt: Number(timestamp) * 1000,
        message: 'This scratch-off code was already claimed previously.',
      });
    }

    // 2. Fetch Merkle proof from off-chain DB
    const proofRecord = getUnitProof(batchId, serial);
    if (!proofRecord) {
      return NextResponse.json({
        status: 'INVALID',
        error: 'Unit proofs for this batch were not registered with the relayer.',
      });
    }

    // 3. Compute secret hash and verify proof against on-chain root
    const secretHash = computeSecretHash(secret);
    const isValid = (await publicClient.readContract({
      address: contractAddress,
      abi: ProvenanceRegistryABI,
      functionName: 'verifyUnit',
      args: [BigInt(batchId), serial, secretHash, proofRecord.proof],
    })) as boolean;

    if (!isValid) {
      return NextResponse.json({
        status: 'INVALID',
        error: 'Scratch secret does not match this unit or has been tampered with.',
      });
    }

    // 4. Submit claim transaction on-chain via authorized relayer
    const txHash = await submitClaimUnitOnChain(
      batchId,
      serial,
      secretHash,
      proofRecord.proof
    );

    // Wait for receipt confirmation
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    return NextResponse.json({
      status: 'GENUINE_CLAIMED',
      txHash,
      claimedAt: Date.now(),
      message: 'Genuine unit successfully claimed and verified on-chain!',
    });
  } catch (err: any) {
    console.error('Relayer claim error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process unit claim' },
      { status: 500 }
    );
  }
}
