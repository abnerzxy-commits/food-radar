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
      stars.push(<span key={i} className="star-filled text-sm">★</span>)
    } else if (i - rating < 1 && i - rating > 0) {
      stars.push(
        <span key={i} className="relative text-sm">
          <span className="star-empty">★</span>
          <span className="star-filled absolute left-0 overflow-hidden" style={{ width: `${(rating % 1) * 100}%` }}>★</span>
        </span>
      )
    } else {
      stars.push(<span key={i} className="star-empty text-sm">★</span>)
    }
  }
  return <span className="inline-flex items-center gap-px">{stars}</span>
}

function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

export default function RestaurantCard({
  restaurant,
  onClick,
}: {
  restaurant: Restaurant
  onClick: () => void
}) {
  const { name, rating, reviewCount, distance, isOpen, photo, address, dishes, highlights, summary, platforms, ubereatsUrl, foodpandaUrl, warning } = restaurant
  const encodedName = encodeURIComponent(name)
  const ueUrl = ubereatsUrl || `https://www.ubereats.com/tw/search?q=${encodedName}`
  const fpUrl = foodpandaUrl || `https://www.foodpanda.com.tw/restaurants/new?q=${encodedName}`
  const hasUE = platforms?.includes('ubereats')
  const hasFP = platforms?.includes('foodpanda')

  return (
    <div className="restaurant-card bg-white rounded-2xl overflow-hidden border border-stone-200/60 shadow-sm">
      {/* Image */}
      <div className="relative h-44 bg-stone-100 cursor-pointer group" onClick={onClick}>
        {photo ? (
          <img
            src={`/api/photo?ref=${photo}&maxwidth=600`}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
            🍽️
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
          {isOpen !== null && (
            <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-md ${
              isOpen
                ? 'bg-emerald-500/90 text-white'
                : 'bg-stone-800/70 text-stone-300'
            }`}>
              {isOpen ? '營業中' : '已打烊'}
            </div>
          )}
        </div>

        {warning && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-red-500/90 text-white text-[11px] font-semibold backdrop-blur-md flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            {warning.tag}
          </div>
        )}

        {/* Distance badge */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/50 text-white text-xs font-semibold backdrop-blur-md flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {formatDistance(distance)}
        </div>

        {/* Platform indicators */}
        <div className="absolute bottom-3 right-3 flex gap-1">
          {hasUE && (
            <div className="w-6 h-6 rounded-md bg-[#06C167] flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-md shadow-sm">U</div>
          )}
          {hasFP && (
            <div className="w-6 h-6 rounded-md bg-[#d70f64] flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-md shadow-sm">F</div>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Warning detail */}
        {warning && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 leading-relaxed">
            {warning.reason}
          </div>
        )}

        {/* Name */}
        <h3 className="font-bold text-[15px] text-stone-900 mb-1.5 truncate cursor-pointer hover:text-orange-600 transition-colors" onClick={onClick}>
          {name}
        </h3>

        {/* Rating */}
        {rating > 0 && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <StarRating rating={rating} />
            <span className="font-bold text-amber-600 text-sm">{rating.toFixed(1)}</span>
            <span className="text-[11px] text-stone-400">({reviewCount.toLocaleString()}則)</span>
          </div>
        )}

        {/* Address */}
        <p className="text-[11px] text-stone-400 mb-2 truncate">{address}</p>

        {/* Google summary */}
        {summary && (
          <p className="text-[11px] text-stone-500 mb-2.5 line-clamp-2 leading-relaxed">{summary}</p>
        )}

        {/* Dishes */}
        {dishes && dishes.length > 0 && (
          <div className="mb-2.5">
            <div className="flex flex-wrap gap-1.5">
              {dishes.slice(0, 3).map((d, i) => (
                <span key={i} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-md text-[11px] font-medium border border-orange-100">
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {highlights.slice(0, 3).map((h, i) => (
                <span key={i} className="px-2 py-0.5 bg-stone-50 text-stone-500 rounded-md text-[11px] border border-stone-100">
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Order buttons */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <a
            href={ueUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              hasUE
                ? 'bg-[#06C167] text-white hover:bg-[#05a557] shadow-sm shadow-emerald-200'
                : 'bg-[#06C167]/10 text-[#06C167] hover:bg-[#06C167]/20 border border-[#06C167]/20'
            }`}
          >
            UberEats{hasUE ? '' : ' 搜尋'}
          </a>
          <a
            href={fpUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
              hasFP
                ? 'bg-[#d70f64] text-white hover:bg-[#b50d54] shadow-sm shadow-pink-200'
                : 'bg-[#d70f64]/10 text-[#d70f64] hover:bg-[#d70f64]/20 border border-[#d70f64]/20'
            }`}
          >
            Foodpanda{hasFP ? '' : ' 搜尋'}
          </a>
        </div>
      </div>
    </div>
  )
}
