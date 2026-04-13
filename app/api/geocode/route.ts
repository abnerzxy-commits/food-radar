import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ error: '需要提供地址' }, { status: 400 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=tw&language=zh-TW&key=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status === 'OK' && data.results?.length > 0) {
      const loc = data.results[0].geometry.location
      return NextResponse.json({
        lat: loc.lat,
        lng: loc.lng,
        formatted: data.results[0].formatted_address,
      })
    }

    return NextResponse.json({ error: '找不到該地址' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: '地址查詢失敗' }, { status: 500 })
  }
}
