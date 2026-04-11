import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    let userId = ''
    let returnTo = ''

    if (state) {
      try {
        const decoded = JSON.parse(atob(state))
        userId = decoded.userId || ''
        returnTo = decoded.returnTo || ''
      } catch {
        userId = ''
      }
    }

    if (error) {
      const friendlyMessage = error === 'access_denied'
        ? 'Google denied access. If your OAuth app is still in Testing mode, add this Gmail address as a Test User in Google Cloud and try again.'
        : `Error: ${error}`
      return new Response(renderHtml('Authorization denied', friendlyMessage, false, returnTo), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (!code || !userId) {
      return new Response(renderHtml('Missing parameters', 'Authorization code or state missing.', false, returnTo), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const redirectUri = `${SUPABASE_URL}/functions/v1/gmail-oauth-callback`

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errText = await tokenRes.text()
      console.error('Token exchange failed:', errText)
      return new Response(renderHtml('Token exchange failed', errText, false, returnTo), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!refresh_token) {
      return new Response(renderHtml('No refresh token', 'Please revoke access at myaccount.google.com/permissions and try again.', false, returnTo), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Get Gmail email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const userInfo = await userInfoRes.json()
    const gmailEmail = userInfo.email

    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete existing tokens for this user, then insert new
    await supabase.from('gmail_oauth_tokens').delete().eq('user_id', userId)
    const { error: insertErr } = await supabase.from('gmail_oauth_tokens').insert({
      user_id: userId,
      access_token,
      refresh_token,
      token_expiry: tokenExpiry,
      gmail_email: gmailEmail,
    })

    if (insertErr) {
      console.error('DB insert error:', insertErr)
      return new Response(renderHtml('Database error', insertErr.message, false, returnTo), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    return new Response(renderHtml('Gmail Connected!', `Successfully connected ${gmailEmail}. Redirecting back...`, true, returnTo), {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (err: any) {
    console.error('Callback error:', err)
    return new Response(renderHtml('Error', err.message, false, ''), {
      headers: { 'Content-Type': 'text/html' },
    })
  }
})

function renderHtml(title: string, message: string, success: boolean, returnTo: string): string {
  const color = success ? '#22c55e' : '#ef4444'
  const safeReturnTo = returnTo && /^https?:\/\//.test(returnTo) ? returnTo : ''
  const redirectScript = safeReturnTo
    ? `<script>setTimeout(()=>{ window.location.href = ${JSON.stringify(`${safeReturnTo}/admin/settings?gmail=${success ? 'connected' : 'error'}`)} }, 1800)</script>`
    : ''
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#0a0a0f;color:#fff;margin:0;">
<div style="text-align:center;max-width:520px;padding:40px;">
<div style="width:64px;height:64px;border-radius:50%;background:${color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
<span style="font-size:28px;">${success ? '✓' : '✗'}</span>
</div>
<h1 style="font-size:24px;margin:0 0 12px;color:${color};">${title}</h1>
<p style="font-size:14px;color:#94a3b8;line-height:1.6; white-space: pre-wrap;">${message}</p>
${safeReturnTo ? '<p style="font-size:12px;color:#64748b;">Redirecting back to settings…</p>' : ''}
${redirectScript}
</div></body></html>`
}
