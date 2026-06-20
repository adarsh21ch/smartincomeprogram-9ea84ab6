import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "https://esm.sh/@aws-sdk/client-s3@3.600.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.600.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const MIN_PART_SIZE = 16 * 1024 * 1024;
const MAX_SAFE_PARTS = 9000;
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

function normalizeR2Endpoint(endpoint: string, bucketName: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts[0] === bucketName) {
      url.pathname = "/";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

function sanitizeFilename(filename: string): string {
  const ext = filename.lastIndexOf(".") >= 0 ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  const name = filename.slice(0, filename.length - ext.length);
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (safe || "video") + ext;
}

function getPartSize(fileSizeBytes: number): number {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return MIN_PART_SIZE;
  const required = Math.ceil(fileSizeBytes / MAX_SAFE_PARTS);
  return Math.max(MIN_PART_SIZE, Math.ceil(required / (1024 * 1024)) * 1024 * 1024);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const normalizedR2Endpoint = normalizeR2Endpoint(R2_ENDPOINT, R2_BUCKET_NAME);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { filename, contentType, title, fileSizeBytes, multipart, action, videoId, r2Key, uploadId, partNumber, parts } = body;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const s3 = new S3Client({
      region: "auto",
      endpoint: normalizedR2Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    if (action) {
      if (!videoId || !r2Key) return json({ error: "Missing upload identifiers" }, 400);

      const { data: video } = await serviceClient.from("video_assets").select("owner_id,r2_key").eq("id", videoId).single();
      if (!video || video.owner_id !== user.id || video.r2_key !== r2Key) return json({ error: "Forbidden" }, 403);

      if (action === "sign-part") {
        if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1) return json({ error: "Missing part details" }, 400);
        const uploadUrl = await getSignedUrl(s3, new UploadPartCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: SIGNED_URL_TTL_SECONDS });
        return json({ uploadUrl });
      }

      if (action === "complete") {
        if (!uploadId || !Array.isArray(parts) || parts.length === 0) return json({ error: "Missing completed parts" }, 400);
        let listed = await s3.send(new ListPartsCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId }));
        for (let attempt = 1; (listed.Parts || []).length < parts.length && attempt <= 5; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
          listed = await s3.send(new ListPartsCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId }));
        }
        const etagsByPart = new Map((listed.Parts || []).map((part) => [part.PartNumber, part.ETag]));
        const completedParts = parts
          .map((part: { partNumber?: number; etag?: string }) => ({ PartNumber: part.partNumber, ETag: part.etag || etagsByPart.get(part.partNumber) }))
          .filter((part: { PartNumber?: number; ETag?: string }) => Number.isInteger(part.PartNumber) && typeof part.ETag === "string")
          .sort((a, b) => a.PartNumber! - b.PartNumber!);

        if (completedParts.length !== parts.length) return json({ error: "Some uploaded parts could not be verified" }, 400);

        await s3.send(new CompleteMultipartUploadCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId, MultipartUpload: { Parts: completedParts } }));
        return json({ success: true });
      }

      if (action === "abort") {
        if (uploadId) await s3.send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId })).catch(() => null);
        return json({ success: true });
      }

      if (action === "list-parts") {
        if (!uploadId) return json({ error: "Missing uploadId" }, 400);
        const listed = await s3.send(new ListPartsCommand({ Bucket: R2_BUCKET_NAME, Key: r2Key, UploadId: uploadId }));
        return json({ parts: (listed.Parts || []).map((part) => ({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size })) });
      }

      return json({ error: "Unknown upload action" }, 400);
    }

    if (!filename || !contentType) return json({ error: "Missing filename/contentType" }, 400);

    const safeFilename = sanitizeFilename(filename);

    const { data: video, error: dbErr } = await serviceClient.from("video_assets").insert({
      owner_id: user.id,
      title: title || filename,
      original_filename: filename,
      status: "uploading",
      upload_percent: 0,
      file_size_bytes: Number(fileSizeBytes) || null,
      is_shared: true,
    }).select("id").single();

    if (dbErr) throw dbErr;

    const newR2Key = `videos/${video.id}/${safeFilename}`;
    await serviceClient.from("video_assets").update({ r2_key: newR2Key }).eq("id", video.id);

    if (multipart || (Number(fileSizeBytes) || 0) >= 512 * 1024 * 1024) {
      const created = await s3.send(new CreateMultipartUploadCommand({ Bucket: R2_BUCKET_NAME, Key: newR2Key, ContentType: contentType }));
      const partSize = getPartSize(Number(fileSizeBytes));
      return json({ videoId: video.id, r2Key: newR2Key, uploadId: created.UploadId, partSize, multipart: true });
    }

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: newR2Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL_SECONDS });

    return json({
      uploadUrl,
      videoId: video.id,
      r2Key: newR2Key,
      multipart: false,
    });
  } catch (err: any) {
    console.error("get-r2-upload-url error:", err);
    return json({ error: err.message }, 500);
  }
});
