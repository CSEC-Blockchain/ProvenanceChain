import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveUnitProofs } from '@/lib/db';

const ProofsSchema = z.object({
  batchId: z.number().int().positive(),
  units: z.array(
    z.object({
      serial: z.number().int().nonnegative(),
      proof: z.array(z.string()),
      secretHash: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ProofsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { batchId, units } = parsed.data;
    saveUnitProofs(batchId, units);

    return NextResponse.json({
      success: true,
      batchId,
      storedUnitsCount: units.length,
    });
  } catch (err: any) {
    console.error('Failed to store proofs:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
