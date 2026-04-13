import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface RestaurantEntry {
  name: string
  slug: string
  area: string
}

let nameCache: { name: string; area: string }[] | null = null

async function loadNames(): Promise<{ name: string; area: string }[]> {
  if (nameCache) return nameCache

  const dataDir = path.join(process.cwd(), 'data')
  const seen = new Set<string>()
  const names: { name: string; area: string }[] = []

  for (const fname of ['ubereats.json', 'foodpanda.json']) {
    try {
      const raw = await fs.readFile(path.join(dataDir, fname), 'utf-8')
      const data = JSON.parse(raw)
      for (const r of (data.restaurants || [])) {
        const key = r.name.trim()
        if (!seen.has(key)) {
          seen.add(key)
          names.push({ name: key, area: r.area || '' })
        }
      }
    } catch {}
  }

  nameCache = names
  return nameCache
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim().toLowerCase()
  if (!q || q.length < 1) {
    return NextResponse.json({ suggestions: [] })
  }

  const names = await loadNames()

  // Score each restaurant name by relevance
  const scored: { name: string; area: string; score: number }[] = []

  for (const entry of names) {
    const nameLower = entry.name.toLowerCase()
    let score = 0

    // Exact start match (highest priority)
    if (nameLower.startsWith(q)) {
      score = 100
    }
    // Contains the query
    else if (nameLower.includes(q)) {
      score = 50
    }
    // Character-by-character fuzzy: all query chars appear in order
    else {
      let qi = 0
      for (let ni = 0; ni < nameLower.length && qi < q.length; ni++) {
        if (nameLower[ni] === q[qi]) qi++
      }
      if (qi === q.length) score = 20
    }

    if (score > 0) {
      // Bonus: shorter names rank higher (more likely the intended match)
      score += Math.max(0, 20 - entry.name.length)
      scored.push({ ...entry, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return NextResponse.json({
    suggestions: scored.slice(0, 8).map(s => ({ name: s.name, area: s.area })),
  })
}
