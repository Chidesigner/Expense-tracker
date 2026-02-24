// api/claude.js
// Vercel Serverless Function — Groq API proxy
// Free tier: 14,400 requests/day, no region restrictions
// Get your key at: console.groq.com

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { messages, system, max_tokens } = req.body;

    // Build Groq messages array (OpenAI-compatible format)
    const groqMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      'llama-3.1-8b-instant',
        messages:   groqMessages,
        max_tokens: max_tokens || 1000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', data);
      return res.status(response.status).json({ error: data?.error?.message || 'Groq API error' });
    }

    // Convert to Anthropic-style format so ai.ts needs no changes
    const text = data?.choices?.[0]?.message?.content || '';
    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}