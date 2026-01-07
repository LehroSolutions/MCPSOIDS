import { z } from 'zod';

export enum JsonRpcErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    // Custom Server Errors
    Timeout = -32000,
}

export const JsonRpcRequestSchema = z.object({
    jsonrpc: z.literal("2.0"),
    method: z.string(),
    params: z.any().optional(),
    id: z.union([z.string(), z.number(), z.null()]).optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    result?: any;
    error?: JsonRpcError;
    id: string | number | null;
}

export function createSuccessResponse(id: string | number | null, result: any): JsonRpcResponse {
    return {
        jsonrpc: "2.0",
        id,
        result,
    };
}

export function createErrorResponse(id: string | number | null, code: number, message: string, data?: any): JsonRpcResponse {
    return {
        jsonrpc: "2.0",
        id,
        error: { code, message, data },
    };
}
