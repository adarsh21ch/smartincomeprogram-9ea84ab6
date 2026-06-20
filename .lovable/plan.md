## Root cause found

Your upload is not failing because of normal app page CORS. The edge functions already return CORS headers.

**Do I know what the issue is?** Yes: the current large-video upload path is fragile because it calls the backend edge function once per video chunk, then at the end asks the backend to rediscover uploaded chunks using `ListParts` before completing the upload. That makes uploads slow, causes stalls around mid-progress like 19%, and can fail with a generic edge-function error when any signing/listing/completion call times out or returns non-2xx.

The exact risky spots are:
- `src/lib/r2VideoUpload.ts`: uploads large files in many 16MB chunks and calls `get-r2-upload-url` separately for every part.
- `supabase/functions/get-r2-upload-url/index.ts`: `complete` action depends on `ListPartsCommand` and retry sleeps before completing, instead of using the exact part ETags from upload responses.
- `confirm-r2-upload` errors are still shown generically in some cases, so the real backend reason is hidden.

## Fix plan

1. **Make multipart completion deterministic**
   - Update browser upload code to capture each part’s `ETag` from the direct R2 upload response.
   - Send `{ partNumber, etag }` to the backend complete action.
   - Stop relying on `ListParts` as the normal completion path.

2. **Reduce edge-function pressure**
   - Increase part size from 16MB to 64MB for large videos.
   - Add a backend `sign-parts` batch action so the browser signs multiple chunks per function call instead of hitting the edge function for every single part.
   - Keep retries, but with cleaner backoff and clearer messages.

3. **Keep resume safe, but not blocking**
   - Use `list-parts` only when resuming a previously interrupted upload.
   - Add pagination for `list-parts` so resume works for very large files.
   - If resume state is stale, clear it and restart cleanly instead of hanging.

4. **Improve the final confirmation error**
   - Use the same response-body unwrapping for `confirm-r2-upload` that was added for `get-r2-upload-url`.
   - If the backend says a required setting or object is missing, show that exact reason instead of “Edge Function returned a non-2xx status code”.

5. **CORS check**
   - Edge-function CORS is already present.
   - For R2/direct upload CORS, the bucket must allow `PUT` and expose `ETag`. If code cannot read `ETag`, completion will fail. I’ll code the uploader to require and surface this clearly.

6. **Validate after implementation**
   - Test the deployed edge function preflight and protected POST path.
   - Confirm upload records no longer stay permanently in `uploading` after a failed attempt.
   - Check recent edge logs for actual errors after the new deployment.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>