// Vercel Serverless Function — Proxies all requests to GitHub API
// This solves the "Failed to fetch" issue when browsers can't reach api.github.com directly

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const path = req.query.path || '';
  const repo = req.query.repo || 'hfa134500/astro-blog';
  const url = `https://api.github.com/repos/${repo}/${path}`;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  // Forward relevant headers
  const options = {
    method: req.method,
    headers: {
      'Authorization': authHeader,
      'Accept': req.headers.accept || 'application/vnd.github.v3+json',
      'User-Agent': 'blog-admin-proxy',
    },
  };

  // Forward body for PUT/POST/PATCH/DELETE
  if (req.body && ['PUT','POST','PATCH','DELETE'].includes(req.method)) {
    options.body = JSON.stringify(req.body);
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(options.body).toString();
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    res.status(response.status);

    if (response.status === 204) {
      res.end();
      return;
    }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({
      error: 'Failed to connect to GitHub API',
      detail: error.message,
    });
  }
}
