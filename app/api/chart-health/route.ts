import {NextResponse} from 'next/server';
import {fetchRecentSpotBarsRest} from '@/lib/spot-rest';

export const dynamic='force-dynamic';
export const maxDuration=15;

export async function GET(){
 try{
  const bars=await fetchRecentSpotBarsRest('BTC','15m',60),latest=bars[bars.length-1];
  return NextResponse.json({ok:bars.length>=40,source:'DreamDEX REST',asset:'BTC',timeframe:'15m',bars:bars.length,latestTime:latest?.time??null,latestClose:latest?.close??null,checkedAt:Date.now()},{status:bars.length>=40?200:503});
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Chart data probe failed.',checkedAt:Date.now()},{status:503})}
}
