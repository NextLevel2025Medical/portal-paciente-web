'use client'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image' // para otimização de imagem

const fmtBRL = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)
const fmtData = s => { try{ const [y,m,d]=s.split('-'); return `${d}/${m}/${y}` }catch{ return s } }
const F_MAP = {
  1:'Dinheiro',
  2:'Cheque',
  3:'Transferência',
  4:'Boleto',
  5:'DOC',
  6:'TED',
  7:'Transferência Bancária',
  8:'Cartão de Crédito',
  9:'Cartão de Débito',
  10:'Cartão de Crédito',
  11:'Débito Automático',
  12:'Crédito em Conta',
  13:'Débito em Conta',
  14:'Débito em Conta',
  15:'PIX'
}
const fmtForma = v => F_MAP[Number(v)] || String(v ?? '')

// troque pelo seu WhatsApp com DDI/DD
const SUPPORT_WHATS = '55SEUNUMERO'          // ex: 5531971342952
const PIX_KEY = 'financeiro@drgustavoaquino.com.br'  // da sua arte

const abrirWhats = (motivo) => {
  const msg = encodeURIComponent(`Olá! Quero realizar um novo pagamento (${motivo}).`)
  window.open(`https://wa.me/${SUPPORT_WHATS}?text=${msg}`, '_blank')
}

const copiarPix = async () => {
  try { await navigator.clipboard.writeText(PIX_KEY) } catch {}
}

import dynamic from 'next/dynamic';
const Viewer = dynamic(() => import('../visualizador/Viewer'), { ssr: false });

// === Palavras-chave -> regiões do Viewer ===
// (as chaves precisam existir no REGION_MASKS do Viewer: face, braco, mama, abdomen, coxa, gluteos, costas, umbigo)
const KEYWORDS_MAP = {
  face:    ['blefaroplastia', 'facial'],
  braco:   ['braço', 'braco', 'deltóide', 'deltoide'],
  mama:    ['mastopexia', 'mamoplastia', 'silicone', 'mama', 'sutiã', 'sutia'],
  abdomen: ['abdômen', 'abdomem', 'abdomen', 'abdominoplastia', 'LIPO ULTRASSONICA VASER HD FEM 360 COM MICROAIRE E MARCACAO BODY& ART COMPLEXA','UGRAFT (LIPOENXERTIA GUIADA POR ULTRASOM DO RETO ABDOMINAL)','XPINE FAT DO LONGUISSIMO','LIPO ULTRASSÔNICA VASER HD FEM 360 COM MICROAIRE E MARCAÇÃO BODY& ART (PADRAO)','RAFT - LIPOENXERTIA DO RETO ABDOMINAL'],
  coxa:    ['coxa'],
  gluteos: ['heart shape', 'glúteos', 'gluteos', 'glútea', 'glutea', 'bumbum'],
  costas:  ['costas', 'dorsal'],
  umbigo:  ['pdo umbilical', 'umbilical', 'umbigo'],
  pescoco: ['pescoço', 'pescoco', 'cervical'],
  intima:  ['estética íntima', 'intima', 'vagina', 'vulva', 'pubis', 'monte de venus','MICROFAT EM GRANDES LABIOS','LABIOPLASTIA MENOR ( NINFOPLASTIA)'],
};

// === Universo de regiões “nucleares” que podem ser sugeridas ===
const ALL_REGIONS = [
  'face','braco','mama','abdomen','coxa','gluteos','costas','umbigo','pescoco','intima'
]

// Catálogo (rótulo + preços) usado para montar as sugestões das regiões não contratadas.
// Ajuste os valores conforme sua política ou alimente isso pela API depois.
const REGION_OFFERS = {
  face:   { nome: 'Procedimentos para Face',        avulso: 15000, momento: 12000 },
  braco:  { nome: 'Lipo de Braços',                 avulso:  9000, momento:  7500 },
  mama:   { nome: 'Mastopexia / Mamoplastia',       avulso: 18000, momento: 15000 },
  abdomen:{ nome: 'Lipo / Abdominoplastia',         avulso: 20000, momento: 17000 },
  coxa:   { nome: 'Lipo de Coxas',                  avulso: 12000, momento:  9900 },
  gluteos:{ nome: 'Lipoenxertia Glútea',            avulso: 16000, momento: 13500 },
  costas: { nome: 'Lipo Dorsal',                    avulso: 11000, momento:  9500 },
  umbigo: { nome: 'PDO Umbilical',                  avulso:  3500, momento:  3000 },
  pescoco:{ nome: 'Lipo Cervical',                  avulso:  8000, momento:  6800 },
  intima: { nome: 'Estética Íntima',                avulso:  7000, momento:  5900 },
}

// Gera sugestões de regiões que AINDA NÃO foram compradas
function buildRegionSuggestions(purchasedRegions, limit = Infinity) {
  const notBought = ALL_REGIONS.filter(r => !purchasedRegions.includes(r));
  return notBought.slice(0, limit).map(r => ({
    _region: r,
    nome: REGION_OFFERS[r]?.nome ?? r,
    avulso: REGION_OFFERS[r]?.avulso ?? 0,
    momento: REGION_OFFERS[r]?.momento ?? 0,
  }));
}

// normaliza acentos/maiúsculas
const norm = (s='') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// devolve as regiões que casam com um texto
function regionsFromText(text='') {
  const t = norm(text);
  const out = new Set();
  for (const [region, words] of Object.entries(KEYWORDS_MAP)) {
    for (const w of words) {
      if (t.includes(norm(w))) { out.add(region); break; }
    }
  }
  return Array.from(out);
}

// coleta regiões a partir de data.propostas / data.procedimentos
function collectRegionsFromData(data) {
  const found = new Set();

  if (Array.isArray(data?.propostas) && data.propostas.length) {
    for (const prop of data.propostas) {
      for (const it of (prop?.itens || [])) {
        regionsFromText(it?.nome || '').forEach(r => found.add(r));
      }
    }
  }
  if (!found.size && Array.isArray(data?.procedimentos)) {
    for (const p of data.procedimentos) {
      regionsFromText(p?.nome || '').forEach(r => found.add(r));
    }
  }
  return found.size ? Array.from(found) : ['abdomen']; // fallback
}

function DashboardInner(){
  const sp = useSearchParams()
  const router = useRouter()
  const patientId = sp.get('patient_id')
  const name = decodeURIComponent(sp.get('name') || 'Paciente ')
  const cpf = sp.get('cpf')
  const invoiceIdQS = sp.get('invoice_id') || ''    // sempre string
  const [data,setData] = useState(null)
  const [err,setErr] = useState('')

  // modal de pagamento
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [showPix, setShowPix] = useState(false)
  const [lastGood, setLastGood] = useState(null)

  // === Seleção de adicionais ===
const [ofertasSelecionadas, setOfertasSelecionadas] = useState([]);

const toggleOferta = (idx) => {
  setOfertasSelecionadas((prev) =>
    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
  );
};

const contratarSelecionadas = () => {
  if (!ofertasSelecionadas.length) return;

  const itens = ofertasSelecionadas.map(i => allSuggs[i]);
  const texto = itens
    .map(o => `• ${o.nome} — ${fmtBRL(o.momento)}`)
    .join('%0A'); // quebra de linha p/ WhatsApp

  const total = itens.reduce((s, o) => s + (Number(o.momento) || 0), 0);
  const msg = encodeURIComponent(
    `Olá! Gostaria de contratar agora:%0A${texto}%0A%0ATotal: ${fmtBRL(total)}`
  );

  window.open(`https://wa.me/${WHATS_NUMBER}?text=${msg}`, '_blank');
};

  useEffect(()=>{
    if(!patientId) return
    const base = `http://127.0.0.1:8000/patient/${patientId}/summary`
    const qs   = cpf
      ? `?cpf=${encodeURIComponent(cpf)}&debug=1`
      : (invoiceIdQS ? `?invoice_id=${encodeURIComponent(invoiceIdQS)}&debug=1` : '?debug=1')

    const url = base + qs
    console.log('[FETCH]', url) // confira no console

    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        console.log('[SUMMARY]', j) // confira se vem pagamentos
        setData(j)
      })
      .catch(() => setErr('Erro ao carregar dados'))
  }, [patientId, cpf, invoiceIdQS]) // <-- tamanho fixo: 3 deps

const linhas = useMemo(()=>{
  if(!data) return { rows:[], total: fmtBRL(0), pago: fmtBRL(0), saldo: fmtBRL(0) }

  const pagamentos = Array.isArray(data.pagamentos) ? data.pagamentos : []
  const totalN = Number(data?.financeiro?.total) || 0

  let acumulado = 0
  const rows = pagamentos.map((p, idx)=>{
    const valorN = Number(p?.valor) || 0
    const formaId = Number(p?.forma_pagamento_id ?? p?.forma)
    const formaTxt = F_MAP[formaId] || p?.forma || '—'
    acumulado += valorN
    return {
      idx,
      data: fmtData(p?.data || ''),
      forma: formaTxt,
      valor: fmtBRL(valorN),
      acumulado: fmtBRL(acumulado),
      saldoApos: fmtBRL(Math.max(totalN - acumulado, 0)),
      doc: p?.documento || p?.nsu || p?.descricao || '',
    }
  })

  const pagoN  = pagamentos.reduce((s,p)=> s + (Number(p?.valor)||0), 0)
  const saldoN = Math.max(totalN - pagoN, 0)

  return { rows, total: fmtBRL(totalN), pago: fmtBRL(pagoN), saldo: fmtBRL(saldoN) }
}, [data])

  const statusCirurgia = useMemo(() => {
    const cir = data?.agendamentos?.find(a =>
      ((a?.procedimento_nome ?? a?.tipo ?? '') + '').toLowerCase().includes('cirurg')
    )
    if (!cir) return { label: 'A definir', cls: 'pendente' }
    const st = (cir?.status_nome ?? cir?.status ?? '').toLowerCase()
    const cls = st.includes('realiz') ? 'realizado' : (st.includes('agend') ? 'agendado' : 'pendente')
    return { label: `${fmtData(cir.data)} (${cir?.status_nome ?? cir?.status ?? '—'})`, cls }
  }, [data])

  // memo que calcula UMA vez por mudança do 'data'
  const viewerRegions = useMemo(() => collectRegionsFromData(data), [data]);  

  if(!patientId){
    return <p>Faltou o ID do paciente. <a className="link" onClick={()=>router.push('/login')}>Voltar</a></p>
  }
  if(err) return <p style={{color:'#ef4444'}}>{err}</p>
  if(!data) return <p>Carregando…</p>

  const oportunidades = (data.adicionais_sugeridos || []).map(o => ({
    nome: o.nome,
    avulso: o.preco_avulso ?? o.valor ?? 0,
    momento: o.preco_momento ?? o.valor ?? 0,
    descricao: o.descricao || o.description || '' // opcional, se vier da API
  }))

  // Regiões já detectadas a partir das propostas/procedimentos
  const purchasedRegions = viewerRegions || [];

  // Todas as sugestões derivadas das regiões não contratadas
  const regionSuggsAll = buildRegionSuggestions(purchasedRegions);

  // Lista final: o que já vem da API + TODAS as sugestões de regiões
  const allSuggs = [...(oportunidades || []), ...regionSuggsAll];

  // Regiões vindas dos adicionais marcados na tabela "POSSIBILIDADES ADICIONAIS"
  const extraRegions = (() => {
    const s = new Set();
    for (const idx of ofertasSelecionadas) {
      const o = allSuggs[idx];
      if (!o) continue;
      // Se a sugestão já veio mapeada para uma região (_region), usa direto;
      // caso contrário, tenta inferir pela descrição usando as palavras-chave.
      const regs = o._region ? [o._region] : regionsFromText(o?.nome || '');
      regs.forEach(r => s.add(r));
    }
    return Array.from(s);
  })();

  // União: mantém as cores dos procedimentos contratados e soma as dos adicionais
  const viewerRegionsCombined = Array.from(
    new Set([...(purchasedRegions || []), ...extraRegions])
  );

  const waLink = "https://wa.me/55SEUNUMERO?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20minha%20cirurgia."

  const WHATS_NUMBER = '55SEUNUMERO' // ex: 5511999999999
  const contratarAgora = (o) => {
    const msg = encodeURIComponent(`Olá! Quero contratar "${o.nome}" no momento cirúrgico por ${fmtBRL(o.momento)}.`)
    window.open(`https://wa.me/${WHATS_NUMBER}?text=${msg}`, '_blank')
  }

  // util p/ comparar datas YYYY-MM-DD
const toDateOnly = (s) => {
  try {
    const [y,m,d] = String(s).split('-').map(Number)
    return new Date(y, (m||1)-1, d||1)
  } catch { return new Date(NaN) }
}

const getApptMeta = (a) => {
  const today = new Date(); today.setHours(0,0,0,0)
  const d = toDateOnly(a?.data)
  const s = String(a?.status_nome ?? a?.status ?? '').toLowerCase()

  const isFuture   = d > today
  const isDone     = /realiz|atendid|compareceu/.test(s)
  const isCanceled = /desmarc|cancel|faltou|no[- ]show|não compareceu|nao compareceu/.test(s)
  const isConfirm  = /confirmad/.test(s) && !/não confirm|nao confirm/.test(s)
  const isPending  = /não confirm|nao confirm|pendente/.test(s)

  if (isDone)                return { cls: 'done',      label: 'Realizado' }
  if (isCanceled)            return { cls: 'cancelled', label: 'Cancelado' }
  if (isFuture && isConfirm) return { cls: 'upcoming',  label: 'Próximo' }
  if (isFuture || isPending) return { cls: 'pending',   label: 'A confirmar' }
  // passado e não realizado: provavelmente perdido/sem registro
  return { cls: 'missed', label: 'Perdido' }
}

  return (
    <div className="wrap">
      {/* ===== HEADER COM LOGO ===== */}
      <div className="header">
        <div className="brand">
          <Image
            src="/logo-concept.png" // coloque o arquivo em public/
            alt="Concept Clinic"
            width={450}
            height={150}
            className="brand-logo"
            priority
          />
        </div>
        <a className="link logout" onClick={() => router.push('/login')}>
          <img src="/EXIT.png" alt="" className="logout-ico" width="150" height="150" />
          SAIR
        </a>
      </div>
      <h2 className="welcome" style={{margin:'6px 0 18px'}}>
        {data?.paciente?.nome || name}
      </h2>

      {/* KPIs no topo — agora com largura total do container */}
      <div className="card-grid">
        <div className="card"><h3>Total</h3><div className="kpi">{fmtBRL(data.financeiro.total)}</div></div>
        <div className="card"><h3>Pago</h3><div className="kpi" style={{color:'var(--ok)'}}>{fmtBRL(data.financeiro.pago)}</div></div>
        <div className="card"><h3>Saldo</h3><div className="kpi" style={{color:'#ff4d4d'}}>{fmtBRL(data.financeiro.saldo)}</div></div>
      </div>

      {/* DUAS COLUNAS */}
      {/* ==== BLOCO DE CIMA (coluna esquerda empilhada) ==== */}
      <div className="grid-1">
        {/* ESQUERDA: Procedimentos + Adicionais + Viewer */}
        <div className="left-col">
          {/* CONTAINER: Procedimentos + Adicionais */}
          <div className="panel stack-panel" style={{ marginBottom: 0 }}>
            <div className="section-title">PROCEDIMENTOS CONTRATADOS</div>

            {Array.isArray(data.propostas) && data.propostas.length > 0 ? (
              data.propostas.map((prop, idx) => (
                <div key={prop.proposal_id || idx} className="panel" style={{marginBottom:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div className="sub">
                      Proposta #{prop.proposal_id || (idx+1)}
                      {prop.proposal_date && (
                        <span style={{marginLeft:8, fontSize:'0.9em', opacity:.8}}>
                          ({fmtData(prop.proposal_date)})
                        </span>
                      )}
                    </div>
                    <div className="kpi">{fmtBRL(prop.valor || 0)}</div>
                  </div>
                  <ul className="list">
                    {(prop.itens || []).map((it, i)=> {
                      const regs = regionsFromText(it?.nome || '');
                      return (
                        <li key={i}>
                          <b>{it.nome}</b>
                          {regs.map(r => (
                            <span className="chip small" key={r} style={{ marginLeft: 8 }}>{r}</span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            ) : (
              <div className="panel" style={{marginBottom:12}}>
                <ul className="list">
                  {data.procedimentos?.map((p,i)=> {
                    const regs = regionsFromText(p?.nome || '');
                    return (
                      <li key={i}>
                        <b>{p.nome}</b>
                        <div className="mono">{fmtBRL(p.valor)}</div>
                        {regs.map(r => (
                          <span className="chip small" key={r} style={{ marginLeft: 8 }}>{r}</span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {/* CONTRATAÇÕES ADICIONAIS */}
            <div className="section-title">POSSIBILIDADES ADICIONAIS</div>
            <div className="panel" style={{ marginBottom: 0 }}>
              {(allSuggs.length) ? (
                <>
                  {/* Cabeçalho fixo */}
                  <table className="table compact allow-overflow" style={{ tableLayout: 'fixed', width: '100%' }}>
                    <thead>
                      <tr>
                        <th className='col-service'>Serviço</th>
                        <th className="col-red">Valor avulso</th>
                        <th className="col-green">No dia da sua cirurgia</th>
                        <th className="col-action">Selecionar</th>
                      </tr>
                    </thead>
                  </table>

                  {/* Corpo rolável: altura ajustada para ~3 linhas visíveis */}
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    <table className="table compact" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <tbody>
                        {allSuggs.map((o, i) => (
                          <tr key={i}>
                            <td>
                              <span className="svc-name">
                                <div>
                                  {o.nome}
                                </div>
                                {o._region && <span className="chip small">{o._region}</span>}
                              </span>
                            </td>
                            <td className="col-red">{fmtBRL(o.avulso)}</td>
                            <td className="col-green">{fmtBRL(o.momento)}</td>
                            <td className="col-action">
                              <input
                                type="checkbox"
                                className="checkbox-premium"
                                checked={ofertasSelecionadas.includes(i)}
                                onChange={() => toggleOferta(i)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="sub">Sem sugestões no momento.</p>
              )}
            </div>
          <div className="pay-actions right">
            <button
              className="btn-cta"
              disabled={!ofertasSelecionadas.length}
              onClick={contratarSelecionadas}
            >
              Contratar selecionados
            </button>
          </div>

          </div>
        </div>
        {/* DIREITA (vazia neste bloco superior para não criar “gap”) */}
        <div className="panel viewer-panel">
          <div className="viewer-inner">
            <Viewer selecionados={viewerRegionsCombined} autoRotate />
          </div>
        </div>
      </div>
      
      {/* ==== NOVA SEÇÃO (lado a lado) – Evolução x Agendamentos ==== */}
      <div className="grid-2 section-dupla">
        {/* ESQUERDA: EVOLUÇÃO DOS PAGAMENTOS */}
        <div>
          <div className="block-title">EVOLUÇÃO DOS PAGAMENTOS</div>
          <div className="panel">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Data</th><th>Valor</th><th>Forma</th><th>Acumulado</th><th>Valor a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {linhas.rows.map((p, i)=>(
                  <tr key={i}>
                    <td>{p.data}</td>
                    <td>{p.valor}</td>
                    <td>{p.forma}</td>
                    <td>{p.acumulado}</td>
                    <td>{p.saldoApos}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><b>Total Pago</b></td>
                  <td><b>{fmtBRL(data.financeiro.pago)}</b></td>
                  <td><b>{fmtBRL(data.financeiro.saldo)}</b></td>
                </tr>
              </tfoot>
            </table>
      
            <div className="pay-actions">
              <button className="btn-cta" onClick={()=>{ setShowPix(false); setPayModalOpen(true) }}>
                Realizar novo pagamento
              </button>
            </div>
      
            {linhas.rows.length === 0 && <p className="sub">Nenhum pagamento registrado ainda.</p>}
          </div>
        </div>
      
        {/* DIREITA: AGENDAMENTOS */}
        <div>
          <div className="block-title">AGENDAMENTOS</div>
          <div className="panel">
            <ul className="list">
              {data.agendamentos.map((a, i) => {
                const meta = getApptMeta(a)
                return (
                  <li key={i} className={`appt-item ${meta.cls}`}>
                    <div className="appt-title">{a.procedimento_nome ?? a.tipo}</div>
                    {(a.profissional_nome || a.profissional) && (
                      <div className="appt-prof">{a.profissional_nome || a.profissional}</div>
                    )}
                    <div className="appt-row">
                      <span className="mono">
                        {fmtData(a.data)}{a.horario ? ` às ${String(a.horario).slice(0,5)}` : ''}
                      </span>
                      <span className={`chip ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="appt-status">{a.status_nome ?? a.status}</div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
      
      {/* ===== MODAL: Realizar novo pagamento ===== */}
      {payModalOpen && (
        <div className="modal-backdrop" onClick={()=>setPayModalOpen(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>Realizar novo pagamento</h3>

            <div className="modal-options">
              <button className="btn-choice" onClick={()=>abrirWhats('Dinheiro')}>
                Dinheiro
              </button>
              <button className="btn-choice" onClick={()=>setShowPix(true)}>
                Pix
              </button>
              <button className="btn-choice" onClick={()=>abrirWhats('Cartão de Crédito')}>
                Cartão de Crédito
              </button>
            </div>

            {showPix && (
              <div className="pix-box">
                <div className="pix-row">
                  <div>
                    <div className="sub" style={{marginBottom:6}}>Chave Pix</div>
                    <div className="pix-key">{PIX_KEY}</div>
                  </div>
                  <button className="btn-cta" onClick={copiarPix}>Copiar chave</button>
                </div>

                {/* opcional: mostrar uma imagem com os dados (coloque o arquivo em /public/) */}
                {/* <img src="/dados-pix.jpg" alt="Dados Pix" className="pix-img" /> */}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-ghost" onClick={()=>setPayModalOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Botão flutuante do WhatsApp */}
      <a className="fab-whatsapp" href={waLink} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp">
        <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M19.11 17.19c-.3-.15-1.77-.87-2.05-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.24-.46-2.36-1.46-.87-.77-1.46-1.73-1.63-2.02-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.48-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.52 0 1.48 1.08 2.92 1.23 3.12.15.2 2.13 3.25 5.16 4.55.72.31 1.28.5 1.72.64.72.23 1.38.2 1.9.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM16 3C9.37 3 4 8.37 4 15c0 2.12.55 4.11 1.53 5.84L4 29l8.33-1.47A11.9 11.9 0 0 0 16 27c6.63 0 12-5.37 12-12S22.63 3 16 3z"/>
        </svg>
      </a>

      {/* estilos locais para layout responsivo e largura do container */}
      <style jsx>{`
        .wrap{
          width: min(96vw, 1500px);
          margin: 0 auto;
          padding: 0 16px;
        }
        .card-grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .left-col{ display:grid; gap:14px; }                  /* empilha Procedimentos + Viewer */
        .viewer-box{ padding:0; overflow:hidden; }
        .viewer-box > div{ width:100%; height:560px; display:grid; place-items:center; }

        .section-dupla{ margin-top:18px; align-items:stretch; } /* grid dos dois painéis lado a lado */
        .block-title{ margin-top:0; }                           /* tira “respiro” extra no topo da seção */

        /* telas muito grandes: pode abrir um pouco mais */
        @media (min-width: 1700px){
          .wrap{ width: min(94vw, 1680px); }
        }

        /* responsivo */
        @media (max-width: 1100px){
          .grid-2{ grid-template-columns: 1fr; }
        }
        @media (max-width: 700px){
          .card-grid{ grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
    export default function Dashboard() {
      return (
        <Suspense fallback={null}>
          <DashboardInner />
        </Suspense>
      )
    }

    export const dynamic = 'force-dynamic';
  )
}
