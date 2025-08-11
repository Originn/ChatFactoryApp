import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  console.log('🚧 MIDDLEWARE IS RUNNING!', request.nextUrl.pathname)
  const { pathname } = request.nextUrl
  
  // Always allow access to API routes, static assets, and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.svg' ||
    pathname === '/logo.png' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.svg'
  ) {
    return NextResponse.next()
  }
  
  // Check if coming soon mode is enabled
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === 'true'
  
  console.log('🚧 Middleware executing:', {
    path: pathname,
    isComingSoon,
    envVar: process.env.NEXT_PUBLIC_COMING_SOON,
    url: request.url
  });
  
  if (!isComingSoon) {
    console.log('🚧 Coming soon mode disabled, allowing normal access');
    return NextResponse.next()
  }
  
  // Allow access to coming soon page itself
  if (pathname === '/coming-soon') {
    console.log('🚧 Allowing access to coming soon page');
    return NextResponse.next()
  }
  
  // Redirect all other routes to coming soon page
  console.log('🚧 Redirecting to coming soon page');
  return NextResponse.redirect(new URL('/coming-soon', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for API routes and static files
     * This will ensure middleware runs for all pages including root
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}