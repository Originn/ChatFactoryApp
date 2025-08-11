import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ThemeProvider } from '@/contexts/ThemeContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WizeChat - AI Documentation Assistant Coming Soon',
  description: 'Revolutionary AI-powered documentation assistant. Transform your static docs into intelligent, conversational experiences. Join our waitlist for early access.',
  keywords: 'AI documentation, chatbot, documentation assistant, artificial intelligence, coming soon',
  openGraph: {
    title: 'WizeChat - AI Documentation Assistant Coming Soon',
    description: 'Revolutionary AI-powered documentation assistant. Join our waitlist for early access.',
    url: 'https://wizechat.ai',
    siteName: 'WizeChat',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WizeChat - AI Documentation Assistant Coming Soon',
    description: 'Revolutionary AI-powered documentation assistant. Join our waitlist for early access.',
  },
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/logo.png', type: 'image/png', sizes: '32x32' }
    ],
    shortcut: '/favicon.svg',
    apple: '/logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00e0fc" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
