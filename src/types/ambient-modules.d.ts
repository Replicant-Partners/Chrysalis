declare module 'hnswlib-node';
declare module 'lancedb';
declare module '@qdrant/js-client-rest';

declare module 'ws';

declare module 'y-websocket/bin/utils' {
  export function setupWSConnection(conn: any, req: any, opts?: any): void;
}
