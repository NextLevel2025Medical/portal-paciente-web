'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const onlyDigits = (s='') => (s || '').replace(/\D+/g,'')
const maskCPF = (v='') => {
  const d = onlyDigits(v).slice(0,11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export default function LoginPage(){
  const router = useRouter()
  const [cpf,setCpf] = useState('')
  const [password,setPassword] = useState('')
  const [showPw,setShowPw] = useState(false)
  const [loading,setLoading] = useState(false)
  const [err,setErr] = useState('')

  const submit = async (e)=>{
    e.preventDefault()
    setLoading(true); setErr('');
    try{
      const r = await fetch(`${API_BASE}/auth/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials: 'include',           // <— necessário para receber o cookie
        body: JSON.stringify({ cpf: onlyDigits(cpf), password })
      })
      if(!r.ok){
        const j = await r.json().catch(()=>({detail:'Erro'}))
        throw new Error(j?.detail || 'Falha no login')
      }
      const j = await r.json()
      // TODO: salvar token se necessário
      router.push('/dashboard');          // <— sem query string
    }catch(e){
      setErr(e.message || 'Não foi possível entrar')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-line">
          {/* Use o arquivo da sua logo em /public (ex.: /logo-concept.png) */}
          <img src="/logo-concept.png" alt="Concept Clinic" className="brand-logo" />
          <h1>Portal do Paciente</h1>
          <p className="brand-sub">Acompanhe sua jornada com segurança</p>
        </div>

        <form onSubmit={submit} className="auth-form" autoComplete="on">
          <label className="lbl">CPF</label>
          <div className="input-wrap">
            <input
              className="input"
              value={cpf}
              onChange={e=>setCpf(maskCPF(e.target.value))}
              inputMode="numeric"
              placeholder="000.000.000-00"
              required
            />
            <span className="input-icon">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 7H5V5h14v2Zm0 6H5v-2h14v2Zm0 6H5v-2h14v2Z"/></svg>
            </span>
          </div>

          <label className="lbl">Senha</label>
          <div className="input-wrap">
            <input
              className="input"
              type={showPw?'text':'password'}
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
            />
            <button
              type="button"
              className="input-icon btn-eye"
              onClick={()=>setShowPw(s=>!s)}
              aria-label={showPw?'Ocultar senha':'Mostrar senha'}
              title={showPw?'Ocultar senha':'Mostrar senha'}
            >
              {showPw ? (
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 6c5.5 0 9.5 6 9.5 6s-4 6-9.5 6S2.5 12 2.5 12 6.5 6 12 6Zm0 2c-3.7 0-6.8 2.9-8 4 .9.9 4.1 4 8 4s7.1-3.1 8-4c-.9-.9-4.1-4-8-4Zm0 1.5A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5Z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3.3 2.6 2 3.9l3 3C3.7 8.3 2.6 10 2.6 10S6.6 16 12 16c1.8 0 3.4-.5 4.8-1.3l3.2 3.2 1.3-1.3L3.3 2.6ZM7.6 8.2l1.5 1.5A2.5 2.5 0 0 0 9.5 12l1.5 1.5c-.3.1-.6.1-1 .1A2.6 2.6 0 0 1 7.4 11c0-.3 0-.6.2-.8ZM12 8c3.7 0 6.8 2.9 8 4-.4.4-1.1 1.2-2 2l-2-2c.1-.3.1-.6.1-.9A2.6 2.6 0 0 0 13 8.1c-.3 0-.6 0-.9.1l-1.9-2C10.9 8.1 11.4 8 12 8Z"/></svg>
              )}
            </button>
          </div>

          {err && <div className="auth-error">{err}</div>}

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="form-foot">
            <a className="link" href="https://wa.me/55SEUNUMERO" target="_blank" rel="noreferrer">
              Esqueci minha senha
            </a>
          </div>
        </form>
      </div>

      {/* fundo decorativo sutil */}
      <div className="auth-glow" />
    </div>
  )
}
