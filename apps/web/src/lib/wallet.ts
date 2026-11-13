import type { Hex } from 'viem';

export function getMetaMaskProvider(): any {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as any;

  if (anyWindow.ethereum?.providers?.length) {
    // If multiple injected wallets (e.g., Phantom + MetaMask), specifically grab MetaMask
    const metamask = anyWindow.ethereum.providers.find(
      (p: any) => p.isMetaMask && !p.isPhantom
    );
    if (metamask) return metamask;
  }

  if (anyWindow.ethereum?.isMetaMask && !anyWindow.ethereum?.isPhantom) {
    return anyWindow.ethereum;
  }

  return anyWindow.ethereum || null;
}

export async function sendMetaMaskTransaction({
  to,
  data,
  from,
}: {
  to: Hex;
  data: Hex;
  from?: Hex;
}): Promise<Hex> {
  const provider = getMetaMaskProvider();
  if (!provider) {
    throw new Error('MetaMask is not detected. Please install or enable MetaMask.');
  }

  // Ensure accounts are authorized by MetaMask
  const accounts: string[] = await provider.request({
    method: 'eth_requestAccounts',
  });

  if (!accounts || accounts.length === 0) {
    throw new Error('No authorized accounts found in MetaMask. Please connect an account.');
  }

  const sender = from || (accounts[0] as Hex);

  // Read current on-chain nonce directly to keep MetaMask perfectly synced with Anvil
  let nonceHex: string | undefined = undefined;
  try {
    nonceHex = await provider.request({
      method: 'eth_getTransactionCount',
      params: [sender, 'pending'],
    });
  } catch (err) {
    console.warn('Could not read nonce via eth_getTransactionCount, using default:', err);
  }

  const txParams: Record<string, any> = {
    from: sender,
    to,
    data,
  };

  if (nonceHex) {
    txParams.nonce = nonceHex;
  }

  try {
    const hash: Hex = await provider.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    });
    return hash;
  } catch (error: any) {
    // If a nonce desync happens, retry once with 'latest' block nonce
    if (error?.message && error.message.toLowerCase().includes('nonce')) {
      const fallbackNonce: string = await provider.request({
        method: 'eth_getTransactionCount',
        params: [sender, 'latest'],
      });
      txParams.nonce = fallbackNonce;
      const retryHash: Hex = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
      return retryHash;
    }
    throw error;
  }
}
