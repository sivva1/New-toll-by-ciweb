'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc
} from 'firebase/firestore'

const surl = c => `${typeof window !== 'undefined' ? window.location.origin : ''}/go/${c}`
const fmt  = n => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n || 0)

const fmtDate = ts => {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts)
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

const trunc = (s, n = 55) => s && s.length > n ? s.slice(0, n) + '…' : s

const getDevId = () => {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('ciweb_did')
  if (!id) { id = 'd_' + Math.random().toString(36).slice(2); localStorage.setItem('ciweb_did', id) }
  return id
}

const isExp = l => {
  if (l.expiresAt) {
    const d = l.expiresAt?.toDate ? l.expiresAt.toDate() : new Date(l.expiresAt.seconds * 1000)
    if (d < new Date()) return true
  }
  if (l.expiryClicks && l.clicks >= l.expiryClicks) return true
  return false
}

export default function Dashboard() {
  const [links,   setLinks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('all')

  useEffect(() => {
    const devId = getDevId()
    if (!devId) return
    const q = query(collection(db, 'urls'), where('deviceId', '==', devId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  const now = new Date()

  const stats = {
    total:  links.length,
    clicks: links.reduce((s, l) => s + (l.clicks || 0), 0),
    active: links.filter(l => l.active && !isExp(l)).length,
    today:  links.filter(l => {
      const d = l.createdAt?.toDate ? l.createdAt.toDate() : l.createdAt?.seconds ? new Date(l.createdAt.seconds * 1000) : null
      return d && (now - d) < 86400000
    }).length,
  }

  const filtered = links.filter(l => {
    const m = !search || l.originalUrl?.toLowerCase().includes(search.toLowerCase()) || l.shortCode?.includes(search)
    const e = isExp(l)
    if (filter === 'active')  return m && l.active && !e
    if (filter === 'paused')  return m && !l.active
    if (filter === 'expired') return m && e
    return m
  })

  const toggle = async (l) => {
    await updateDoc(doc(db, 'urls', l.shortCode), { active: !l.active })
  }

  const del = async (code) => {
    if (!confirm('Delete this link?')) return
    await deleteDoc(doc(db, 'urls', code))
    const cached = JSON.parse(localStorage.getItem('ciweb_links') || '[]').filter(x => x.code !== code)
    localStorage.setItem('ciweb_links', JSON.stringify(cached))
  }

  const copy = async (url, setter) => {
    await navigator.clipboard.writeText(url).catch(() => {})
    setter(true); setTimeout(() => setter(false), 2000)
  }

  return (
    <div style={{ minHeight:'100vh' }}>
      {/* Navbar */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, padding:'12px 16px' }}>
        <div className="card" style={{ maxWidth:900, margin:'0 auto', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderRadius:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#06b6d4,#3b82f6)', display:'grid', placeItems:'center', fontWeight:900, fontSize:12, color:'#fff' }}>CI</div>
            <span style={{ fontWeight:800, fontSize:15 }}><span className="glow">CIWEB</span><span style={{ color:'rgba(255,255,255,.55)' }}> Links</span></span>
          </Link>
          <div style={{ display:'flex', gap:4 }}>
            <Link href="/"          style={{ padding:'7px 14px', borderRadius:10, color:'rgba(255,255,255,.65)', fontSize:13, fontWeight:500, textDecoration:'none' }}>🔗 Shorten</Link>
            <Link href="/dashboard" style={{ padding:'7px 14px', borderRadius:10, background:'rgba(6,182,212,.12)', color:'#22d3ee', fontSize:13, fontWeight:500, textDecoration:'none' }}>📊 My Links</Link>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'100px 16px 60px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:28, flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:'#fff' }}>My Links</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,.38)', marginTop:3 }}>All links created on this device</div>
          </div>
          <Link href="/" className="btn-p" style={{ width:'auto', padding:'11px 22px', fontSize:14, textDecoration:'none', display:'inline-flex', alignItems:'center' }}>+ New Link</Link>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:24 }}>
          {[
            ['🔗', stats.total,  'Total Links'],
            ['👆', stats.clicks, 'Total Clicks'],
            ['✅', stats.active, 'Active'],
            ['📅', stats.today,  'Today'],
          ].map(([ico, val, lbl]) => (
            <div key={lbl} className="card" style={{ padding:'18px 20px' }}>
              <div style={{ fontSize:22, marginBottom:10 }}>{ico}</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{fmt(val)}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.38)', marginTop:3 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:18, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.3)', fontSize:13 }}>🔍</span>
            <input className="inp" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search links…" style={{ paddingLeft:34, paddingTop:9, paddingBottom:9, fontSize:13 }} />
          </div>
          <div style={{ display:'flex', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, padding:4, gap:2 }}>
            {[['all','All'],['active','✅'],['paused','⏸'],['expired','⏰']].map(([f, lbl]) => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding:'6px 12px', borderRadius:8, border:'none', fontSize:12, fontWeight:500, cursor:'pointer', transition:'.2s',
                  background: filter === f ? 'linear-gradient(135deg,#06b6d4,#3b82f6)' : 'transparent',
                  color: filter === f ? '#fff' : 'rgba(255,255,255,.5)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Links */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height:180 }} />)}
          </div>
        ) : !links.length ? (
          <div className="card" style={{ padding:60, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>🔗</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#fff', marginBottom:8 }}>No links yet</div>
            <div style={{ color:'rgba(255,255,255,.4)', fontSize:14, marginBottom:24 }}>Create your first short link to get started.</div>
            <Link href="/" className="btn-p" style={{ width:'auto', padding:'11px 24px', fontSize:14, textDecoration:'none', display:'inline-flex', alignItems:'center', margin:'0 auto' }}>+ Create First Link</Link>
          </div>
        ) : !filtered.length ? (
          <div className="card" style={{ padding:48, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔎</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:14 }}>No links match your filter.</div>
            <button onClick={() => { setSearch(''); setFilter('all') }}
              style={{ background:'none', border:'none', color:'#22d3ee', fontSize:13, cursor:'pointer', marginTop:10 }}>Clear filters</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
            {filtered.map(l => <LinkCard key={l.id} link={l} onToggle={toggle} onDelete={del} onCopy={copy} />)}
          </div>
        )}

        {!loading && links.length > 0 && (
          <p style={{ textAlign:'center', fontSize:12, color:'rgba(255,255,255,.2)', marginTop:20 }}>
            Showing {filtered.length} of {links.length} links
          </p>
        )}
      </div>
    </div>
  )
}

function LinkCard({ link: l, onToggle, onDelete, onCopy }) {
  const [copied, setCopied] = useState(false)
  const su  = surl(l.shortCode)
  const exp = isExp(l)
  const bc  = exp ? 'b-expired' : l.active ? 'b-active' : 'b-paused'
  const bt  = exp ? 'Expired'   : l.active ? 'Active'   : 'Paused'

  return (
    <div className="card" style={{ padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span className={bc}>{bt}</span>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>{fmtDate(l.createdAt)}</span>
      </div>

      <a href={su} target="_blank" rel="noopener"
        style={{ fontFamily:'monospace', color:'#22d3ee', fontSize:13, fontWeight:600, textDecoration:'none', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
        {su}
      </a>
      <div style={{ fontSize:12, color:'rgba(255,255,255,.33)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:14 }}>
        {trunc(l.originalUrl)}
      </div>
      <div style={{ fontSize:14, color:'#fff', fontWeight:700, marginBottom:14 }}>
        👆 {fmt(l.clicks)} <span style={{ fontWeight:400, fontSize:12, color:'rgba(255,255,255,.38)' }}>clicks</span>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
        <button className="btn-g" onClick={() => onCopy(su, setCopied)}>
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
        <button className="btn-g" onClick={() => onToggle(l)} disabled={exp}>
          {l.active && !exp ? '⏸ Pause' : '▶ Enable'}
        </button>
        <button className="btn-d" style={{ marginLeft:'auto' }} onClick={() => onDelete(l.shortCode)}>
          🗑 Delete
        </button>
      </div>
    </div>
  )
}
