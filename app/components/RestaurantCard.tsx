'use client'

interface Restaurant {
  id: string
  name: string
  rating: number
  reviewCount: number
  distance: number
  distanceKm: number
  isOpen: boolean | null
  priceLevel: number | null
  address: string
  photo: string | null
  score: number
  categories?: string[]
  dishes?: string[]
  highlights?: string[]
  summary?: string
  platforms?: string[]
  ubereatsUrl?: string
  foodpandaUrl?: string
  warning?: { tag: string; reason: string } | null
}

function StarRating({ rating }: { rating: number }) {
  if (!rating) return null
  const stars = []
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push(<span key={i} className="star-filled text-base">★</span>)
    } else if (i - rating < 1 && i - rating > 0) {
      stars.push(
        <span key={i} className="relative text-base">
          <span className="star-empty">★</span>
          <span className="star-filled absolute left-0 overflow-hidden" style={{ width: `${(rating % 1) * 100}%` }}>★</span>
        </span>
      )
    } else {
      stars.push(<span key={i} className="star-empty text-base">★</span>)
    }
  }
  return <span className="inline-flex items-center">{stars}</span>
}

export default function RestaurantCard({
  restaurant,
  onClick,
}: {
  restaurant: Restaurant
  onClick: () => void
}) {
  const { name, rating, reviewCount, distance, isOpen, photo, address, dishes, highlights, platforms, ubereatsUrl, foodpandaUrl, warning } = restaurant
  const encodedName = encodeURIComponent(name)
  const ueUrl = ubereatsUrl || `https://www.ubereats.com/tw/search?q=${encodedName}`
  const fpUrl = foodpandaUrl || `https://www.foodpanda.com.tw/restaurants/new?q=${encodedName}`
  const hasUE = platforms?.includes('ubereats')
  const hasFP = platforms?.includes('foodpanda')

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100">
      {/* 圖片 */}
      <div className="relative h-40 bg-stone-100 cursor-pointer" onClick={onClick}>
        {photo ? (
          <img
            src={`/api/photo?ref=${photo}&maxwidth=600`}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-orange-50 to-amber-50">
            🍽️
          </div>
        )}
        {isOpen !== null && (
          <div className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isOpen ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {isOpen ? '營業中' : '已打烊'}
          </div>
        )}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
          📍 {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`}
        </div>
        {warning && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-semibold backdrop-blur-sm">
            ⚠️ {warning.tag}
          </div>
        )}
      </div>

      <div className="p-4">
        {/* 負面新聞警告 */}
        {warning && (
          <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ⚠️ {warning.reason}
          </div>
        )}

        {/* 店名 */}
        <h3 className="font-bold text-lg text-stone-900 mb-1 truncate cursor-pointer hover:text-orange-600 transition-colors" onClick={onClick}>
          {name}
        </h3>

        {/* 評分 */}
        {rating > 0 && (
          <div className="flex items-center gap-1.5 mb-1">
            <StarRating rating={rating} />
            <span className="font-semibold text-amber-600 text-sm">{rating.toFixed(1)}</span>
            <span className="text-xs text-stone-400">({reviewCount}則)</span>
          </div>
        )}

        <p className="text-xs text-stone-400 mb-2 truncate">{address}</p>

        {/* 推薦餐點 */}
        {dishes && dishes.length > 0 && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-1">
              {dishes.slice(0, 3).map((d, i) => (
                <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md text-xs border border-orange-100">
                  🍳 {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 常見評價 */}
        {highlights && highlights.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {highlights.slice(0, 3).map((h, i) => (
                <span key={i} className="px-2 py-0.5 bg-stone-50 text-stone-600 rounded-md text-xs">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 外送按鈕 */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={ueUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              hasUE
                ? 'bg-[#06C167] text-white hover:bg-[#05a557]'
                : 'bg-[#06C167]/20 text-[#06C167] hover:bg-[#06C167]/30'
            }`}
          >
            UberEats{hasUE ? '' : ' 搜尋'}
          </a>
          <a
            href={fpUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              hasFP
                ? 'bg-[#d70f64] text-white hover:bg-[#b50d54]'
                : 'bg-[#d70f64]/20 text-[#d70f64] hover:bg-[#d70f64]/30'
            }`}
          >
            Foodpanda{hasFP ? '' : ' 搜尋'}
          </a>
        </div>
      </div>
    </div>
  )
}
