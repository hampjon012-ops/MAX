import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, state: userId } = req.query

  if (!code || !userId) {
    return res.status(400).json({ error: 'Missing code or state' })
  }

  // Exchange auth code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code as string,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `https://admin.appbok.se/api/google-calendar-sync`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    return res.status(400).json({ error: 'Token exchange failed', detail: err })
  }

  const tokens = await tokenRes.json()
  const { refresh_token } = tokens

  // Save refresh_token in profiles.google_refresh_token
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ google_refresh_token: refresh_token })
    .eq('id', userId as string)

  if (updateError) {
    return res.status(500).json({ error: 'Failed to save token', detail: updateError.message })
  }

  return res.send(`<html><body>
    <h2>✅ Google Kalender länkad!</h2>
    <p>Du kan stänga detta fönster.</p>
    <script>
      if (window.opener) {
        window.opener.postMessage('google_calendar_linked', '*')
        window.close()
      }
    </script>
  </body></html>`)
}
