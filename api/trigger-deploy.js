// Vercel Serverless Function — Trigger deploy + re-alias to production domain
// Called by the admin panel after saving/deleting articles
// Uses Vercel API to trigger deploy hook, wait for completion, and assign domain

const VERCEL_TOKEN = process.env.VERCEL_TOKEN || 'vca_6S3JgWIF3XS71SVKTi4NGg90sE9HyIgvZbyUpyfw6GlO6S5orB10J0gW';
const PROJECT_ID = 'prj_JLaBR1OufUKgQQPI4iY1EbclYX6t';
const TEAM_ID = 'team_wdoHbBri2ONJYaExAQv18xGz';
const DOMAIN = '61306130.xyz';
const DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/prj_JLaBR1OufUKgQQPI4iY1EbclYX6t/LcHoVeNQ1I';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Step 1: Trigger the deploy hook
    console.log('Triggering deploy hook...');
    const hookRes = await fetch(DEPLOY_HOOK_URL, { method: 'POST' });
    
    if (!hookRes.ok) {
      const errText = await hookRes.text().catch(() => '');
      console.error('Deploy hook failed:', hookRes.status, errText);
      res.status(502).json({ error: 'Deploy hook failed', detail: errText });
      return;
    }

    const hookData = await hookRes.json().catch(() => ({}));
    const jobId = hookData.job?.id;
    console.log('Deploy hook triggered, job:', jobId);

    // Step 2: Wait for the deployment to appear (poll)
    let deploymentId = null;
    let deploymentUrl = null;
    
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      
      // List recent deployments to find the new one
      const listRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=5&target=production`,
        { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
      );
      
      if (listRes.ok) {
        const listData = await listRes.json();
        const deployments = listData.deployments || [];
        
        if (deployments.length > 0) {
          // Find the most recent deployment triggered by deploy hook
          const hookDeploy = deployments.find(d => d.meta?.deployHookName === 'admin-trigger');
          
          if (hookDeploy) {
            deploymentId = hookDeploy.uid;
            deploymentUrl = hookDeploy.url;
            
            if (hookDeploy.state === 'READY') {
              console.log('Deployment ready:', deploymentId, deploymentUrl);
              break;
            } else if (hookDeploy.state === 'ERROR' || hookDeploy.state === 'FAILED') {
              console.error('Deployment failed:', hookDeploy.state);
              // Still try to use it
              break;
            }
            console.log('Deployment state:', hookDeploy.state, 'waiting...');
          }
        }
      }
    }

    if (!deploymentId) {
      res.status(504).json({ error: 'Deployment timeout - no deployment found from hook' });
      return;
    }

    // Step 3: Assign the new deployment to the production domain
    console.log('Assigning deployment to domain:', deploymentId);
    
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

    if (!aliasRes.ok) {
      const errText = await aliasRes.text().catch(() => '');
      console.error('Alias assignment failed:', aliasRes.status, errText);
    }

    res.json({
      success: true,
      deploymentUrl: `https://${deploymentUrl}`,
      domain: `https://${DOMAIN}`,
      deploymentId,
    });
  } catch (error) {
    console.error('Trigger deploy error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
