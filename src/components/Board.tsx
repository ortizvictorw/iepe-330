import React, { useEffect, useRef, useState } from 'react'
import './Board.css'
import peopleData from '../data/people'

type Person = {
  id: number
  name: string
  lastName: string
  cuotasPaid: number // number of payments paid (0..3)
}

const STORAGE_KEY = 'iepe-people-v1'

const SAMPLE: Person[] = (peopleData || []).slice(0, 300).map((p, i) => {
  const [first = '', ...rest] = p.name.split(' ')
  const last = rest.join(' ') || ''
  return {
    id: i + 1,
    name: first,
    lastName: last,
    cuotasPaid: Math.max(0, Math.min(3, Number(p.cuotasPaid) || 0)),
  }
})

export default function Board() {
  const [people, setPeople] = useState<Person[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as Person[]
    } catch (e) {}
    return SAMPLE
  })

  const [query, setQuery] = useState('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people))
  }, [people])

  // filtered list (full-width matching)
  const filtered = people.filter((p) => {
    const full = `${p.name} ${p.lastName}`.toLowerCase()
    return full.includes(query.toLowerCase()) || String(p.id) === query.trim()
  })

  // total collected (each cuota = 10000)
  const totalCollected = people.reduce((acc, p) => acc + p.cuotasPaid * 10000, 0)

  // Canvas animation: simple falling ice particles
  useEffect(() => {
    const canvas = canvasRef.current!
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let w = (canvas.width = canvas.clientWidth)
    let h = (canvas.height = canvas.clientHeight)

    type Ice = { x: number; y: number; r: number; speed: number; alpha: number }
    const ices: Ice[] = Array.from({ length: 60 }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 4,
      speed: 0.2 + Math.random() * 1.4,
      alpha: 0.4 + Math.random() * 0.7,
    }))

    let raf = 0
    const draw = () => {
      w = canvas.width = canvas.clientWidth
      h = canvas.height = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // frosty vignette
      const grd = ctx.createLinearGradient(0, 0, w, h)
      grd.addColorStop(0, 'rgba(255,255,255,0.02)')
      grd.addColorStop(1, 'rgba(0,0,0,0.15)')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      for (const ice of ices) {
        ice.y += ice.speed
        ice.x += Math.sin(ice.y * 0.01) * 0.6
        if (ice.y - ice.r > h) {
          ice.y = -10
          ice.x = Math.random() * w
          ice.alpha = 0.4 + Math.random() * 0.7
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,255,255,${ice.alpha})`
        ctx.arc(ice.x, ice.y, ice.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    const onResize = () => {
      w = canvas.width = canvas.clientWidth
      h = canvas.height = canvas.clientHeight
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Toggle a specific cuota for a person
  const toggleCuota = (personId: number, cuotaIndex: number) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p
        const paid = p.cuotasPaid
        let newPaid = paid
        // if cuotaIndex < paid -> unpay that cuota (decrement)
        if (cuotaIndex < paid) newPaid = cuotaIndex
        else newPaid = cuotaIndex + 1
        return { ...p, cuotasPaid: Math.max(0, Math.min(3, newPaid)) }
      })
    )
  }

  return (
    <div className="board-root fullwidth">
      <canvas ref={canvasRef} className="board-canvas" />

      <div className="board-container">
        <div className="board-topbar elegant">
          <div className="title">
            <div className="project">Proyecto 330</div>
            <div className="subtitle">Colecta 3 cuotas · $10.000 por cuota · 300 participantes</div>
          </div>

          <input
            className="board-search"
            placeholder="Buscar por nombre, apellido o ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="board-total floating">${totalCollected.toLocaleString()}</div>
        </div>

        <div className="board-list wide">
          {filtered.map((p) => (
            <div key={p.id} className="board-row card">
              <div className="board-left">
                <div className="board-number">{p.id}</div>
                <div className="board-name">{p.name} {p.lastName}</div>
              </div>
              <div className="board-right">
                <div className="ac-container">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <button
                      key={i}
                      className={`ac ${i < p.cuotasPaid ? 'paid' : ''}`}
                      onClick={() => toggleCuota(p.id, i)}
                      aria-label={`Cuota ${i + 1} - ${i < p.cuotasPaid ? 'pagada' : 'no pagada'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* footer removed per request */}
    </div>
  )
}
