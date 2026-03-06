import crypto from 'crypto';

export function handleOAuthToken(sessionManager) {
  return (req, res) => {
    const { code, grant_type, refresh_token, code_verifier } = req.body;
    if (grant_type === 'refresh_token' && refresh_token) {
      const session = sessionManager.getSession(refresh_token);
      if (!session || session.status !== 'authenticated') {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token not found' });
      }
      return res.json({ access_token: refresh_token, token_type: 'bearer', expires_in: 2592000, refresh_token });
    }
    if (grant_type !== 'authorization_code' || !code) {
      return res.status(400).json({ error: 'invalid_request', error_description: `Expected grant_type=authorization_code and code, got ${grant_type}` });
    }
    const session = sessionManager.getSession(code);
    if (!session || session.status !== 'authenticated') {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Code not found or session not authenticated' });
    }
    if (session.codeChallenge) {
      if (!code_verifier) return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier required for PKCE' });
      const method = session.codeChallengeMethod || 'S256';
      const computed = method === 'S256'
        ? crypto.createHash('sha256').update(code_verifier).digest('base64url')
        : code_verifier;
      if (computed !== session.codeChallenge) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier does not match code_challenge' });
      }
    }
    res.json({ access_token: code, token_type: 'bearer', expires_in: 2592000, refresh_token: code });
  };
}

export function handleDynamicRegistration(req, res) {
  const { redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method } = req.body || {};
  if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required' });
  }
  const clientId = crypto.randomBytes(16).toString('hex');
  res.status(201).json({
    client_id: clientId,
    client_name: client_name || 'mcp-client',
    redirect_uris,
    grant_types: grant_types || ['authorization_code'],
    response_types: response_types || ['code'],
    token_endpoint_auth_method: token_endpoint_auth_method || 'none'
  });
}
