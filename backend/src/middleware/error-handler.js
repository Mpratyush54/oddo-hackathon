export const handleError = (error, req, res, next) => {
  const status =
    error.type === 'entity.too.large'
      ? 413
      : error.type === 'entity.parse.failed'
        ? 400
        : error.status || 503;
  if (!error.status && !error.type)
    console.error(
      JSON.stringify({
        type: error.name,
        route: req.path,
        requestId: req.apiGateway?.context?.awsRequestId,
      }),
    );
  res.status(status).json({
    error: error.type
      ? status === 413
        ? 'Request too large.'
        : 'Invalid JSON.'
      : error.status
        ? error.message
        : 'The service is temporarily unavailable.',
  });
};
