import { NextRequest, NextResponse } from 'next/server';

/**
 * RPC Proxy — forwards JSON-RPC requests from MetaMask to the local Anvil node.
 * MetaMask sometimes can't reach 127.0.0.1:8545 directly due to browser security
 * policies. This proxy lets MetaMask use http://localhost:3000/api/rpc instead.
 */
const ANVIL_RPC = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const rpcRes = await fetch(ANVIL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await rpcRes.text();
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32603, message: error.message }, id: null },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

