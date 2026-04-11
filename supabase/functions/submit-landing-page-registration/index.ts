const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      landing_page_id, name, phone, email, age, city, state,
      occupation, custom_1_value, custom_2_value, honeypot, user_agent,
    } = body

    // Honeypot check — fake success
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!landing_page_id) {
      return new Response(JSON.stringify({ error: 'landing_page_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch landing page
    const { data: page, error: pageErr } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landing_page_id)
      .eq('status', 'published')
      .single()

    if (pageErr || !page) {
      return new Response(JSON.stringify({ error: 'Landing page not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate required fields
    if (page.field_email_enabled && page.field_email_required && !email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (page.field_name_enabled && page.field_name_required && !name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (page.field_phone_enabled && page.field_phone_required && !phone) {
      return new Response(JSON.stringify({ error: 'Phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Email format validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Rate limit: check recent submissions from same IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('landing_page_registrations')
      .select('*', { count: 'exact', head: true })
      .eq('landing_page_id', landing_page_id)
      .eq('ip_address', ip)
      .gte('submitted_at', oneHourAgo)

    if ((count || 0) >= 5) {
      // Fake success to not reveal rate limiting
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const deviceType = user_agent && /Mobi/i.test(user_agent) ? 'mobile' : 'desktop'

    // Insert registration
    const { data: reg, error: insertErr } = await supabase
      .from('landing_page_registrations')
      .insert({
        landing_page_id,
        owner_id: page.owner_id,
        name: name || null,
        phone: phone || null,
        email: email || null,
        age: age || null,
        city: city || null,
        state: state || null,
        occupation: occupation || null,
        custom_1_value: custom_1_value || null,
        custom_2_value: custom_2_value || null,
        ip_address: ip,
        device_type: deviceType,
        user_agent: user_agent || null,
      })
      .select('id')
      .single()

    if (insertErr) throw insertErr

    // Update count
    await supabase.from('landing_pages').update({
      total_registrations: (page.total_registrations || 0) + 1,
    }).eq('id', landing_page_id)

    // Send confirmation email via Gmail API
    if (page.send_confirmation_email && email) {
      try {
        const senderDisplayName = (page as any).sender_display_name || 'Smart Income Program'
        const isPlatformSender = senderDisplayName === 'Smart Income Program'
        const trustBadgeText = isPlatformSender ? 'Verified by Smart Income Program' : 'Sent via Smart Income Program'
        const trustBadgeIcon = isPlatformSender ? '&#10003;' : '&#9656;'

        let emailBody = (page.email_body || '').replace(/\{\{name\}\}/g, name || 'there')
          .replace(/\{\{email\}\}/g, email || '')
          .replace(/\{\{phone\}\}/g, phone || '')
        let emailSubject = (page.email_subject || 'Registration Confirmed').replace(/\{\{name\}\}/g, name || 'there')

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#ffffff;color:#1a1a1a;padding:40px 20px;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e5e5;"><div style="text-align:center;margin-bottom:24px;"><h1 style="color:#22c55e;font-size:20px;margin:0;">Smart Income Program</h1></div><h2 style="font-size:22px;margin:0 0 16px;color:#1a1a1a;">${page.email_heading || 'You are registered!'}</h2><div style="font-size:15px;line-height:1.7;color:#555555;white-space:pre-line;">${emailBody}</div>${page.email_footer_text ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:13px;color:#999999;">${page.email_footer_text}</div>` : ''}<div style="margin-top:28px;padding-top:20px;border-top:1px solid #f0f0f0;text-align:center;"><span style="display:inline-block;font-size:11px;color:#b0b0b0;letter-spacing:0.5px;font-weight:500;"><span style="display:inline-block;width:16px;height:16px;line-height:16px;text-align:center;background:#f5f5f5;border-radius:50%;font-size:9px;color:#22c55e;margin-right:5px;vertical-align:middle;">${trustBadgeIcon}</span>${trustBadgeText}</span></div></div></body></html>`

        // Call send-gmail-email edge function internally
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
        const gmailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-gmail-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            to: email,
            subject: emailSubject,
            html,
            sender_name: senderDisplayName,
          }),
        })

        if (gmailRes.ok) {
          await supabase.from('landing_page_registrations').update({
            confirmation_email_sent: true,
            confirmation_email_sent_at: new Date().toISOString(),
          }).eq('id', reg.id)
          console.log('Confirmation email sent via Gmail')
        } else {
          const errText = await gmailRes.text()
          console.error('Gmail email failed:', errText)
        }
      } catch (emailErr) {
        console.error('Email send failed (non-blocking):', emailErr)
        // Don't break the funnel
      }
    }

    return new Response(JSON.stringify({ success: true, registration_id: reg.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
