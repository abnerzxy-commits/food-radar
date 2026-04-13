'use client'

import { useState, useEffect } from 'react'

interface Review {
  author: string
  rating: number
  text: string
  time: string
  avatar: string | null
}

interface RestaurantInfo {
  id: string
  name: string
  rating: number
  reviewCount: number
  address: string
  phone: string | null
  website: string | null
  googleMapsUrl: string | null
  priceLevel: number | null
  summary: string | null
  openingHours: {
    isOpen: boolean | null
    weekday: string[]
  } | null
  photos: string[]
  reviews: Review[]
  recommendedDishes: string[]
  reviewHighlights: string[]
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`text-sm ${i <= rating ? 'star-filled' : 'star-empty'}`}>★</span>
      ))}
    </div>
  )
}

export default function RestaurantDetail({
  placeId,
  restaurantName,
  onClose,
}: {
  placeId: string
  restaurantName: string
  onClose: () => void
}) {
  const [info, setInfo] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [showHours, setShowHours] = useState(false)
  const [fpToast, setFpToast] = useState('')

  useEffect(() => {
    fetch(`/api/restaurant?id=${placeId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setInfo(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [placeId])

  // UberEats / Foodpanda 搜尋連結
  const encodedName = encodeURIComponent(restaurantName)
  const uberEatsUrl = `https://www.ubereats.com/tw/search?q=${encodedName}`
  const foodpandaUrl = `https://www.foodpanda.com.tw/restaurants/new?q=${encodedName}`

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="modal-content bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="flex gap-2">
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
            </div>
            <p className="text-stone-500">載入中...</p>
          </div>
        ) : !info ? (
          <div className="p-8 text-center text-stone-500">載入失敗</div>
        ) : (
          <>
            {/* 圖片輪播 */}
            {info.photos.length > 0 && (
              <div className="relative h-56 sm:h-64 bg-stone-100">
                <img
                  src={`/api/photo?ref=${info.photos[activePhoto]}&maxwidth=800`}
                  alt={info.name}
                  className="w-full h-full object-cover"
                />
                {info.photos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {info.photos.map((_, i) => (
                      <button
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${i === activePhoto ? 'bg-white w-4' : 'bg-white/50'}`}
                        onClick={() => setActivePhoto(i)}
                      />
                    ))}
                  </div>
                )}
                <button
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
                  onClick={onClose}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="p-5">
              {/* 基本資訊 */}
              <div className="mb-4">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-xl font-bold text-stone-900">{info.name}</h2>
                  {info.openingHours && info.openingHours.isOpen !== null && (
                    <span className={`shrink-0 ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      info.openingHours.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {info.openingHours.isOpen ? '營業中' : '已打烊'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-500 font-bold text-lg">{info.rating.toFixed(1)}</span>
                  <StarRow rating={Math.round(info.rating)} />
                  <span className="text-sm text-stone-400">({info.reviewCount}則評價)</span>
                </div>

                {info.summary && (
                  <p className="text-sm text-stone-600 mb-2">{info.summary}</p>
                )}

                <p className="text-sm text-stone-500">📍 {info.address}</p>
                {info.phone && <p className="text-sm text-stone-500 mt-1">📞 {info.phone}</p>}
              </div>

              {/* 營業時間 */}
              {info.openingHours?.weekday && info.openingHours.weekday.length > 0 && (
                <div className="mb-4">
                  <button
                    className="text-sm text-orange-600 font-medium flex items-center gap-1"
                    onClick={() => setShowHours(!showHours)}
                  >
                    🕐 營業時間 {showHours ? '▲' : '▼'}
                  </button>
                  {showHours && (
                    <div className="mt-2 text-sm text-stone-600 space-y-0.5 bg-stone-50 rounded-lg p-3">
                      {info.openingHours.weekday.map((day, i) => (
                        <p key={i}>{day}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 推薦餐點 */}
              {info.recommendedDishes.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-stone-800 mb-2">🍳 網友推薦餐點</h3>
                  <div className="flex flex-wrap gap-2">
                    {info.recommendedDishes.map((dish, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-100"
                      >
                        {dish}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 評論重點 */}
              {info.reviewHighlights.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-stone-800 mb-2">📊 最常見的評論</h3>
                  <div className="flex flex-wrap gap-2">
                    {info.reviewHighlights.map((highlight, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-stone-50 text-stone-700 rounded-lg text-sm border border-stone-100"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 外送平台按鈕 */}
              <div className="mb-5">
                <h3 className="font-semibold text-stone-800 mb-2">🛵 外送訂餐</h3>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={uberEatsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-black text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition-colors"
                  >
                    <span className="text-lg">🟢</span>
                    UberEats
                  </a>
                  <a
                    href={foodpandaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      navigator.clipboard?.writeText(restaurantName).then(() => {
                        setFpToast('已複製餐廳名稱，開啟 App 後貼上搜尋')
                        setTimeout(() => setFpToast(''), 3000)
                      }).catch(() => {})
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-[#d70f64] text-white rounded-xl font-semibold text-sm hover:bg-[#b50d54] transition-colors"
                  >
                    <span className="text-lg">🐼</span>
                    Foodpanda
                  </a>
                </div>
                {fpToast ? (
                  <p className="text-xs text-emerald-600 mt-2 text-center font-medium">{fpToast}</p>
                ) : (
                  <p className="text-xs text-stone-400 mt-2 text-center">
                    長按複製店名（Foodpanda 不支援直接開啟）
                  </p>
                )}
              </div>

              {/* Google 評論 */}
              <div className="mb-4">
                <h3 className="font-semibold text-stone-800 mb-3">💬 Google 評論</h3>
                <div className="space-y-4">
                  {info.reviews.map((review, i) => (
                    <div key={i} className="bg-stone-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {review.avatar ? (
                          <img src={review.avatar} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">
                            👤
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-stone-800 truncate">{review.author}</p>
                          <div className="flex items-center gap-2">
                            <StarRow rating={review.rating} />
                            <span className="text-xs text-stone-400">{review.time}</span>
                          </div>
                        </div>
                      </div>
                      {review.text && (
                        <p className="text-sm text-stone-600 leading-relaxed">{review.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 底部連結 */}
              <div className="flex gap-3 pt-2 border-t border-stone-100">
                {info.googleMapsUrl && (
                  <a
                    href={info.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2.5 text-sm text-stone-600 hover:text-stone-900 bg-stone-50 rounded-lg transition-colors"
                  >
                    📍 Google Maps
                  </a>
                )}
                {info.website && (
                  <a
                    href={info.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2.5 text-sm text-stone-600 hover:text-stone-900 bg-stone-50 rounded-lg transition-colors"
                  >
                    🌐 官方網站
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
