'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api'
const onlyDigits = (s='') => (s || '').replace(/\D+/g,'')

export default function AdminPage(){
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [invoice, setInvoice] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [users, setUsers] = useState([])

  const vendedores = useMemo(() => ([
    '', 'Johnny', 'Rayane', 'Thiago'
  ]), [])

  const sair = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method:'POST', credentials:'include' })
    router.push('/login')
  }

  const loadUsers = async () => {
    const r = await fetch(`${API_BASE}/admin/users?limit=50`, { credentials:'include' })
    if (r.status === 401) { router.push('/login'); return }
    const j = await r.json().catch(()=>null)
    if (!r.ok) throw new Error(j?.detail || 'Falha ao listar usuários')
    setUsers(j?.users || [])
  }

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API_BASE}/auth/me`, { credentials:'include' })
      if (!r.ok) { router.push('/login'); return }
      const j = await r.json()
      if (!j?.is_admin) { router.push('/dashboard'); return }
      setMe(j)
      await loadUsers()
    })().catch(()=>{})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr(''); setMsg('')
    try{
      const payload = {
        nome: nome.trim(),
        cpf: onlyDigits(cpf),
        invoice_id: invoice.trim(),
        vendedor: vendedor || null,
      }
      const r = await fetch(`${API_BASE}/admin/users`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify(payload),
      })
      const j = await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(j?.detail || 'Falha ao criar usuário')

      setMsg(`✅ Usuário criado/atualizado: ${j.cpf} | invoice ${j.invoice_id}`)
      setNome(''); setCpf(''); setInvoice(''); setVendedor('')
      await loadUsers()
    }catch(e2){
      setErr(e2.message || 'Erro')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{maxWidth: 820}}>
        <div className="brand-line">
          <img src="/logo-concept.png" alt="Concept Clinic" className="brand-logo" />
          <h1>Admin • Portal do Paciente</h1>
          <p className="brand-sub">Cadastro de usuários de acesso</p>
        </div>

        <div style={{display:'flex', gap:12, justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
          <div style={{opacity:.8, fontSize:14}}>
            Logado como: <b>{me?.name || '—'}</b>
          </div>
          <button className="btn" onClick={sair}>Sair</button>
        </div>

        <form onSubmit={submit} className="auth-form" autoComplete="off">
          <label className="lbl">Nome</label>
          <input className="input" value={nome} onChange={e=>setNome(e.target.value)} required />

          <label className="lbl">CPF</label>
          <input className="input" value={cpf} onChange={e=>setCpf(e.target.value)} inputMode="numeric" required />

          <label className="lbl">Invoice</label>
          <input className="input" value={invoice} onChange={e=>setInvoice(e.target.value)} required />

          <label className="lbl">Vendedor</label>
          <select className="input" value={vendedor} onChange={e=>setVendedor(e.target.value)}>
            {vendedores.map(v => <option key={v} value={v}>{v || '—'}</option>)}
          </select>

          {err && <div className="auth-error">{err}</div>}
          {msg && <div className="auth-ok" style={{marginTop:8}}>{msg}</div>}

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando…' : 'Criar / Atualizar usuário'}
          </button>
        </form>

        <hr style={{margin:'22px 0', opacity:.18}} />

        <h3 style={{marginBottom:10}}>Últimos usuários</h3>
        <div style={{maxHeight:260, overflow:'auto', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:10}}>
          {users.map(u => (
            <div key={u.cpf} style={{padding:'8px 6px', borderBottom:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <div><b>{u.nome}</b> — {u.cpf}</div>
                <div style={{opacity:.75}}>{u.vendedor || '—'}</div>
              </div>
              <div style={{opacity:.75, fontSize:13}}>
                Invoices: {(u.invoices || []).join(', ') || '—'}
              </div>
            </div>
          ))}
          {!users.length && <div style={{opacity:.7}}>Nenhum usuário ainda.</div>}
        </div>
      </div>

      <div className="auth-glow" />
    </div>
  )
}
