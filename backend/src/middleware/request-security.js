import serverlessExpress from '@codegenie/serverless-express';

export const createRequestSecurity =
  ({ env }) =>
  (req, res, next) => {
    const invoke = serverlessExpress.getCurrentInvoke();
    if (invoke?.event) req.apiGateway = invoke;
    res.set({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    // API Gateway supplies the original client IP. Do not trust forwarded IP headers.
    req.clientIp =
      req.apiGateway?.event?.requestContext?.http?.sourceIp || req.socket.remoteAddress;
    Object.defineProperty(req, 'ip', { value: req.clientIp });
    const webhook = req.path === '/api/webhooks/whatsapp';
    if (!webhook && !['GET', 'HEAD'].includes(req.method)) {
      const allowed = new Set(
        String(env.APP_ORIGIN || 'http://127.0.0.1:5174,http://localhost:5174').split(','),
      );
      if (
        (req.headers.origin && !allowed.has(req.headers.origin)) ||
        req.headers['x-skyline-client'] !== 'web'
      )
        return res.status(403).json({ error: 'Request origin or client verification failed.' });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return res.status(403).json({ error: 'Cross-site request blocked.' });
    }
    next();
  };
