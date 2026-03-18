const validateApiKey = (req, res, next) => {
  const incomingApiKey = req.header('x-api-key') || req.body.apiKey;

  if (!process.env.API_KEY) {
    return res.status(500).json({
      message: 'API key protection is not configured on this server.',
    });
  }

  if (!incomingApiKey || incomingApiKey !== process.env.API_KEY) {
    return res.status(401).json({
      message: 'Invalid API key.',
    });
  }

  return next();
};

module.exports = validateApiKey;
