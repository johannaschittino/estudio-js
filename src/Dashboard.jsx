import React from 'react';
import { T } from './tokens.js';
import { ETAPAS } from './data.js';

const ETAPA_COLOR = {
  alpha: T.dorado, entrevistado: '#5B8FA8', propuesta: T.sage,
  cerrado: '#2D5016', en_pausa: T.tinta40, cancelado: T.terracota,
};

function fmtUSD(n) {
  if (!n) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n) + '%';
}

export default function Dashboard({ prospectos }) {
  const total = prospectos.length;

  // Por etapa
  const porEtapa = ETAPAS.map((e) => ({
    ...e,
    count: prospectos.filter((p) => p.estado === e.id).length,
  }));

  // Conversión Alpha → Cerrado
  const alpha = prospectos.filter((p) => p.estado === 'alpha' || p.estado === 'entrevistado' || p.estado === 'propuesta' || p.estado === 'cerrado').length;
  const cerrados = prospectos.filter((p) => p.estado === 'cerrado').length;
  const tasaConversion = alpha > 0 ? (cerrados / alpha) * 100 : 0;

  // Prima promedio (solo cerrados con cotizaciones)
  const cerradosConPrima = prospectos.filter((p) => p.estado === 'cerrado' && (p.cotizaciones || []).length > 0);
  const primaTotalCerrados = cerradosConPrima.reduce((acc, p) => {
    return acc + (p.cotizaciones || []).reduce((s, c) => s + (c.primaMensualUSD || 0), 0);
  }, 0);
  const primaPromedio = cerradosConPrima.length > 0 ? primaTotalCerrados / cerradosConPrima.length : null;

  // Acciones vencidas
  const hoy = new Date().toISOString().slice(0, 10);
  const vencidas = prospectos.filter((p) => p.fechaAccion && p.fechaAccion < hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado').length;

  // Fuentes
  const fuenteMap = {};
  prospectos.forEach((p) => {
    const f = p.fuente || 'Sin definir';
    fuenteMap[f] = (fuenteMap[f] || 0) + 1;
  });
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

      {/* Métricas principales */}
      <div style={S.grid4}>
        <Metrica label="Total cartera" valor={total} sub="prospectos" />
        <Metrica label="Cerrados" valor={cerrados} sub={`de ${alpha} en pipeline activo`} color={T.sage} />
        <Metrica label="Conversión" valor={fmtPct(tasaConversion)} sub="alpha → cerrado" color={tasaConversion >= 20 ? T.sage : T.dorado} />
        <Metrica label="Prima promedio" valor={fmtUSD(primaPromedio)} sub="clientes cerrados" color={T.dorado} />
      </div>

      {/* Alerta de acciones vencidas */}
      {vencidas > 0 && (
        <div style={S.alerta}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span><strong>{vencidas}</strong> acción{vencidas !== 1 ? 'es' : ''} vencida{vencidas !== 1 ? 's' : ''} — revisá el pipeline</span>
        </div>
      )}

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
                <div style={{
                  height: '100%',
                  borderRadius: 4,
                  background: ETAPA_COLOR[e.id] || T.tinta,
                  width: total > 0 ? `${(e.count / total) * 100}%` : '0%',
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Fuentes de prospectos */}
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
          {cumpleMes.sort((a, b) => {
            const da = new Date(a.fechaNacimiento).getDate();
            const db = new Date(b.fechaNacimiento).getDate();
            return da - db;
          }).map((p) => {
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

        {/* Últimos agregados */}
        <div style={S.card}>
          <h3 style={S.cardTitulo}>Últimos prospectos</h3>
          {[...prospectos]
            .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
            .slice(0, 6)
            .map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{p.nombre || 'Sin nombre'}</span>
                <span style={{ fontSize: 11, color: ETAPA_COLOR[p.estado] || T.tinta40, fontWeight: 600 }}>
                  {ETAPAS.find((e) => e.id === p.estado)?.label || p.estado}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function Metrica({ label, valor, sub, color }) {
  return (
    <div style={S.metricaCard}>
      <div style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: color || T.tinta, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.tinta40, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const S = {
  wrap: { padding: '32px 32px 60px', maxWidth: 1100, margin: '0 auto', overflowY: 'auto' },
  titulo: { fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, margin: '0 0 24px', color: '#1A2E29' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 },
  metricaCard: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 12, padding: '20px 22px' },
  card: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 12, padding: '20px 22px' },
  cardTitulo: { fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, margin: '0 0 16px', color: '#1A2E29' },
  alerta: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(181,72,61,0.08)', border: '1px solid rgba(181,72,61,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: '#B5483D' },
};
