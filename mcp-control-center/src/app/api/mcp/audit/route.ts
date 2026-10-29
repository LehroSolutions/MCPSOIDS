import { NextRequest } from 'next/server';
import { proxyMcpGet, withOperator } from '@/lib/mcp-server';

export async function GET(request: NextRequest) {
    const limit = request.nextUrl.searchParams.get('limit') ?? '50';
    return withOperator(request, () => proxyMcpGet(`/audit/entries?limit=${encodeURIComponent(limit)}`));
}
