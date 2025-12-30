import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../../mcp-servers-go/cryptographic-primitives/crypto.proto');
const pkgDef = loadSync(PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
// eslint-disable-next-line @typescript-eslint/no-var-requires
const proto = require('@grpc/grpc-js').loadPackageDefinition(pkgDef).cryptoprimitives as any;

export class GoCryptoClient {
  private client: any;
  constructor(endpoint = 'localhost:50051') {
    this.client = new proto.CryptoPrimitives(endpoint, credentials.createInsecure());
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
