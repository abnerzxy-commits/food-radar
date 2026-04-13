'use client'

import { useState } from 'react'

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
      stars.push(<span key={i} className="star-filled text-[13px]">★</span>)
    } else if (i - rating < 1 && i - rating > 0) {
      stars.push(
        <span key={i} className="relative text-[13px]">
          <span className="star-empty">★</span>
          <span className="star-filled absolute left-0 overflow-hidden" style={{ width: `${(rating % 1) * 100}%` }}>★</span>
        </span>
      )
    } else {
      stars.push(<span key={i} className="star-empty text-[13px]">★</span>)
    }
  }
  return <span className="inline-flex items-center">{stars}</span>
}

function formatDist(m: number) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

export default function RestaurantCard({ restaurant, onClick }: { restaurant: Restaurant; onClick: () => void }) {
  const { name, rating, reviewCount, distance, isOpen, photo, address, dishes, highlights, summary, platforms, ubereatsUrl, foodpandaUrl, warning } = restaurant
  const encodedName = encodeURIComponent(name)
  const ueUrl = ubereatsUrl || `https://www.ubereats.com/tw/search?q=${encodedName}`
  const fpUrl = foodpandaUrl || `https://www.foodpanda.com.tw/restaurants/new?q=${encodedName}`
  const hasUE = platforms?.includes('ubereats')
  const hasFP = platforms?.includes('foodpanda')
  const [toast, setToast] = useState('')

  const handleFpClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!hasFP) {
      navigator.clipboard?.writeText(name).then(() => {
        setToast('已複製餐廳名稱，貼上搜尋即可')
        setTimeout(() => setToast(''), 3000)
      }).catch(() => {})
    }
  }

  return (
    <div className="restaurant-card rounded-[20px] overflow-hidden" style={{ background: '#f6f3ef', border: '1px solid #e8e2d9' }}>
      {/* Image */}
      <div className="relative h-44 overflow-hidden cursor-pointer group" style={{ background: '#e8e2d9' }} onClick={onClick}>
        {photo ? (
          <img
            src={`/api/photo?ref=${photo}&maxwidth=600`}
            alt={name}
            className="w-full h-full object-cover img-zoom"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: 'linear-gradient(135deg, #f3ebe3, #ede7df, #e8e0d6)' }}>
            🍽️
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5 pointer-events-none" />

        {/* Status badge */}
        {isOpen !== null && (
          <div className="absolute top-3 right-3">
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide backdrop-blur-md ${
              isOpen
                ? 'text-white'
                : 'text-[#ddd5ca]'
            }`} style={{ background: isOpen ? 'rgba(143,168,133,0.85)' : 'rgba(61,53,41,0.6)' }}>
              {isOpen ? '營業中' : '已打烊'}
            </div>
          </div>
        )}

        {/* Warning */}
        {warning && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white backdrop-blur-md flex items-center gap-1" style={{ background: 'rgba(196,146,138,0.9)' }}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            {warning.tag}
          </div>
        )}

        {/* Distance */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white backdrop-blur-md flex items-center gap-1" style={{ background: 'rgba(61,53,41,0.5)' }}>
          <svg className="w-3 h-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {formatDist(distance)}
        </div>

        {/* Platform dots */}
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {hasUE && (
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shadow-sm backdrop-blur-md" style={{ background: 'rgba(108,163,120,0.85)' }}>U</div>
          )}
          {hasFP && (
            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shadow-sm backdrop-blur-md" style={{ background: 'rgba(196,146,138,0.85)' }}>F</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Warning detail */}
        {warning && (
          <div className="mb-3 px-3 py-2 rounded-xl text-[10px] leading-relaxed" style={{ background: '#f3e6e3', color: '#a06b63', border: '1px solid #e8d5d0' }}>
            {warning.reason}
          </div>
        )}

        {/* Name */}
        <h3 className="font-bold text-[15px] mb-1.5 truncate cursor-pointer transition-colors" style={{ color: '#3d3529' }}
          onClick={onClick}
          onMouseEnter={e => (e.currentTarget.style.color = '#b8734a')}
          onMouseLeave={e => (e.currentTarget.style.color = '#3d3529')}
        >
          {name}
        </h3>

        {/* Rating */}
        {rating > 0 && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <StarRating rating={rating} />
            <span className="font-bold text-sm" style={{ color: '#c9956e' }}>{rating.toFixed(1)}</span>
            <span className="text-[11px]" style={{ color: '#b0a494' }}>({reviewCount.toLocaleString()}則)</span>
          </div>
        )}

        {/* Address */}
        <p className="text-[11px] mb-2 truncate" style={{ color: '#b0a494' }}>{address}</p>

        {/* Summary */}
        {summary && (
          <p className="text-[11px] mb-2.5 line-clamp-2 leading-relaxed" style={{ color: '#8a7e6e' }}>{summary}</p>
        )}

        {/* Dishes */}
        {dishes && dishes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {dishes.slice(0, 3).map((d, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium" style={{ background: '#f3ebe3', color: '#b8734a', border: '1px solid #e8ddd0' }}>
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Highlights */}
        {highlights && highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {highlights.slice(0, 3).map((h, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md text-[10px]" style={{ background: '#ede7df', color: '#8a7e6e', border: '1px solid #e2dbd1' }}>
                {h}
              </span>
            ))}
          </div>
        )}

        {/* Order buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <a
            href={ueUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
            style={hasUE
              ? { background: '#6ca378', color: 'white', boxShadow: '0 2px 8px rgba(108,163,120,0.2)' }
              : { background: 'rgba(108,163,120,0.1)', color: '#6ca378', border: '1px solid rgba(108,163,120,0.2)' }
            }
          >
            UberEats{hasUE ? '' : ' 搜尋'}
          </a>
          <a
            href={fpUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleFpClick}
            className="flex items-center justify-center py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
            style={hasFP
              ? { background: '#c4928a', color: 'white', boxShadow: '0 2px 8px rgba(196,146,138,0.2)' }
              : { background: 'rgba(196,146,138,0.1)', color: '#c4928a', border: '1px solid rgba(196,146,138,0.2)' }
            }
          >
            Foodpanda{hasFP ? '' : ' 搜尋'}
          </a>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mt-2 px-3 py-1.5 rounded-lg text-[10px] font-medium text-center animate-fade-in"
            style={{ background: '#e8e2d9', color: '#6b5f50' }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
