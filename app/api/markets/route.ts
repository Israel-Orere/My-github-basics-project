import {NextResponse} from 'next/server';
import {getLiveMarkets} from '@/lib/dreamdex';
export const dynamic='force-dynamic';
export async function GET(){try{const markets=await getLiveMarkets();return NextResponse.json({mode:'live',network:'Somnia Shannon',chainId:50312,markets},{headers:{'Cache-Control':'no-store'}})}catch(e){return NextResponse.json({mode:'unavailable',error:e instanceof Error?e.message:'DreamDEX market load failed'},{status:503})}}
