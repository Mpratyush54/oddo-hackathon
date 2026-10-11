export const handleError = (error, req, res, next) => {
  const validation = error.name === 'DatabaseValidationError';
  const status =
    error.type === 'entity.too.large'
      ? 413
      : error.type === 'entity.parse.failed'
        ? 400
        : error.status || (validation ? 500 : 503);
  if (!error.status && !error.type)
    console.error(
      JSON.stringify({
        type: error.name,
        route: req.path,
        requestId: req.apiGateway?.context?.awsRequestId,
        ...(validation ? { issues: error.issues?.slice(0, 8) } : {}),
      }),
    );
  res.status(status).json({
    ...(status === 400 && error.details ? { details: error.details } : {}),
    error: error.type
      ? status === 413
        ? 'Request too large.'
        : 'Invalid JSON.'
      : error.status
        ? error.message
        : validation
          ? 'Club data could not be saved. The API schema is out of date with stored records.'
          : 'The service is temporarily unavailable.',
  });
};
