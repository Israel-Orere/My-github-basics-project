import { NextResponse } from 'next/server';
import { getLiveMarkets } from '@/lib/dreamdex';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const markets = await getLiveMarkets();
    return NextResponse.json({
      mode: 'live',
      network: 'somnia-shannon',
      chainId: 50312,
      markets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        mode: 'unavailable',
        error: error instanceof Error ? error.message : 'Live DreamDEX market load failed',
      },
      { status: 503 },
    );
  }
}
