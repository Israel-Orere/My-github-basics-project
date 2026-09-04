import { createWalletClient, custom } from 'viem';
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from '@somnia-chain/markets-sdk';
import { somniaShannon } from '@somnia-chain/markets-sdk/chains';

export const SHANNON={chainId:'0xc488',chainName:'Somnia Shannon Testnet',nativeCurrency:{name:'Somnia Test Token',symbol:'STT',decimals:18},rpcUrls:['https://api.infra.testnet.somnia.network'],blockExplorerUrls:['https://shannon-explorer.somnia.network']};

export async function connectShannonWallet(){
  if(typeof window==='undefined'||!(window as any).ethereum)throw new Error('Install an EVM wallet such as MetaMask.');
  const eth=(window as any).ethereum;
  const accounts=await eth.request({method:'eth_requestAccounts'});
  try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:SHANNON.chainId}]});}
  catch(e:any){if(e?.code!==4902)throw e;await eth.request({method:'wallet_addEthereumChain',params:[SHANNON]});}
  return accounts[0] as `0x${string}`;
}

export async function createWalletExchange(){
  if(typeof window==='undefined'||!(window as any).ethereum)throw new Error('No EVM wallet found.');
  const account=await connectShannonWallet();
  const walletClient=createWalletClient({account,chain:somniaShannon,transport:custom((window as any).ethereum)});
  const exchange=new SomniaMarkets({
    indexerUrl:'https://dev.smk.somnia.host/v1/graphql',
    chain:somniaShannon,
    wsRpcUrl:'wss://api.infra.testnet.somnia.network/ws',
    addresses:SOMNIA_TESTNET_ADDRESSES
  });
  const trader=exchange.client.createTrader({walletClient:walletClient as any});
  return {exchange,trader,account};
}
