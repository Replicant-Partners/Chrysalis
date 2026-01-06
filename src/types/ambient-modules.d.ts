declare module 'hnswlib-node';
declare module 'lancedb';
// Note: qdrant removed - using LanceDB/ArangoDB instead

declare module 'ws';

declare module 'y-websocket/bin/utils' {
  export function setupWSConnection(conn: any, req: any, opts?: any): void;
}
