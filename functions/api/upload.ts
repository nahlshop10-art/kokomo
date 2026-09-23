import { getCustomDomain } from './_domain';
export async function onRequestPost({ request, env }: any) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response('Missing or invalid file', { status: 400 });
    }

    // Limit maximum file size to 10MB to protect R2 storage
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return new Response('File size exceeds 10MB limit', { status: 400 });
    }

    // Strict image extension allowlist
    const rawExt = (file.name.split('.').pop() || 'webp').toLowerCase();
    const allowedExtensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
    if (!allowedExtensions.includes(rawExt)) {
      return new Response('Unsupported file format. Only webp, png, jpg, and gif are permitted.', { status: 400 });
    }

    // Strict MIME type mapping
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif'
    };
    const contentType = mimeMap[rawExt] || 'image/webp';

    // Generate unique key using timestamp and uuid
    const key = `uploads/img_${Date.now()}_${crypto.randomUUID()}.${rawExt}`;

    const buffer = await file.arrayBuffer();
    
    // Upload to R2 Bucket
    if (!env.BUCKET) {
      throw new Error('R2 BUCKET binding is not configured. Please bind your R2 bucket to the BUCKET variable in Cloudflare Pages settings.');
    }
    
    await env.BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    // Determine the public URL path. 
    // Usually R2 is exposed via a custom domain. For this setup, we'll return the key.
    // In frontend, you'll prepend your R2 custom domain. Let's return a relative path or full domain if defined.
    const customDomain = getCustomDomain(env);
    const url = `https://${customDomain}/${key}`;

    return Response.json({ success: true, url, key });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
