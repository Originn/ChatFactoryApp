import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if coming soon mode is enabled
  const isComingSoon = process.env.NEXT_PUBLIC_COMING_SOON === 'true'
  
  if (!isComingSoon) {
    return NextResponse.next()
  }
  
  const { pathname } = request.nextUrl
  
  // Allow access to coming soon page and static assets
  if (
    pathname === '/coming-soon' ||
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
  
  // Redirect all other routes to coming soon page
  return NextResponse.redirect(new URL('/coming-soon', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}