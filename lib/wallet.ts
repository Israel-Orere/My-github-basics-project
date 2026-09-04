import { createWalletClient, custom } from 'viem';
import { SomniaMarkets } from '@somnia-chain/markets-sdk';

export const SHANNON={chainId:'0xc488',chainName:'Somnia Shannon Testnet',nativeCurrency:{name:'Somnia Test Token',symbol:'STT',decimals:18},rpcUrls:['https://api.infra.testnet.somnia.network'],blockExplorerUrls:['https://shannon-explorer.somnia.network']};

const chain={id:50312,name:'Somnia Shannon',nativeCurrency:{name:'Somnia Test Token',symbol:'STT',decimals:18},rpcUrls:{default:{http:['https://api.infra.testnet.somnia.network'],webSocket:['wss://api.infra.testnet.somnia.network/ws']}}} as const;
const addresses={collateral:'0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',testUsdc:'0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E',binaryModule:'0x3ecC694Cef705358864a646142ac17A90E29e388',marketsCore:'0x2802504314685D89bF6C992CA5a8e7cC78bc0294',binarySettlement:'0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23',collateralRouter:'0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C',oracleHub:'0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b',marketCreator:'0x5Ce69567dB39C8fBAd7e048bEfdbcCdfE67B44e6'} as const;

export async function connectShannonWallet(){if(typeof window==='undefined'||!(window as any).ethereum)throw new Error('Install an EVM wallet such as MetaMask.');const eth=(window as any).ethereum;const accounts=await eth.request({method:'eth_requestAccounts'});try{await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:SHANNON.chainId}]});}catch(e:any){if(e?.code!==4902)throw e;await eth.request({method:'wallet_addEthereumChain',params:[SHANNON]});}return accounts[0] as `0x${string}`;}

export async function createWalletExchange(){if(typeof window==='undefined'||!(window as any).ethereum)throw new Error('No EVM wallet found.');const account=await connectShannonWallet();const walletClient=createWalletClient({account,chain:chain as any,transport:custom((window as any).ethereum)});return new SomniaMarkets({indexerUrl:'https://dev.smk.somnia.host/v1/graphql',chain:chain as any,wsRpcUrl:'wss://api.infra.testnet.somnia.network/ws',addresses:addresses as any,walletClient:walletClient as any});}
