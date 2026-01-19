import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import peopleXlsxUrl from '../data/Proyecto 330.xlsx?url'
import './Board.css'
import jsPDF from 'jspdf'

type Person = {
  id: number
  name: string
  lastName: string
  paidAmount: number // total amount paid in currency (e.g., 10000 per cuota)
}

const SAMPLE: Person[] = []

export default function Board() {
  const [people, setPeople] = useState<Person[]>(SAMPLE)

  const [query, setQuery] = useState('')
  const [quotaFilter, setQuotaFilter] = useState<'all' | '>=1' | '>=2' | '3only'>('all')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)



  // filtered list (full-width matching + quota filter)
  const filtered = people.filter((p) => {
    const full = `${p.name} ${p.lastName}`.toLowerCase()
    const matchesQuery = full.includes(query.toLowerCase()) || String(p.id) === query.trim()
    if (!matchesQuery) return false
    // determine how many full cuotas the person paid
    const paid = Math.floor((p.paidAmount || 0) / 10000)
    if (quotaFilter === 'all') return true
    if (quotaFilter === '>=1') return paid >= 1
    if (quotaFilter === '>=2') return paid >= 2
    if (quotaFilter === '3only') return paid >= 3
    return true
  })

  // total collected (paidAmount is in currency units)
  const totalCollected = people.reduce((acc, p) => acc + (p.paidAmount || 0), 0)

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

  // Update paidAmount for a person (set to exact amount)
  const setPaidAmount = (personId: number, amount: number) => {
    setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, paidAmount: Math.max(0, amount) } : p)))
  }

  // helper: create per-quota progress [0..1] for each of the 3 cuotas
  const quotaProgress = (paidAmount: number) => {
    const cuota = 10000
    const progresses = [0, 0, 0]
    let remaining = paidAmount
    for (let i = 0; i < 3; i++) {
      const fill = Math.max(0, Math.min(1, remaining / cuota))
      progresses[i] = fill
      remaining = Math.max(0, remaining - cuota)
    }
    return progresses
  }

  // (file input removed) parsing is done on mount from Proyecto 330.xlsx

  // On mount, fetch the bundled people.xlsx and use it as single source of truth
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(peopleXlsxUrl)
        const ab = await res.arrayBuffer()
        const data = new Uint8Array(ab)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<any>(sheet)
        const updated = json.map((row: any, idx: number) => {
          // Columns expected (Spanish): Apellido, Nombre, Cuota Enero, Modo de pago, Cuota Febrero, Modo de pago, Cuota Marzo, Modo de pago, Total Individual, ...
          const apellido = String(row.Apellido || row.apellido || row.LastName || '')
          const nombre = String(row.Nombre || row.nombre || row.Name || '')
          // Prefer 'Total Individual' if present
          let totalRaw = row['Total Individual'] ?? row['Total individual'] ?? row['TOTAL INDIVIDUAL'] ?? row['Total'] ?? row.Total
          // If Total missing, sum the three cuota columns
          if (totalRaw == null) {
            const ce = Number(String(row['Cuota Enero'] || row['Cuota enero'] || row['Cuota1'] || 0).toString().replace(/[^0-9.-]/g, '')) || 0
            const cf = Number(String(row['Cuota Febrero'] || row['Cuota febrero'] || row['Cuota2'] || 0).toString().replace(/[^0-9.-]/g, '')) || 0
            const cm = Number(String(row['Cuota Marzo'] || row['Cuota marzo'] || row['Cuota3'] || 0).toString().replace(/[^0-9.-]/g, '')) || 0
            totalRaw = ce + cf + cm
          }
          // Normalize strings like '10M' => 10000; also handle thousands separators
          const totalStr = String(totalRaw)
          let amt = 0
          if (/\d+\s*M/i.test(totalStr)) {
            const num = Number(totalStr.replace(/[^0-9]/g, ''))
            amt = num * 1000
          } else {
            const n = Number(totalStr.toString().replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, ''))
            amt = isNaN(n) ? 0 : n
          }
          const fullname = `${nombre} ${apellido}`.trim()
          return {
            id: idx + 1,
            name: fullname,
            lastName: '',
            paidAmount: Math.max(0, amt),
          }
        })
        setPeople(updated)
      } catch (e) {
        console.error('Failed to load people.xlsx', e)
      }
    }
    load()
  }, [])

  return (
    <div className="board-root fullwidth">
      <canvas ref={canvasRef} className="board-canvas" />

      <div className="board-container">
        <div className="board-topbar elegant">
          <div className="title">
            <div className="project">Proyecto 330</div>
          </div>
          <input
            className="board-search"
            placeholder="Buscar por nombre o apellido"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            value={quotaFilter}
            onChange={(e) => setQuotaFilter(e.target.value as any)}
            style={{ marginLeft: 12, padding: '8px 10px', borderRadius: 8 }}
          >
            <option value="all">Todos</option>
            <option value=">=1">CUOTA 1</option>
            <option value=">=2">CUOTA 2</option>
            <option value="3only">CUOTA 3</option>
          </select>
          {quotaFilter !== 'all' && (
            <button
              onClick={() => {
                const doc = new jsPDF('p', 'mm', 'a4')
                const pageW = 210
                const pageH = 297
                const margin = 16
                const rowH = 14
                let y = 20
                // Header date and title
                const dateStr = new Date().toLocaleDateString('es-AR')
                doc.setFontSize(12)
                doc.setTextColor(20)
                doc.text(dateStr, pageW - margin, y, { align: 'right' })
                y += 8
                // Title: Hermanos que pagaron la cuota N°X
                const quotaNum = quotaFilter === '>=1' ? 1 : quotaFilter === '>=2' ? 2 : 3
                const headerText = `Hermanos que pagaron la cuota N°${quotaNum}`
                doc.setFontSize(16)
                doc.setFont('helvetica', 'bold')
                doc.text(headerText, pageW / 2, y, { align: 'center' })
                y += 12
                doc.setFont('helvetica', 'normal')
                // Table header spacing
                y += 4
                // For each person, render a row
                filtered.forEach((p) => {
                  if (y + rowH > pageH - margin) {
                    doc.addPage()
                    y = margin
                  }
                  // Name left
                  doc.setFontSize(12)
                  doc.setTextColor(10)
                  const nameX = margin
                  doc.text(String(p.name), nameX, y + 6)
                  // Quotas right
                  const cuotaBoxW = 10
                  const cuotaGap = 6
                  const totalBoxesW = 3 * cuotaBoxW + 2 * cuotaGap
                  const startX = pageW - margin - totalBoxesW
                  const fullQuotas = Math.floor((p.paidAmount || 0) / 10000)
                  for (let i = 1; i <= 3; i++) {
                    const cx = startX + (i - 1) * (cuotaBoxW + cuotaGap)
                    const cy = y - 2
                    if (i <= fullQuotas) {
                      doc.setFillColor(0, 150, 120)
                      doc.rect(cx, cy, cuotaBoxW, 10, 'F')
                    } else {
                      doc.setDrawColor(160)
                      doc.rect(cx, cy, cuotaBoxW, 10, 'S')
                    }
                  }
                  y += rowH
                })
                doc.save('lista-cuotas.pdf')
              }}
              style={{ marginLeft: 12, padding: '8px 12px', borderRadius: 8 }}
              >
              Exportar
            </button>
          )}
          <div className="board-total floating">Recaudado: ${totalCollected.toLocaleString()}</div>
        </div>

        <div className="board-list wide">
          {filtered.map((p) => {
            const progresses = quotaProgress(p.paidAmount || 0)
            return (
              <div key={p.id} className="board-row card">
                <div className="board-left">
                  <div className="board-number">{p.id}</div>
                  <div className="board-name">{p.name} {p.lastName}</div>
                </div>
                <div className="board-right">
                  <div className="ac-container">
                    {progresses.map((pr, i) => (
                      <button
                        key={i}
                        className={`ac ${pr >= 1 ? 'paid' : ''}`}
                        onClick={() => setPaidAmount(p.id, Math.min(30000, (i + 1) * 10000))}
                        aria-label={`Cuota ${i + 1} - ${pr >= 1 ? 'pagada' : 'no pagada'}`}
                      >
                        <div className="ac-fill" style={{ width: `${pr * 100}%` }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* footer removed per request */}
    </div>
  )
}
