'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore'

// ─── Helpers ──────────────────────────────────────────────────────
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const gc = (n = 6) => Array.from({ length: n }, () => CHARS[Math.random() * CHARS.length | 0]).join('')
const isUrl   = u => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' } catch { return false } }
const isAlias = a => /^[a-zA-Z0-9\-]{3,30}$/.test(a)
const surl    = c => `${window.location.origin}/go/${c}`

const getDevId = () => {
  let id = localStorage.getItem('ciweb_did')
  if (!id) { id = 'd_' + gc(16); localStorage.setItem('ciweb_did', id) }
  return id
}
const Cache = {
  get()  { try { return JSON.parse(localStorage.getItem('ciweb_links') || '[]') } catch { return [] } },
  add(l) { try { const a = this.get().filter(x => x.code !== l.code); localStorage.setItem('ciweb_links', JSON.stringify([l, ...a].slice(0, 20))) } catch {} },
}
const RL = {
  ok() {
    const d = JSON.parse(localStorage.getItem('ciweb_rl') || '{"n":0,"r":0}')
    if (Date.now() > d.r) { localStorage.setItem('ciweb_rl', JSON.stringify({ n: 1, r: Date.now() + 3600000 })); return true }
    if (d.n >= 20) return false
    d.n++; localStorage.setItem('ciweb_rl', JSON.stringify(d)); return true
  }
}
const clip = async t => { try { await navigator.clipboard.writeText(t); return true } catch { return false } }

// ─── Component ────────────────────────────────────────────────────
export default function HomePage() {
  const [url,      setUrl]      = useState('')
  const [alias,    setAlias]    = useState('')
  const [useAlias, setUseAlias] = useState(false)
  const [expiry,   setExpiry]   = useState('never')
  const [expDate,  setExpDate]  = useState('')
  const [expClks,  setExpClks]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState(null)
  const [copied,   setCopied]   = useState(false)
  const [recent,   setRecent]   = useState([])
  const [qrCode,   setQrCode]   = useState(null)   // shortCode for QR preview

  useEffect(() => { setRecent(Cache.get()) }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (!url.trim()) return setError('Please enter a URL.')
    if (!isUrl(url.trim())) return setError('Enter a valid URL starting with http:// or https://')
    if (!RL.ok()) return setError('Rate limit reached (20/hour). Please wait.')

    setLoading(true)
    try {
      let code = useAlias ? alias.trim().toLowerCase() : ''

      if (code) {
        if (!isAlias(code)) throw new Error('Alias must be 3–30 chars: letters, numbers, hyphens only.')
        const snap = await getDoc(doc(db, 'urls', code))
        if (snap.exists()) throw new Error('This alias is already taken. Try another.')
      } else {
        for (let i = 0; i < 5; i++) {
          code = gc(i < 4 ? 6 : 8)
          const snap = await getDoc(doc(db, 'urls', code))
          if (!snap.exists()) break
        }
      }

      let expiresAt   = null
      let expiryClicks = null
      if (expiry === 'date'   && expDate) expiresAt    = new Date(expDate)
      if (expiry === 'clicks' && expClks) expiryClicks = parseInt(expClks)

      await setDoc(doc(db, 'urls', code), {
        shortCode:    code,
        originalUrl:  url.trim(),
        clicks:       0,
        createdAt:    serverTimestamp(),
        expiresAt:    expiresAt || null,
        expiryClicks: expiryClicks || null,
        deviceId:     getDevId(),
        active:       true,
      })

      const short = surl(code)
      setResult({ code, short, originalUrl: url.trim() })
      Cache.add({ code, short, originalUrl: url.trim() })
      setRecent(Cache.get())
      setUrl(''); setAlias(''); setExpiry('never'); setExpDate(''); setExpClks('')
      setUseAlias(false)
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    await clip(result.short)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ── Navbar ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, padding:'12px 16px' }}>
        <div className="card" style={{ maxWidth:900, margin:'0 auto', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#06b6d4,#3b82f6)', display:'grid', placeItems:'center', fontWeight:900, fontSize:12, color:'#fff', flexShrink:0 }}>CI</div>
            <span style={{ fontWeight:800, fontSize:15 }}><span className="glow">CIWEB</span><span style={{ color:'rgba(255,255,255,.55)' }}> Links</span></span>
          </Link>
          <div style={{ display:'flex', gap:4 }}>
            <Link href="/"          style={{ padding:'7px 14px', borderRadius:10, background:'rgba(6,182,212,.12)', color:'#22d3ee', fontSize:13, fontWeight:500, textDecoration:'none' }}>🔗 Shorten</Link>
            <Link href="/dashboard" style={{ padding:'7px 14px', borderRadius:10, color:'rgba(255,255,255,.65)', fontSize:13, fontWeight:500, textDecoration:'none' }}>📊 My Links</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px', paddingTop:100 }}>

        {/* ── Hero ── */}
        <div style={{ textAlign:'center', paddingBottom:36 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 18px', borderRadius:99, background:'rgba(6,182,212,.1)', border:'1px solid rgba(6,182,212,.3)', color:'#22d3ee', fontSize:12, fontWeight:500, marginBottom:20 }}>
            ✨ Free URL Shortener — No Sign-Up Required
          </div>
          <h1 style={{ fontSize:'clamp(2rem,5.5vw,3.5rem)', fontWeight:900, color:'#fff', lineHeight:1.12, marginBottom:14 }}>
            Short Links,<br /><span className="glow">Big Impact</span>
          </h1>
          <p style={{ color:'rgba(255,255,255,.55)', fontSize:17, maxWidth:460, margin:'0 auto 32px', lineHeight:1.65 }}>
            Create powerful short links with analytics, QR codes &amp; expiry — completely free.
          </p>
        </div>

        {/* ── Shortener Widget ── */}
        <div style={{ maxWidth:680, margin:'0 auto 32px' }}>
          <div className="card" style={{ padding:'28px 30px' }}>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:800, color:'#fff', marginBottom:4 }}>Shorten a URL</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,.5)' }}>No sign-up needed. Paste your link and go.</div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* URL */}
              <div style={{ position:'relative', marginBottom:14 }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:15 }}>🔗</span>
                <input className="inp" type="url" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://your-very-long-url.com/paste/here"
                  style={{ paddingLeft:42 }} disabled={loading} />
              </div>

              {/* Options row */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:14, alignItems:'center' }}>
                <button type="button" onClick={() => setUseAlias(v => !v)}
                  style={{ padding:'8px 14px', borderRadius:12, border:`1px solid ${useAlias ? 'rgba(6,182,212,.45)' : 'rgba(255,255,255,.12)'}`, background: useAlias ? 'rgba(6,182,212,.1)' : 'rgba(255,255,255,.05)', color: useAlias ? '#22d3ee' : 'rgba(255,255,255,.6)', fontSize:13, cursor:'pointer' }}>
                  ✏️ Custom alias
                </button>
                <select className="inp" value={expiry} onChange={e => setExpiry(e.target.value)}
                  style={{ flex:1, minWidth:170, padding:'9px 14px', fontSize:13, appearance:'none', background:'rgba(255,255,255,.07)', cursor:'pointer' }}>
                  <option value="never">♾️ Never expire</option>
                  <option value="date">📅 Expire on date</option>
                  <option value="clicks">👆 Expire after clicks</option>
                </select>
              </div>

              {/* Alias input */}
              {useAlias && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.38)', fontSize:13, fontFamily:'monospace' }}>/go/</span>
                    <input className="inp" type="text" value={alias}
                      onChange={e => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                      placeholder="my-custom-link" style={{ paddingLeft:50, fontFamily:'monospace' }} />
                  </div>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:5 }}>Letters, numbers, hyphens • 3–30 chars</p>
                </div>
              )}

              {/* Date expiry */}
              {expiry === 'date' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, color:'rgba(255,255,255,.55)', display:'block', marginBottom:6 }}>Expiry date &amp; time</label>
                  <input className="inp" type="datetime-local" value={expDate} onChange={e => setExpDate(e.target.value)} style={{ colorScheme:'dark' }} />
                </div>
              )}

              {/* Click expiry */}
              {expiry === 'clicks' && (
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:13, color:'rgba(255,255,255,.55)', display:'block', marginBottom:6 }}>Expire after how many clicks?</label>
                  <input className="inp" type="number" value={expClks} onChange={e => setExpClks(e.target.value)} placeholder="e.g. 100" min="1" />
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 16px', marginBottom:14, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.22)', borderRadius:12, color:'#f87171', fontSize:13 }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="btn-p" disabled={loading || !url.trim()}>
                {loading ? <><span className="spin" /> Shortening…</> : '⚡ Shorten URL'}
              </button>
            </form>

            {/* Result */}
            {result && (
              <div style={{ marginTop:20, padding:20, borderRadius:16, border:'1px solid rgba(6,182,212,.28)', background:'rgba(6,182,212,.05)' }}>
                <div style={{ fontWeight:600, color:'#fff', fontSize:14, marginBottom:12 }}>✅ Link created!</div>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:'10px 14px' }}>
                  <span style={{ flex:1, fontFamily:'monospace', color:'#22d3ee', fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.short}</span>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button className="btn-g" onClick={handleCopy}>{copied ? '✅ Copied!' : '📋 Copy'}</button>
                    <a className="btn-g" href={result.short} target="_blank" rel="noopener">↗ Open</a>
                  </div>
                </div>
                <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>→ {result.originalUrl}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Links ── */}
        {recent.length > 0 && (
          <div style={{ maxWidth:680, margin:'0 auto 44px' }}>
            <div className="card" style={{ padding:'22px 28px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,.45)' }}>🕐 Recent Links</span>
                <Link href="/dashboard" className="btn-g" style={{ textDecoration:'none' }}>View all →</Link>
              </div>
              {recent.slice(0, 5).map(l => (
                <div key={l.code} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <a href={l.short} target="_blank" rel="noopener" style={{ fontFamily:'monospace', color:'#22d3ee', fontSize:13, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textDecoration:'none' }}>{l.short}</a>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.originalUrl}</div>
                  </div>
                  <QBtn url={l.short} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Features ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:14, marginBottom:60 }}>
          {[
            ['⚡','Instant & Free',       'No sign-up required. Short link in seconds.'],
            ['📊','Click Analytics',      'Track clicks, devices, browsers, referrers.'],
            ['📱','QR Code Generator',    'Download a QR code for every link instantly.'],
            ['⏱','Expiry Controls',      'Expire links by date or after X clicks.'],
            ['✏️','Custom Aliases',       'Create branded links like /go/course'],
            ['🔒','Secure',              'URL validation, Firestore rules, rate limiting.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="card" style={{ padding:22, transition:'all .3s', cursor:'default' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.08)'; e.currentTarget.style.borderColor='rgba(6,182,212,.3)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,.1)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ fontSize:26, marginBottom:12 }}>{icon}</div>
              <div style={{ fontWeight:700, color:'#fff', fontSize:15, marginBottom:7 }}>{title}</div>
              <div style={{ color:'rgba(255,255,255,.48)', fontSize:13, lineHeight:1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop:'1px solid rgba(255,255,255,.05)', padding:'20px 16px', textAlign:'center' }}>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.2)' }}>Built with ❤️ by <span style={{ color:'rgba(6,182,212,.6)' }}>CIWEB</span></p>
      </div>
    </div>
  )
}

// Small copy button for recent links
function QBtn({ url }) {
  const [done, setDone] = useState(false)
  const go = async () => { await navigator.clipboard.writeText(url).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 2000) }
  return <button className="btn-g" onClick={go} style={{ flexShrink:0 }}>{done ? '✅' : '📋'}</button>
}
