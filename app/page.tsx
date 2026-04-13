'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import RestaurantCard from './components/RestaurantCard'
import RestaurantDetail from './components/RestaurantDetail'

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

export default function Home() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [located, setLocated] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [includeCats, setIncludeCats] = useState<string[]>([])
  const [excludeCats, setExcludeCats] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState('')
  const offsetRef = useRef(0)
  const observerRef = useRef<HTMLDivElement>(null)

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('你的瀏覽器不支援定位功能')
      return
    }
    setLoading(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocated(true)
      },
      (err) => {
        setLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError('請允許定位權限以搜尋附近餐廳')
            break
          case err.POSITION_UNAVAILABLE:
            setLocationError('無法取得定位資訊')
            break
          default:
            setLocationError('定位逾時，請重試')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  const searchRestaurants = useCallback(async (reset = true) => {
    if (!coords) return
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lng: coords.lng.toString(),
        offset: offsetRef.current.toString(),
        limit: '30',
      })
      if (keyword) params.set('keyword', keyword)
      if (includeCats.length > 0) params.set('include', includeCats.join(','))
      if (excludeCats.length > 0) params.set('exclude', excludeCats.join(','))

      const res = await fetch(`/api/restaurants?${params}`)
      const data = await res.json()

      if (data.restaurants) {
        if (reset) {
          setRestaurants(data.restaurants)
        } else {
          setRestaurants(prev => [...prev, ...data.restaurants])
        }
        setHasMore(data.hasMore || false)
        setTotal(data.total || 0)
        if (data.categories) setCategories(data.categories)
        offsetRef.current += data.restaurants.length
      }
    } catch {
      console.error('搜尋失敗')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [coords, keyword, includeCats, excludeCats])

  useEffect(() => {
    if (coords) searchRestaurants(true)
  }, [coords, keyword, includeCats, excludeCats, searchRestaurants])

  useEffect(() => {
    if (!observerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          searchRestaurants(false)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, searchRestaurants])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setKeyword(searchInput)
  }

  // ===== Landing Page =====
  if (!located && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-orange-50 via-white to-amber-50">
        <div className="text-center max-w-sm">
          <div className="text-8xl mb-8 float-anim">🛵</div>
          <h1 className="text-4xl font-extrabold mb-3">
            <span className="gradient-text">外送雷達</span>
          </h1>
          <p className="text-base text-stone-500 mb-1 font-medium">UberEats / Foodpanda 附近外送餐廳比較</p>
          <p className="text-sm text-stone-400 mb-10 leading-relaxed">
            Google 真實評價 · 食安新聞提醒 · 一鍵跳轉點餐
          </p>

          <button
            onClick={getLocation}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg btn-glow hover:from-orange-600 hover:to-amber-600 transition-all active:scale-[0.97] active:shadow-none"
          >
            開啟定位，探索附近美食
          </button>

          {locationError && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {locationError}
            </div>
          )}

          <div className="mt-14 flex justify-center gap-8">
            {[
              { icon: '🟢', label: 'UberEats' },
              { icon: '🐼', label: 'Foodpanda' },
              { icon: '⭐', label: '真實評價' },
              { icon: '⚠️', label: '食安提醒' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1.5">
                <div className="text-2xl">{item.icon}</div>
                <span className="text-[11px] text-stone-400 font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ===== Main App =====
  return (
    <div className="min-h-screen pb-20 bg-[#faf9f7]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-stone-200/60 shadow-sm shadow-stone-100/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Title row */}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-xl">🛵</span>
            <h1 className="text-base font-bold gradient-text flex-1">外送雷達</h1>
            <button
              onClick={getLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 rounded-full text-xs text-orange-600 font-semibold transition-all active:scale-95"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              重新定位
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex gap-2 mb-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="搜尋餐廳名稱..."
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200/80 rounded-xl text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 focus:bg-white transition-all placeholder:text-stone-400"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors active:scale-95 shadow-sm shadow-orange-200"
            >
              搜尋
            </button>
          </form>

          {/* Category filters */}
          {categories.length > 0 && (
            <div className="space-y-2 pb-1">
              {/* Include */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-[11px] text-emerald-600 font-bold shrink-0 w-7 text-center bg-emerald-50 rounded py-0.5">要</span>
                {categories.map(cat => {
                  const active = includeCats.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        if (active) {
                          setIncludeCats(includeCats.filter(c => c !== cat))
                        } else {
                          setIncludeCats([...includeCats, cat])
                          setExcludeCats(excludeCats.filter(c => c !== cat))
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all ${
                        active
                          ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 chip-include-active'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {active ? '✓ ' : ''}{cat}
                    </button>
                  )
                })}
              </div>
              {/* Exclude */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-[11px] text-red-500 font-bold shrink-0 w-7 text-center bg-red-50 rounded py-0.5">不要</span>
                {categories.map(cat => {
                  const active = excludeCats.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => {
                        if (active) {
                          setExcludeCats(excludeCats.filter(c => c !== cat))
                        } else {
                          setExcludeCats([...excludeCats, cat])
                          setIncludeCats(includeCats.filter(c => c !== cat))
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all ${
                        active
                          ? 'bg-red-500 text-white shadow-sm shadow-red-200 chip-exclude-active'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {active ? '✕ ' : ''}{cat}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="py-24 flex flex-col items-center gap-4">
            <div className="flex gap-2.5">
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
            </div>
            <p className="text-stone-400 text-sm">搜尋附近外送餐廳中...</p>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-6xl mb-5">🍜</div>
            <p className="text-stone-600 font-medium mb-2">附近沒有找到外送餐廳</p>
            <p className="text-sm text-stone-400">試試換個關鍵字或調整分類篩選</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-500">
                找到 <span className="font-semibold text-stone-700">{total}</span> 家外送餐廳
              </p>
              <p className="text-xs text-stone-400">依距離排序</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurants.map((r, i) => (
                <div key={r.id} className="card-enter" style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s` }}>
                  <RestaurantCard
                    restaurant={r}
                    onClick={() => {
                      setSelectedId(r.id)
                      setSelectedName(r.name)
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerRef} className="py-10 flex justify-center">
              {loadingMore && (
                <div className="flex gap-2">
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                </div>
              )}
              {!hasMore && restaurants.length > 0 && (
                <p className="text-xs text-stone-300">- 已顯示全部餐廳 -</p>
              )}
            </div>
          </>
        )}
      </main>

      {selectedId && (
        <RestaurantDetail
          placeId={selectedId}
          restaurantName={selectedName}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
