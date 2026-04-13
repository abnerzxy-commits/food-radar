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
        if (reset) setRestaurants(data.restaurants)
        else setRestaurants(prev => [...prev, ...data.restaurants])
        setHasMore(data.hasMore || false)
        setTotal(data.total || 0)
        if (data.categories) setCategories(data.categories)
        offsetRef.current += data.restaurants.length
      }
    } catch { console.error('搜尋失敗') }
    finally { setLoading(false); setLoadingMore(false) }
  }, [coords, keyword, includeCats, excludeCats])

  useEffect(() => { if (coords) searchRestaurants(true) }, [coords, keyword, includeCats, excludeCats, searchRestaurants])

  useEffect(() => {
    if (!observerRef.current) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) searchRestaurants(false) },
      { threshold: 0.1 }
    )
    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, searchRestaurants])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setKeyword(searchInput) }

  // ===== Landing =====
  if (!located && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'linear-gradient(160deg, #efe9e1 0%, #e8e0d6 40%, #e2d8cd 100%)' }}>
        <div className="text-center max-w-sm">
          {/* Icon */}
          <div className="float-anim mb-10">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-white/60 backdrop-blur-sm shadow-lg shadow-[#c9956e]/10 flex items-center justify-center text-5xl border border-white/80">
              🛵
            </div>
          </div>

          <h1 className="text-[2.5rem] font-extrabold leading-tight mb-3 tracking-tight">
            <span className="gradient-text-warm">外送雷達</span>
          </h1>
          <p className="text-sm text-[#8a7e6e] mb-1 font-medium tracking-wide">
            UberEats / Foodpanda 外送餐廳比較
          </p>
          <p className="text-xs text-[#a89e90] mb-12 leading-relaxed">
            Google 真實評價 · 食安新聞提醒 · 一鍵跳轉點餐
          </p>

          <button
            onClick={getLocation}
            className="w-full py-4 rounded-2xl font-bold text-base text-white btn-warm-glow transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #b8734a 0%, #c9956e 100%)' }}
          >
            開啟定位，探索附近美食
          </button>

          {locationError && (
            <div className="mt-5 px-4 py-3 bg-[#c4928a]/10 border border-[#c4928a]/20 rounded-xl text-[#a06b63] text-sm">
              {locationError}
            </div>
          )}

          <div className="mt-16 flex justify-center gap-10">
            {[
              { icon: '🟢', label: 'UberEats' },
              { icon: '🐼', label: 'Foodpanda' },
              { icon: '⭐', label: '真實評價' },
              { icon: '🛡️', label: '食安提醒' },
            ].map(item => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="w-11 h-11 rounded-2xl bg-white/50 backdrop-blur-sm flex items-center justify-center text-lg border border-white/60 shadow-sm">
                  {item.icon}
                </div>
                <span className="text-[10px] text-[#a89e90] font-medium tracking-wide">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ===== Main =====
  return (
    <div className="min-h-screen pb-20" style={{ background: '#efe9e1' }}>
      <header className="sticky top-0 z-40 border-b" style={{ background: 'rgba(246, 243, 239, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderColor: '#ddd5ca' }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Title */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center text-base border border-white/80 shadow-sm">🛵</div>
            <h1 className="text-sm font-bold gradient-text-warm flex-1 tracking-wide">外送雷達</h1>
            <button
              onClick={getLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all active:scale-95"
              style={{ background: '#f3ebe3', color: '#b8734a', border: '1px solid #e8ddd0' }}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              重新定位
            </button>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0a494]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="搜尋餐廳名稱..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all placeholder:text-[#b8ad9e]"
                style={{ background: '#ede7df', border: '1px solid #ddd5ca', color: '#3d3529' }}
                onFocus={e => { e.target.style.background = '#f6f3ef'; e.target.style.borderColor = '#c9956e' }}
                onBlur={e => { e.target.style.background = '#ede7df'; e.target.style.borderColor = '#ddd5ca' }}
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-sm"
              style={{ background: 'linear-gradient(135deg, #b8734a, #c9956e)', boxShadow: '0 2px 8px rgba(184, 115, 74, 0.2)' }}
            >
              搜尋
            </button>
          </form>

          {/* Filters */}
          {categories.length > 0 && (
            <div className="space-y-2 pb-1">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-[10px] font-bold shrink-0 w-7 text-center py-0.5 rounded" style={{ color: '#6b8a5e', background: '#e8f0e4' }}>要</span>
                {categories.map(cat => {
                  const active = includeCats.includes(cat)
                  return (
                    <button key={cat} onClick={() => {
                      if (active) setIncludeCats(includeCats.filter(c => c !== cat))
                      else { setIncludeCats([...includeCats, cat]); setExcludeCats(excludeCats.filter(c => c !== cat)) }
                    }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                        active ? 'text-white chip-active-include' : 'hover:opacity-80'
                      }`}
                      style={active
                        ? { background: '#8fa885', boxShadow: '0 2px 6px rgba(143,168,133,0.25)' }
                        : { background: '#e8e2d9', color: '#8a7e6e' }
                      }
                    >
                      {active ? '✓ ' : ''}{cat}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-[10px] font-bold shrink-0 w-7 text-center py-0.5 rounded" style={{ color: '#a06b63', background: '#f3e6e3' }}>不要</span>
                {categories.map(cat => {
                  const active = excludeCats.includes(cat)
                  return (
                    <button key={cat} onClick={() => {
                      if (active) setExcludeCats(excludeCats.filter(c => c !== cat))
                      else { setExcludeCats([...excludeCats, cat]); setIncludeCats(includeCats.filter(c => c !== cat)) }
                    }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                        active ? 'text-white chip-active-exclude' : 'hover:opacity-80'
                      }`}
                      style={active
                        ? { background: '#c4928a', boxShadow: '0 2px 6px rgba(196,146,138,0.25)' }
                        : { background: '#e8e2d9', color: '#8a7e6e' }
                      }
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

      <main className="max-w-2xl mx-auto px-4 pt-5">
        {loading ? (
          <div className="py-28 flex flex-col items-center gap-5">
            <div className="flex gap-3">
              <div className="loading-dot w-3 h-3 rounded-full" style={{ background: '#c9956e' }} />
              <div className="loading-dot w-3 h-3 rounded-full" style={{ background: '#c4928a' }} />
              <div className="loading-dot w-3 h-3 rounded-full" style={{ background: '#8fa885' }} />
            </div>
            <p className="text-sm text-[#a89e90]">搜尋附近外送餐廳中...</p>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="py-28 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-white/50 flex items-center justify-center text-4xl border border-white/60">🍜</div>
            <p className="text-[#6b5f50] font-medium mb-2">附近沒有找到外送餐廳</p>
            <p className="text-sm text-[#a89e90]">試試換個關鍵字或調整分類篩選</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#8a7e6e]">
                找到 <span className="font-bold text-[#6b5f50]">{total}</span> 家外送餐廳
              </p>
              <span className="text-[11px] text-[#b0a494] px-2.5 py-1 rounded-full" style={{ background: '#e8e2d9' }}>依距離排序</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {restaurants.map((r, i) => (
                <div key={r.id} className="card-enter" style={{ animationDelay: `${Math.min(i * 0.06, 0.5)}s` }}>
                  <RestaurantCard
                    restaurant={r}
                    onClick={() => { setSelectedId(r.id); setSelectedName(r.name) }}
                  />
                </div>
              ))}
            </div>

            <div ref={observerRef} className="py-12 flex justify-center">
              {loadingMore && (
                <div className="flex gap-3">
                  <div className="loading-dot w-2.5 h-2.5 rounded-full" style={{ background: '#c9956e' }} />
                  <div className="loading-dot w-2.5 h-2.5 rounded-full" style={{ background: '#c4928a' }} />
                  <div className="loading-dot w-2.5 h-2.5 rounded-full" style={{ background: '#8fa885' }} />
                </div>
              )}
              {!hasMore && restaurants.length > 0 && (
                <span className="text-[11px] text-[#c4bdb2]">— 已顯示全部餐廳 —</span>
              )}
            </div>
          </>
        )}
      </main>

      {selectedId && (
        <RestaurantDetail placeId={selectedId} restaurantName={selectedName} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
