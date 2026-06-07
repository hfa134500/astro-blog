// Vercel Serverless Function — Find the latest deploy-hook deployment and assign it to the production domain
// Called by the admin panel after triggering a deploy hook

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'vca_6S3JgWIF3XS71SVKTi4NGg90sE9HyIgvZbyUpyfw6GlO6S5orB10J0gW';
const PROJECT_ID = 'prj_JLaBR1OufUKgQQPI4iY1EbclYX6t';
const TEAM_ID = 'team_wdoHbBri2ONJYaExAQv18xGz';
const DOMAIN = '61306130.xyz';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    // 1. List the 10 most recent deployments
    const listRes = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=10`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );

    if (!listRes.ok) {
      return res.status(502).json({ error: 'Failed to list deployments', status: listRes.status });
    }

    const listData = await listRes.json();
    const deployments = listData.deployments || [];

    // 2. Find the most recent READY deployment from the deploy hook
    const hookDeploy = deployments.find(d => 
      d.meta?.deployHookName === 'admin-trigger' && d.state === 'READY'
    );

    if (!hookDeploy) {
      return res.status(404).json({ 
        error: 'No ready deploy-hook deployment found',
        allStates: deployments.filter(d => d.meta?.deployHookName).map(d => ({state: d.state, url: d.url}))
      });
    }

    const deploymentId = hookDeploy.uid;
    const deploymentUrl = hookDeploy.url;

    console.log(`Found deployment: ${deploymentId} (${deploymentUrl})`);

    // 3. Assign this deployment to the production domain
    const aliasRes = await fetch(
      `https://api.vercel.com/v11/deployments/${deploymentId}/aliases?teamId=${TEAM_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alias: DOMAIN }),
      }
    );

    const aliasData = await aliasRes.json().catch(() => ({}));

    res.json({
      success: aliasRes.ok,
      deploymentUrl: `https://${deploymentUrl}`,
      domain: `https://${DOMAIN}`,
      aliasStatus: aliasRes.status,
      aliasUid: aliasData.uid || null,
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
