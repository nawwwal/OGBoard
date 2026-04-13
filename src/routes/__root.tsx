import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import appCss from '../styles.css?url'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'OGBoard' },
      { name: 'description', content: 'Inspect, collect, and compare OG images from any URL.' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        className="min-h-screen"
        style={{ backgroundColor: 'oklch(95% 0.012 75)', color: 'oklch(18% 0.020 55)', fontFamily: 'var(--font-sans)' }}
      >
        {/* Masthead */}
        <header
          className="sticky top-0 z-50 flex h-12 items-center px-5"
          style={{
            backgroundColor: 'oklch(95% 0.012 75)',
            borderBottom: '1px solid oklch(86% 0.012 70)',
          }}
        >
          <Link
            to="/"
            className="flex items-baseline gap-2 no-underline"
            style={{ color: 'oklch(18% 0.020 55)' }}
          >
            <span
              className="text-[22px] leading-none tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              OGBoard
            </span>
            <span
              className="text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: 'oklch(50% 0.19 55)' }}
            >
              Beta
            </span>
          </Link>
        </header>

        {children}
        <Scripts />
      </body>
    </html>
  )
}
