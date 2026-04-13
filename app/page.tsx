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
  platforms?: string[]
  ubereatsUrl?: string
  foodpandaUrl?: string
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

  // 搜尋餐廳（重新搜尋）
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
        if (data.categories) {
          setCategories(data.categories)
        }
        offsetRef.current += data.restaurants.length
      }
    } catch {
      console.error('搜尋失敗')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [coords, keyword, includeCats, excludeCats])

  // 座標 or 篩選變動 → 重新搜尋
  useEffect(() => {
    if (coords) {
      searchRestaurants(true)
    }
  }, [coords, keyword, includeCats, excludeCats, searchRestaurants])

  // 無限滾動
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

  // 首頁
  if (!located && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-7xl mb-6">🛵</div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">外送雷達</h1>
          <p className="text-lg text-stone-500 mb-2">比較 UberEats / Foodpanda 附近外送餐廳</p>
          <p className="text-sm text-stone-400 mb-8">
            Google 真實評價 + 網友推薦餐點<br />
            一鍵跳轉外送平台，馬上點餐
          </p>

          <button
            onClick={getLocation}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-200 hover:shadow-xl hover:shadow-orange-300 transition-all active:scale-[0.98]"
          >
            📍 開啟定位，搜尋附近外送餐廳
          </button>

          {locationError && (
            <p className="mt-4 text-red-500 text-sm">{locationError}</p>
          )}

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl mb-1">🟢</div>
              <p className="text-xs text-stone-500">UberEats</p>
            </div>
            <div>
              <div className="text-2xl mb-1">🐼</div>
              <p className="text-xs text-stone-500">Foodpanda</p>
            </div>
            <div>
              <div className="text-2xl mb-1">⭐</div>
              <p className="text-xs text-stone-500">真實評價篩選</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-stone-100">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🛵</span>
            <h1 className="text-lg font-bold text-stone-900">外送雷達</h1>
          </div>

          {/* 搜尋框 */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="搜尋外送餐廳或料理類型..."
              className="flex-1 px-4 py-2.5 bg-stone-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-300 transition-all"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              搜尋
            </button>
          </form>

          {/* 分類篩選：要 / 不要 */}
          {categories.length > 0 && (
            <div className="space-y-2 pb-1">
              {/* 要 */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-xs text-emerald-600 font-bold shrink-0 w-6">要</span>
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                        active
                          ? 'bg-emerald-500 text-white'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {active ? '✓ ' : ''}{cat}
                    </button>
                  )
                })}
              </div>
              {/* 不要 */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <span className="text-xs text-red-500 font-bold shrink-0 w-6">不要</span>
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium shrink-0 transition-colors ${
                        active
                          ? 'bg-red-500 text-white'
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

      <main className="max-w-2xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="flex gap-2">
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
              <div className="loading-dot w-3 h-3 bg-orange-400 rounded-full" />
            </div>
            <p className="text-stone-500">搜尋附近外送餐廳中...</p>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-5xl mb-4">😢</div>
            <p className="text-stone-500 mb-2">附近沒有找到外送餐廳</p>
            <p className="text-sm text-stone-400">試試換個關鍵字或分類</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-stone-400 mb-3">
              找到 {total} 家外送餐廳 · 依距離排序
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  onClick={() => {
                    setSelectedId(r.id)
                    setSelectedName(r.name)
                  }}
                />
              ))}
            </div>

            {/* 無限滾動觸發點 */}
            <div ref={observerRef} className="py-8 flex justify-center">
              {loadingMore && (
                <div className="flex gap-2">
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                  <div className="loading-dot w-2.5 h-2.5 bg-orange-400 rounded-full" />
                </div>
              )}
              {!hasMore && restaurants.length > 0 && (
                <p className="text-sm text-stone-300">已顯示全部餐廳</p>
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
