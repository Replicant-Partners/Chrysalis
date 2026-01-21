import { credentials, loadPackageDefinition, ChannelCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'path';
import fs from 'fs';

const PROTO_PATH = path.join(__dirname, '../../mcp-servers-go/cryptographic-primitives/crypto.proto');
const pkgDef = loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proto = require('@grpc/grpc-js').loadPackageDefinition(pkgDef).cryptoprimitives as any;

export interface GoCryptoClientOptions {
  endpoint?: string;
  insecure?: boolean;
  rootCerts?: Buffer;
  privateKey?: Buffer;
  certChain?: Buffer;
}

export class GoCryptoClient {
  private client: any;
  
  constructor(options: GoCryptoClientOptions = {}) {
    const endpoint = options.endpoint ?? process.env.GO_CRYPTO_ENDPOINT ?? 'localhost:50051';
    const insecure = options.insecure ?? process.env.GO_CRYPTO_INSECURE === 'true';
    
    let creds: ChannelCredentials;
    
    if (insecure) {
      console.warn('[GoCryptoClient] Using insecure connection - NOT recommended for production');
      creds = credentials.createInsecure();
    } else {
      const rootCerts = options.rootCerts ?? (process.env.GO_CRYPTO_CA_CERT 
        ? fs.readFileSync(process.env.GO_CRYPTO_CA_CERT) 
        : undefined);
      const privateKey = options.privateKey ?? (process.env.GO_CRYPTO_CLIENT_KEY 
        ? fs.readFileSync(process.env.GO_CRYPTO_CLIENT_KEY) 
        : undefined);
      const certChain = options.certChain ?? (process.env.GO_CRYPTO_CLIENT_CERT 
        ? fs.readFileSync(process.env.GO_CRYPTO_CLIENT_CERT) 
        : undefined);
      
      creds = credentials.createSsl(rootCerts, privateKey, certChain);
    }
    
    this.client = new proto.CryptoPrimitives(endpoint, creds);
  }

  call(method: string, payload: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client[method](payload, (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }
}
