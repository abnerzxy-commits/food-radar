import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: '外送雷達 - 比較 UberEats / Foodpanda 附近外送餐廳',
  description: '用 Google 真實評價找附近可外送的餐廳，智慧排序，一鍵跳轉 UberEats、Foodpanda 點餐。支援分類篩選、營業狀態、距離排序。',
  keywords: ['外送', '外送比較', 'UberEats', 'Foodpanda', '外送餐廳', 'Google評價', '附近外送', '外送推薦', '美食外送', '外送APP比較'],
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: '外送雷達 — 用 Google 評價比較附近外送餐廳',
    description: '一鍵比較 UberEats、Foodpanda 附近餐廳，用 Google 真實評價智慧排序，找到最好吃的外送選擇。',
    type: 'website',
    locale: 'zh_TW',
    siteName: '外送雷達',
  },
  twitter: {
    card: 'summary_large_image',
    title: '外送雷達 — 比較 UberEats / Foodpanda 附近外送餐廳',
    description: '用 Google 真實評價找附近可外送的餐廳，智慧排序，一鍵跳轉點餐。',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#b8734a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2179675937475901"
          crossOrigin="anonymous"
        />
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
