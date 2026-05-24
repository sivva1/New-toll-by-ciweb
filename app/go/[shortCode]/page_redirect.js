'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore'

export default function RedirectPage() {
  const { shortCode } = useParams()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!shortCode) return
    async function go() {
      try {
        const snap = await getDoc(doc(db, 'urls', shortCode))
        if (!snap.exists())  return setStatus('notfound')
        const d = snap.data()
        if (!d.active)       return setStatus('inactive')

        if (d.expiresAt) {
          const exp = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt.seconds * 1000)
          if (exp < new Date()) return setStatus('expired')
        }
        if (d.expiryClicks && d.clicks >= d.expiryClicks) return setStatus('expired')

        setStatus('redirecting')

        // Track (non-blocking)
        const ua = navigator.userAgent
        updateDoc(doc(db, 'urls', shortCode), { clicks: increment(1) }).catch(() => {})
        addDoc(collection(db, 'urls', shortCode, 'analytics'), {
          timestamp: serverTimestamp(),
          referrer:  document.referrer || 'Direct',
          device:    /mobile/i.test(ua) && !/tablet|ipad/i.test(ua) ? 'Mobile' : /tablet|ipad/i.test(ua) ? 'Tablet' : 'Desktop',
          browser:   /Chrome/i.test(ua) && !/Edge/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Other',
        }).catch(() => {})

        await new Promise(r => setTimeout(r, 900))
        window.location.href = d.originalUrl
      } catch { setStatus('notfound') }
    }
    go()
  }, [shortCode])

  const S = {
    loading:     { icon: null, title: 'Looking up link…',    sub: 'Please wait a moment.' },
    redirecting: { icon: '🚀', title: 'Redirecting…',        sub: 'Taking you to your destination.' },
    expired:     { icon: '⏰', title: 'Link Expired',        sub: 'This link has expired.' },
    inactive:    { icon: '⏸', title: 'Link Paused',         sub: 'This link has been paused by its creator.' },
    notfound:    { icon: '🔍', title: 'Link Not Found',      sub: `The code "${shortCode}" doesn't exist.` },
  }[status] || {}

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div className="card" style={{ maxWidth:380, width:'100%', padding:'44px 32px', textAlign:'center' }}>

        {/* Logo */}
        <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg,#06b6d4,#3b82f6)', display:'grid', placeItems:'center', fontWeight:900, fontSize:18, color:'#fff', margin:'0 auto 22px' }}>CI</div>

        {/* Spinner or icon */}
        {status === 'loading' ? (
          <div style={{ width:44, height:44, margin:'0 auto 18px', borderRadius:'50%', border:'2px solid rgba(255,255,255,.1)', borderTopColor:'#06b6d4', animation:'rot .8s linear infinite' }} />
        ) : (
          <div style={{ fontSize:40, marginBottom:14 }}>{S.icon}</div>
        )}

        <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:8 }}>{S.title}</div>
        <div style={{ color:'rgba(255,255,255,.45)', fontSize:14, marginBottom:20 }}>{S.sub}</div>

        {/* Progress bar for redirecting */}
        {status === 'redirecting' && (
          <div style={{ height:3, background:'rgba(255,255,255,.1)', borderRadius:99, overflow:'hidden', marginBottom:20 }}>
            <div style={{ height:'100%', background:'linear-gradient(to right,#06b6d4,#3b82f6)', borderRadius:99, width:'100%', transition:'width .9s ease-out' }} />
          </div>
        )}

        {/* Back button for error states */}
        {['expired','inactive','notfound'].includes(status) && (
          <a href="/" className="btn-p" style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', width:'auto', padding:'11px 24px', fontSize:14, margin:'0 auto' }}>
            Go to CIWEB Links
          </a>
        )}

        <p style={{ fontSize:11, color:'rgba(255,255,255,.18)', marginTop:22 }}>Powered by CIWEB Links</p>
      </div>
    </div>
  )
}
