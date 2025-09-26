// Security-focused server hooks for .onion websites
// Implements strict CSP and privacy headers

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Resolve the request
	const response = await resolve(event);

	// Set strict security headers for .onion websites
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'none'",           // Block all by default
			"style-src 'self' 'unsafe-inline'", // Allow self-hosted styles and inline styles
			"img-src 'self' data:",         // Allow self-hosted images and data URIs
			"form-action 'self'",           // Only allow forms to submit to same origin
			"base-uri 'self'",              // Restrict base URI
			"frame-ancestors 'none'",       // Prevent embedding in frames
			"object-src 'none'",            // Block plugins
			"script-src 'none'"             // Block all JavaScript (SSR-only)
		].join('; ')
	);

	// Additional privacy and security headers
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-XSS-Protection', '1; mode=block');
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
	
	// Remove server identification headers
	response.headers.delete('Server');
	response.headers.delete('X-Powered-By');

	return response;
}