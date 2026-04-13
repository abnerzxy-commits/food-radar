import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: '外送雷達 - 比較 UberEats / Foodpanda 附近外送餐廳',
  description: '用 Google 真實評價找附近可外送的餐廳，智慧排序，一鍵跳轉 UberEats、Foodpanda 點餐',
  keywords: ['外送', '外送比較', 'UberEats', 'Foodpanda', '外送餐廳', 'Google評價', '附近外送'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛵</text></svg>" />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
