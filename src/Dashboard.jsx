import React from 'react';
import { T } from './tokens.js';
import { ETAPAS } from './data.js';

const ETAPA_COLOR = {
  alpha: T.dorado, entrevistado: '#5B8FA8', propuesta: T.sage,
  cerrado: '#2D5016', en_pausa: T.tinta40, cancelado: T.terracota,
};

const META_MENSUAL_USD = 4000;  // meta de prima anualizada por mes
const META_ANUAL_USD = META_MENSUAL_USD * 12;

function fmtUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n) + '%';
}

export default function Dashboard({ prospectos }) {
  const total = prospectos.length;
  const cerrados = prospectos.filter((p) => p.estado === 'cerrado');

  // Prima anualizada: desde datos del cierre (campo primaMensualUSD * 12)
  // Solo cuenta los cerrados que tienen el cierre completo
  const cerradosConCierre = cerrados.filter((p) => p.cierre?.primaMensualUSD && Number(p.cierre.primaMensualUSD) > 0);
  const primaAnualTotal = cerradosConCierre.reduce((acc, p) => acc + Number(p.cierre.primaMensualUSD) * 12, 0);
  const primaMensualTotal = cerradosConCierre.reduce((acc, p) => acc + Number(p.cierre.primaMensualUSD), 0);
  const primaAnualPromedio = cerradosConCierre.length > 0 ? primaAnualTotal / cerradosConCierre.length : null;
  const primaMensualPromedio = cerradosConCierre.length > 0 ? primaMensualTotal / cerradosConCierre.length : null;

  // Progreso hacia meta MDRT: prima anualizada total vs meta anual
  const pctMetaAnual = META_ANUAL_USD > 0 ? Math.min(100, (primaAnualTotal / META_ANUAL_USD) * 100) : 0;

  // Por etapa
  const porEtapa = ETAPAS.map((e) => ({
    ...e,
    count: prospectos.filter((p) => p.estado === e.id).length,
  }));

  // Conversión alpha → cerrado
  const enPipeline = prospectos.filter((p) => ['alpha', 'entrevistado', 'propuesta', 'cerrado'].includes(p.estado)).length;
  const tasaConversion = enPipeline > 0 ? (cerrados.length / enPipeline) * 100 : 0;

  // Acciones vencidas
  const hoy = new Date().toISOString().slice(0, 10);
  const vencidas = prospectos.filter((p) => p.fechaAccion && p.fechaAccion < hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado').length;

  // Fuentes
  const fuenteMap = {};
  prospectos.forEach((p) => { const f = p.fuente || 'Sin definir'; fuenteMap[f] = (fuenteMap[f] || 0) + 1; });
  const fuentes = Object.entries(fuenteMap).sort((a, b) => b[1] - a[1]);

  // Cumpleaños este mes
  const mesActual = new Date().getMonth();
  const cumpleMes = prospectos.filter((p) => {
    if (!p.fechaNacimiento) return false;
    const nac = new Date(p.fechaNacimiento + 'T00:00:00');
    return !isNaN(nac.getTime()) && nac.getMonth() === mesActual;
  });

  return (
    <div style={S.wrap}>
      <h2 style={S.titulo}>Dashboard</h2>

      {/* Alerta de acciones vencidas */}
      {vencidas > 0 && (
        <div style={S.alerta}>
          <span>⚠️</span>
          <span><strong>{vencidas}</strong> acción{vencidas !== 1 ? 'es' : ''} vencida{vencidas !== 1 ? 's' : ''} — revisá el pipeline</span>
        </div>
      )}

      {/* Métricas principales */}
      <div style={S.grid4}>
        <Metrica label="Total cartera" valor={total} sub="prospectos cargados" />
        <Metrica label="Clientes cerrados" valor={cerrados.length} sub={`${fmtPct(tasaConversion)} conversión`} color="#2D5016" />
        <Metrica label="Prima mensual total" valor={fmtUSD(primaMensualTotal)} sub={`${cerradosConCierre.length} clientes con cierre`} color={T.sage} />
        <Metrica label="Prima anualizada total" valor={fmtUSD(primaAnualTotal)} sub="cartera activa" color={T.dorado} />
      </div>

      {/* Progreso meta MDRT */}
      <div style={S.cardWide}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Progreso hacia meta anual</div>
            <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, color: T.tinta }}>
              {fmtUSD(primaAnualTotal)} <span style={{ fontSize: 14, color: T.tinta40, fontWeight: 400 }}>de {fmtUSD(META_ANUAL_USD)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: T.tinta40, marginBottom: 4 }}>Meta mensual: {fmtUSD(META_MENSUAL_USD)}/mes</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 700, color: pctMetaAnual >= 100 ? '#2D5016' : T.dorado }}>
              {fmtPct(pctMetaAnual)}
            </div>
          </div>
        </div>
        <div style={{ height: 12, background: T.papel2, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6,
            background: pctMetaAnual >= 100 ? '#2D5016' : pctMetaAnual >= 50 ? T.sage : T.dorado,
            width: `${pctMetaAnual}%`,
            transition: 'width 0.5s',
          }} />
        </div>
        {primaAnualTotal < META_ANUAL_USD && (
          <div style={{ fontSize: 12, color: T.tinta40, marginTop: 8 }}>
            Faltan {fmtUSD(META_ANUAL_USD - primaAnualTotal)} para llegar a la meta anual
          </div>
        )}
      </div>

      {/* Promedios */}
      <div style={S.grid4}>
        <Metrica label="Prima mensual promedio" valor={fmtUSD(primaMensualPromedio)} sub="por cliente cerrado" />
        <Metrica label="Prima anual promedio" valor={fmtUSD(primaAnualPromedio)} sub="por cliente cerrado" color={T.dorado} />
        <Metrica label="Con cierre cargado" valor={cerradosConCierre.length} sub={`de ${cerrados.length} cerrados`} color={cerradosConCierre.length === cerrados.length ? T.sage : T.terracota} />
        <Metrica label="Conversión" valor={fmtPct(tasaConversion)} sub="alpha → cerrado" />
      </div>

      <div style={S.grid2}>
        {/* Pipeline por etapa */}
        <div style={S.card}>
          <h3 style={S.cardTitulo}>Pipeline por etapa</h3>
          {porEtapa.map((e) => (
            <div key={e.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, color: ETAPA_COLOR[e.id] || T.tinta, fontWeight: 600 }}>{e.label}</span>
                <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{e.count}</span>
              </div>
              <div style={{ height: 7, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: ETAPA_COLOR[e.id] || T.tinta, width: total > 0 ? `${(e.count / total) * 100}%` : '0%', transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Clientes cerrados con detalle */}
        <div style={S.card}>
          <h3 style={S.cardTitulo}>Clientes cerrados</h3>
          {cerrados.length === 0 && <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Sin cierres todavía.</p>}
          {cerrados.map((p) => {
            const primaM = p.cierre?.primaMensualUSD ? Number(p.cierre.primaMensualUSD) : null;
            const primaA = primaM ? primaM * 12 : null;
            return (
              <div key={p.id} style={{ padding: '10px 0', borderBottom: `1px solid ${T.borde}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</span>
                  {primaA && <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#2D5016', fontWeight: 600 }}>{fmtUSD(primaA)}/año</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: T.tinta40 }}>
                  {primaM && <span>{fmtUSD(primaM)}/mes</span>}
                  {p.cierre?.sumaAseguradaUSD && <span>SA: {fmtUSD(Number(p.cierre.sumaAseguradaUSD))}</span>}
                  {p.cierre?.compania && <span>{p.cierre.compania}</span>}
                  {!primaM && <span style={{ color: T.terracota }}>⚠ Sin datos de cierre</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fuentes */}
        <div style={S.card}>
          <h3 style={S.cardTitulo}>Fuente de prospectos</h3>
          {fuentes.map(([fuente, count]) => (
            <div key={fuente} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>{fuente}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, height: 7, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: T.dorado, borderRadius: 4, width: `${(count / total) * 100}%` }} />
                </div>
                <span style={{ fontSize: 12, color: T.tinta60, minWidth: 24, textAlign: 'right' }}>{count}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Cumpleaños este mes */}
        <div style={S.card}>
          <h3 style={S.cardTitulo}>Cumpleaños este mes 🎂</h3>
          {cumpleMes.length === 0 && <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Ninguno este mes.</p>}
          {[...cumpleMes].sort((a, b) => new Date(a.fechaNacimiento).getDate() - new Date(b.fechaNacimiento).getDate()).map((p) => {
            const nac = new Date(p.fechaNacimiento + 'T00:00:00');
            const edad = new Date().getFullYear() - nac.getFullYear();
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                <span style={{ color: T.tinta60 }}>{nac.getDate()}/{nac.getMonth() + 1} — {edad} años</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metrica({ label, valor, sub, color }) {
  return (
    <div style={S.metricaCard}>
      <div style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: color || T.tinta, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.tinta40, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const S = {
  wrap: { padding: '32px 32px 60px', maxWidth: 1100, margin: '0 auto' },
  titulo: { fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, margin: '0 0 20px', color: '#1A2E29' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  metricaCard: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 12, padding: '18px 20px' },
  card: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 12, padding: '20px 22px', marginBottom: 16 },
  cardWide: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  cardTitulo: { fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#1A2E29' },
  alerta: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(181,72,61,0.08)', border: '1px solid rgba(181,72,61,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13.5, color: '#B5483D' },
};
