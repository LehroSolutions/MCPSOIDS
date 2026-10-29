import { NextRequest } from 'next/server';
import { proxyMcpGet, withOperator } from '@/lib/mcp-server';

export async function GET(request: NextRequest) {
    return withOperator(request, () => proxyMcpGet('/.well-known/mcp-health'));
}
