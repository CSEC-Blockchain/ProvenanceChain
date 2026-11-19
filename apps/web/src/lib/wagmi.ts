import { http, createConfig } from 'wagmi';
import { defineChain } from 'viem';
import { injected } from '@wagmi/connectors/injected';

export const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'],
    },
  },
});

export const baseSepoliaChain = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://sepolia.basescan.org' },
  },
});

export const sepoliaChain = defineChain({
  id: 11155111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
        'https://rpc.sepolia.ethpandaops.io',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
});

export const activeChain =
  process.env.NEXT_PUBLIC_CHAIN_ID === '31337'
    ? anvilChain
    : process.env.NEXT_PUBLIC_CHAIN_ID === '84532'
    ? baseSepoliaChain
    : sepoliaChain;

export const isBaseSepolia = activeChain.id === 84532;
export const isSepolia = activeChain.id === 11155111;

export const wagmiConfig = createConfig({
  chains: [anvilChain, baseSepoliaChain, sepoliaChain],
  connectors: [
    injected({
      target() {
        if (typeof window === 'undefined') return undefined;
        const anyWin = window as any;
        // Specifically filter for MetaMask and reject Phantom or others
        if (anyWin.ethereum?.providers?.length) {
          const mm = anyWin.ethereum.providers.find(
            (p: any) => p.isMetaMask && !p.isPhantom
          );
          if (mm) return { id: 'metaMask', name: 'MetaMask', provider: mm };
        }
        if (anyWin.ethereum?.isMetaMask && !anyWin.ethereum?.isPhantom) {
          return { id: 'metaMask', name: 'MetaMask', provider: anyWin.ethereum };
        }
        return { id: 'metaMask', name: 'MetaMask', provider: anyWin.ethereum };
      },
    }),
  ],
  transports: {
    [anvilChain.id]: http(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'),
    [baseSepoliaChain.id]: http('https://sepolia.base.org'),
    [sepoliaChain.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  ssr: true,
});
