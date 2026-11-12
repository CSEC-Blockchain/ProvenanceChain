import { publicClient, getContractAddress, ProvenanceRegistryABI } from './viem';
import { BatchStatus, type Batch, type CustodyEvent, type VerifiedBatchResult, type UserRole } from '@provenance/shared';

export async function readBatchFromChain(batchId: number): Promise<VerifiedBatchResult> {
  const contractAddress = getContractAddress();

  try {
    const rawBatch: any = await publicClient.readContract({
      address: contractAddress,
      abi: ProvenanceRegistryABI,
      functionName: 'getBatch',
      args: [BigInt(batchId)],
    });

    const rawHistory: any[] = (await publicClient.readContract({
      address: contractAddress,
      abi: ProvenanceRegistryABI,
      functionName: 'getHistory',
      args: [BigInt(batchId)],
    })) as any[];

    const batch: Batch = {
      id: rawBatch.id,
      producer: rawBatch.producer,
      currentHolder: rawBatch.currentHolder,
      pendingHolder: rawBatch.pendingHolder,
      productName: rawBatch.productName,
      origin: rawBatch.origin,
      metadataHash: rawBatch.metadataHash,
      unitCount: Number(rawBatch.unitCount),
      createdAt: rawBatch.createdAt,
      status: Number(rawBatch.status) as BatchStatus,
    };

    const history: CustodyEvent[] = rawHistory.map((evt) => ({
      from: evt.from,
      to: evt.to,
      timestamp: evt.timestamp,
      location: evt.location,
    }));

    // Fetch display names for all involved parties
    const uniqueAddresses = Array.from(
      new Set([
        batch.producer.toLowerCase(),
        batch.currentHolder.toLowerCase(),
        batch.pendingHolder !== '0x0000000000000000000000000000000000000000'
          ? batch.pendingHolder.toLowerCase()
          : null,
        ...history.map((h) => h.from.toLowerCase()),
        ...history.map((h) => h.to.toLowerCase()),
      ].filter(Boolean) as string[])
    );

    const nameMap: Record<string, string> = {};
    for (const addr of uniqueAddresses) {
      try {
        const name: string = (await publicClient.readContract({
          address: contractAddress,
          abi: ProvenanceRegistryABI,
          functionName: 'displayName',
          args: [addr as `0x${string}`],
        })) as string;
        nameMap[addr] = name && name.trim() !== '' ? name : '';
      } catch {
        nameMap[addr] = '';
      }
    }

    // Determine roles for current & pending holders to evaluate custody completeness
    let currentHolderRole: string = 'NONE';
    try {
      currentHolderRole = (await publicClient.readContract({
        address: contractAddress,
        abi: ProvenanceRegistryABI,
        functionName: 'getRole',
        args: [batch.currentHolder],
      })) as string;
    } catch {}

    const hasPendingTransfer =
      batch.pendingHolder !== '0x0000000000000000000000000000000000000000';

    // Verify unbroken custody flow
    let isCustodyChainComplete = false;
    let verdict: 'AUTHENTIC' | 'CAUTION' | 'RECALLED' | 'NOT_FOUND' = 'AUTHENTIC';
    let verdictReason = 'Full unbroken custody chain verified directly on the blockchain.';

    if (batch.status === BatchStatus.Recalled) {
      verdict = 'RECALLED';
      verdictReason =
        'This product batch has been officially RECALLED by the producer or administrator for safety reasons.';
    } else if (hasPendingTransfer) {
      verdict = 'CAUTION';
      verdictReason =
        'Custody handover is currently in transit/pending and has not yet been confirmed by the recipient.';
    } else if (currentHolderRole === 'SHOP') {
      verdict = 'AUTHENTIC';
      isCustodyChainComplete = true;
      verdictReason =
        batch.status === BatchStatus.SoldOut
          ? 'Genuine item — batch reached verified retail shop and is marked Sold Out.'
          : 'Genuine product — verified unbroken journey from registered producer to certified retail shop.';
    } else if (currentHolderRole === 'DISTRIBUTOR') {
      verdict = 'CAUTION';
      verdictReason =
        'Product is currently held at a wholesale distribution facility and has not yet reached a certified retail shop.';
    } else if (currentHolderRole === 'PRODUCER') {
      verdict = 'CAUTION';
      verdictReason =
        'Batch is still registered at the producer site and has not completed distribution to retail shops.';
    } else {
      verdict = 'CAUTION';
      verdictReason = 'Current holding entity is not recognized as a certified retail vendor.';
    }

    return {
      batchId,
      batch,
      history,
      producerName: nameMap[batch.producer.toLowerCase()] || 'Registered Producer',
      currentHolderName: nameMap[batch.currentHolder.toLowerCase()] || 'Authorized Holder',
      pendingHolderName: hasPendingTransfer
        ? nameMap[batch.pendingHolder.toLowerCase()] || 'Pending Recipient'
        : undefined,
      verdict,
      verdictReason,
      isCustodyChainComplete,
    };
  } catch (err: any) {
    return {
      batchId,
      batch: null as any,
      history: [],
      producerName: '',
      currentHolderName: '',
      verdict: 'NOT_FOUND',
      verdictReason:
        'This product batch ID does not exist in the blockchain provenance registry. It may be counterfeit.',
      isCustodyChainComplete: false,
    };
  }
}

