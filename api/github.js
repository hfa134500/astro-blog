// Vercel Serverless Function — Proxies all requests to GitHub API
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
  // Build URL without trailing slash when path is empty
  const url = path
    ? `https://api.github.com/repos/${repo}/${path}`
    : `https://api.github.com/repos/${repo}`;

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const options = {
    method: req.method,
    headers: {
      'Authorization': authHeader,
      'Accept': req.headers.accept || 'application/vnd.github.v3+json',
      'User-Agent': 'blog-admin-proxy',
    },
  };

  if (req.body && ['PUT','POST','PATCH','DELETE'].includes(req.method)) {
    options.body = JSON.stringify(req.body);
    options.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    res.status(response.status);

    if (response.status === 204) { res.end(); return; }

    if (contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(502).json({ error: 'Failed to connect to GitHub API', detail: error.message });
  }
}
