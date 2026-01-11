/**
 * HTTP utilities for Chrysalis services (TypeScript).
 */
import http from 'http';
import { APIResponse, APIError, ErrorCode } from './models';
export declare function readJsonBody(req: http.IncomingMessage): Promise<any>;
export declare function sendJson<T>(res: http.ServerResponse, status: number, obj: APIResponse<T> | T): void;
export declare function sendError(res: http.ServerResponse, status: number, error: APIError): void;
export declare function sendText(res: http.ServerResponse, status: number, text: string): void;
export declare function notFound(res: http.ServerResponse): void;
export declare function methodNotAllowed(res: http.ServerResponse): void;
export declare function badRequest(res: http.ServerResponse, message: string, code?: ErrorCode): void;
export declare function serverError(res: http.ServerResponse, message: string, requestId?: string): void;
export declare function createHttpsServer(opts: {
    key: Buffer;
    cert: Buffer;
}, handler: http.RequestListener): http.Server;
//# sourceMappingURL=http.d.ts.map