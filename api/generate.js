// api/generate.js
// Vercel serverless function. When the site is deployed to Vercel, POST
// requests to /api/generate land here. It reuses the exact same generate()
// logic as the local dev server, so local behavior == deployed behavior.
//
// The Anthropic API key comes from the ANTHROPIC_API_KEY environment variable
// (set it in Vercel: Project Settings → Environment Variables).

import { generate } from '../lib/generate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { mode, transcript, episodeLink, guest } = req.body || {};
    const text = await generate({ mode, transcript, episodeLink, guest });
    res.status(200).json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.';
    // Bad input from the browser -> 400; missing key / upstream trouble -> 500/502
    let status = 502;
    if (/Unknown mode|No transcript/.test(message)) status = 400;
    else if (/ANTHROPIC_API_KEY/.test(message)) status = 500;
    res.status(status).json({ error: message });
  }
}
