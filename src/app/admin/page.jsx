'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api'
const onlyDigits = (s='') => (s || '').replace(/\D+/g,'')

const fmtBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))

const fmtData = (s) => {
  if (!s) return '—'
  try {
    const [y, m, d] = String(s).split('-')
    return `${d}/${m}/${y}`
  } catch {
    return s
  }
}

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

  const [proposalPanelByCpf, setProposalPanelByCpf] = useState({})
  const [proposalDataByCpf, setProposalDataByCpf] = useState({})
  const [proposalLoadingByCpf, setProposalLoadingByCpf] = useState({})
  const [proposalSavingByCpf, setProposalSavingByCpf] = useState({})

  const vendedores = useMemo(() => ([
    '', 'Johnny', 'Ana Maria', 'Carol'
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
    ;(async () => {
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

  const toggleProposalPanel = async (cpfUser) => {
    setProposalPanelByCpf((prev) => ({ ...prev, [cpfUser]: !prev[cpfUser] }))

    if (proposalDataByCpf[cpfUser]) return

    setProposalLoadingByCpf((prev) => ({ ...prev, [cpfUser]: true }))
    try {
      const res = await fetch(`${API_BASE}/admin/users/${cpfUser}/proposals`, {
        credentials: 'include',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.detail || 'Falha ao carregar propostas')

      setProposalDataByCpf((prev) => ({
        ...prev,
        [cpfUser]: {
          ...json,
          selected: (json.proposals || [])
            .filter((p) => p.visible)
            .map((p) => String(p.proposal_id)),
        },
      }))
    } catch (e) {
      setErr(e.message || 'Erro ao carregar propostas')
    } finally {
      setProposalLoadingByCpf((prev) => ({ ...prev, [cpfUser]: false }))
    }
  }

  const toggleProposalSelection = (cpfUser, proposalId) => {
    setProposalDataByCpf((prev) => {
      const base = prev[cpfUser]
      if (!base) return prev

      const pid = String(proposalId)
      const selected = base.selected || []
      const nextSelected = selected.includes(pid)
        ? selected.filter((x) => x !== pid)
        : [...selected, pid]

      return {
        ...prev,
        [cpfUser]: {
          ...base,
          selected: nextSelected,
        },
      }
    })
  }

  const saveProposalSelection = async (cpfUser) => {
    const base = proposalDataByCpf[cpfUser]
    if (!base) return

    setProposalSavingByCpf((prev) => ({ ...prev, [cpfUser]: true }))
    setErr('')
    setMsg('')

    try {
      const r = await fetch(`${API_BASE}/admin/users/proposals-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cpf: cpfUser,
          proposal_ids: base.selected || [],
        }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.detail || 'Falha ao salvar seleção')

      setProposalDataByCpf((prev) => ({
        ...prev,
        [cpfUser]: {
          ...prev[cpfUser],
          configured: true,
          proposals: (prev[cpfUser]?.proposals || []).map((p) => ({
            ...p,
            visible: (prev[cpfUser]?.selected || []).includes(String(p.proposal_id)),
          })),
        },
      }))

      setMsg(`✅ Propostas visíveis atualizadas para o CPF ${cpfUser}`)
      await loadUsers()
    } catch (e) {
      setErr(e.message || 'Erro ao salvar seleção')
    } finally {
      setProposalSavingByCpf((prev) => ({ ...prev, [cpfUser]: false }))
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{maxWidth: 980}}>
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
        <div style={{maxHeight:420, overflow:'auto', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:10}}>
          {users.map(u => (
            <div key={u.cpf} style={{padding:'10px 8px', borderBottom:'1px solid rgba(255,255,255,.06)'}}>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <div><b>{u.nome}</b> — {u.cpf}</div>
                <div style={{opacity:.75}}>{u.vendedor || '—'}</div>
              </div>

              <div style={{opacity:.75, fontSize:13, marginTop:4}}>
                Invoices: {(u.invoices || []).join(', ') || '—'}
              </div>

              <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                <button
                  type="button"
                  onClick={() => toggleProposalPanel(u.cpf)}
                  style={{
                    background: '#1f3b73',
                    color: '#fff',
                    border: 0,
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {proposalPanelByCpf[u.cpf] ? 'Ocultar propostas' : 'Configurar propostas'}
                </button>

                <span style={{fontSize:12, opacity:.75}}>
                  {u.proposal_visibility_configured ? 'Seleção personalizada ativa' : 'Sem filtro salvo'}
                </span>
              </div>

              {proposalPanelByCpf[u.cpf] && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    border: '1px solid rgba(255,255,255,.08)',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,.03)',
                  }}
                >
                  {proposalLoadingByCpf[u.cpf] ? (
                    <div>Carregando propostas...</div>
                  ) : !proposalDataByCpf[u.cpf]?.proposals?.length ? (
                    <div>Nenhuma proposta encontrada.</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10, fontSize: 12, opacity: 0.85 }}>
                        Marque apenas as propostas que devem aparecer no portal do paciente.
                      </div>

                      <div style={{ display: 'grid', gap: 8 }}>
                        {(proposalDataByCpf[u.cpf]?.proposals || []).map((p) => {
                          const checked = (proposalDataByCpf[u.cpf]?.selected || []).includes(String(p.proposal_id))

                          return (
                            <label
                              key={p.proposal_id}
                              style={{
                                display: 'flex',
                                gap: 10,
                                alignItems: 'flex-start',
                                padding: 10,
                                borderRadius: 8,
                                background: checked ? 'rgba(80,180,120,.12)' : 'rgba(255,255,255,.02)',
                                border: '1px solid rgba(255,255,255,.08)',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProposalSelection(u.cpf, p.proposal_id)}
                                style={{ marginTop: 3 }}
                              />

                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700 }}>
                                  {fmtData(p.proposal_date)} — {fmtBRL(p.valor)}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                  Status: {p.status || '—'} | ID: {p.proposal_id}
                                </div>

                                {!!p.itens?.length && (
                                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                                    {p.itens.map((it) => it.nome).join(' • ')}
                                  </div>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => saveProposalSelection(u.cpf)}
                          disabled={proposalSavingByCpf[u.cpf]}
                          style={{
                            background: '#2f9e44',
                            color: '#fff',
                            border: 0,
                            borderRadius: 8,
                            padding: '9px 14px',
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          {proposalSavingByCpf[u.cpf] ? 'Salvando...' : 'Salvar seleção'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {!users.length && <div style={{opacity:.7}}>Nenhum usuário ainda.</div>}
        </div>
      </div>

      <div className="auth-glow" />
    </div>
  )
}