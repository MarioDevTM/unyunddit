// Security-focused server hooks for .onion websites
// Implements strict CSP and privacy headers

/**
 * Get the real client IP address, handling various proxy configurations
 * @param {Request} request - The request object
 * @param {Function} getClientAddress - SvelteKit's getClientAddress function
 * @returns {string} The client IP address
 */
function getRealClientIP(request, getClientAddress) {
	// Check various proxy headers in order of preference
	const forwardedFor = request.headers.get('x-forwarded-for');
	const realIP = request.headers.get('x-real-ip');
	const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
	const trueClientIP = request.headers.get('true-client-ip'); // Some CDNs
	const xClientIP = request.headers.get('x-client-ip'); // Some proxies
	
	// x-forwarded-for can contain multiple IPs, take the first (original client)
	if (forwardedFor) {
		const firstIP = forwardedFor.split(',')[0]?.trim();
		if (firstIP && firstIP !== '127.0.0.1' && firstIP !== 'localhost') {
			return firstIP;
		}
	}
	
	// Check other headers
	if (realIP && realIP !== '127.0.0.1' && realIP !== 'localhost') return realIP;
	if (cfConnectingIP && cfConnectingIP !== '127.0.0.1') return cfConnectingIP;
	if (trueClientIP && trueClientIP !== '127.0.0.1') return trueClientIP;
	if (xClientIP && xClientIP !== '127.0.0.1') return xClientIP;
	
	// Fallback to SvelteKit's getClientAddress
	return getClientAddress();
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Log incoming requests for Tor debugging
	const startTime = Date.now();
	
	// Get real client IP using improved detection
	const clientIP = getRealClientIP(event.request, event.getClientAddress);
	
	const userAgent = event.request.headers.get('user-agent') || 'Unknown';
	const method = event.request.method;
	const url = event.url.pathname + event.url.search;
	
	// Log proxy headers for debugging in production
	const proxyHeaders = {
		'x-forwarded-for': event.request.headers.get('x-forwarded-for'),
		'x-real-ip': event.request.headers.get('x-real-ip'),
		'cf-connecting-ip': event.request.headers.get('cf-connecting-ip'),
		'true-client-ip': event.request.headers.get('true-client-ip'),
		'x-client-ip': event.request.headers.get('x-client-ip')
	};
	const activeHeaders = Object.fromEntries(Object.entries(proxyHeaders).filter(([k, v]) => v));
	
	console.log(`🌐 [HTTP-REQUEST] ${method} ${url} - IP: ${clientIP} - UA: ${userAgent.substring(0, 50)}`);
	if (Object.keys(activeHeaders).length > 0) {
		console.log(`📡 [PROXY-HEADERS]`, activeHeaders);
	}
	
	// Resolve the request
	const response = await resolve(event);
	
	// Log response
	const duration = Date.now() - startTime;
	const statusEmoji = response.status >= 400 ? '❌' : response.status >= 300 ? '⚠️' : '✅';
	console.log(`${statusEmoji} [HTTP-RESPONSE] ${method} ${url} - ${response.status} - ${duration}ms`);

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