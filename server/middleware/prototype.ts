export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.replace(/\/+$/, '');
  if (path.startsWith('/api/') || path === '/contact.php') {
    throw createError({
      statusCode: 503,
      statusMessage: 'Prototype only. Orders and messages are disabled.'
    });
  }
});
