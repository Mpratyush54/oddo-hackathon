export const validateJsonObject = (req, res, next) => {
  if (
    req.body !== undefined &&
    (!req.body || Array.isArray(req.body) || typeof req.body !== 'object')
  )
    return res.status(400).json({ error: 'A JSON object is required.' });
  next();
};
