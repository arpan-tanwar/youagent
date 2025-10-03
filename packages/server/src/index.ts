/**
 * Fastify server for web UI
 *
 * TODO: Implement API routes for:
 * - POST /api/chat - Chat endpoint
 * - GET /api/sources - List data sources
 * - POST /api/refresh - Trigger refresh
 * - GET /api/health - Health check
 */

import Fastify from 'fastify';

export async function createServer(): Promise<ReturnType<typeof Fastify>> {
  const fastify = Fastify({
    logger: true,
  });

  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  return fastify;
}

