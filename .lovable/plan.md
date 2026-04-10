

## Fix Email Domain Setup

### Problem
The email domain `notify.smartincomeprogram.in` failed provisioning because it already exists in another provider account (Mailgun). Meanwhile, landing page confirmation emails work fine using `notify.smartincomeprogram.com`.

### Solution
Delete the failed `smartincomeprogram.in` domain and set up a new one using a different subdomain prefix (e.g., `mail.smartincomeprogram.in`) to avoid the conflict. Alternatively, we can set up `smartincomeprogram.com` since your landing page emails already use that domain.

### Steps

1. **Delete the failed domain** `smartincomeprogram.in` from Cloud → Emails → Manage Domains
2. **Re-add with a different subdomain prefix** — use `mail` instead of `notify` (so it becomes `mail.smartincomeprogram.in`), OR switch to `smartincomeprogram.com`
3. **Add required DNS records** at your domain registrar and wait for verification
4. **Update the auth-email-hook** Edge Function to use the new verified sender domain
5. **Update the landing page confirmation** Edge Function to use the same verified domain for consistency
6. **Re-deploy** both Edge Functions

### What you need to decide
- Which domain do you want to use: `smartincomeprogram.in` (with a different prefix like `mail`) or `smartincomeprogram.com`?
- Do you have access to DNS settings for whichever domain you choose?

