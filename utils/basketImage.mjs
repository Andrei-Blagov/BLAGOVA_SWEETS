export function allowedBasketImage(image, supabaseUrl) {
  if (typeof image !== 'string') return false;
  if (image.startsWith('/') && !image.startsWith('//')) return true;
  if (!supabaseUrl) return false;
  try {
    const publicUrl = new URL(image);
    const trustedUrl = new URL(supabaseUrl);
    return publicUrl.protocol === 'https:' && publicUrl.origin === trustedUrl.origin &&
      /^\/storage\/v1\/object\/public\/catalog-demo\/products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$/.test(publicUrl.pathname);
  } catch { return false; }
}
