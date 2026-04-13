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
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <head />
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
