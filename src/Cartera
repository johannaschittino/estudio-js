import React, { useState, useMemo } from 'react';
import { T } from './tokens.js';

const fmtUSD = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};
const fmtARS = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
};
const fmtMoneda = (n, moneda) => (moneda === 'ARS' ? fmtARS(n) : fmtUSD(n));

const ESTADOS_FILTRO = ['Todas', 'Vigente', 'Cancelada', 'Lapseada', 'Rescatada', 'Suspendida', 'Vencida'];

export default function Cartera({ prospectos = [] }) {
  const [filtroEstado, setFiltroEstado] = useState('Todas');
  const [moneda, setMoneda] = useState('USD'); // moneda de referencia para totales mezclados

  // Aplanar todas las pólizas con referencia al prospecto dueño
  const todasPolizas = useMemo(() => {
    const lista = [];
    prospectos.forEach((p) => {
      (p.polizasCartera || []).forEach((pol) => {
        lista.push({ ...pol, prospectoId: p.id, prospectoNombre: p.nombre });
      });
    });
    return lista;
  }, [prospectos]);

  const polizasFiltradas = useMemo(() => {
    if (filtroEstado === 'Todas') return todasPolizas;
    return todasPolizas.filter((pol) => (pol.estado || '').toLowerCase() === filtroEstado.toLowerCase());
  }, [todasPolizas, filtroEstado]);

  // Conteos por estado (sobre el total, no sobre el filtro — para mostrar siempre todos los conteos)
  const conteosPorEstado = useMemo(() => {
    const c = {};
    ESTADOS_FILTRO.slice(1).forEach((e) => { c[e] = 0; });
    todasPolizas.forEach((pol) => {
      const e = ESTADOS_FILTRO.slice(1).find((opt) => opt.toLowerCase() === (pol.estado || '').toLowerCase());
      if (e) c[e]++;
    });
    return c;
  }, [todasPolizas]);

  // Suma asegurada total — convertida a moneda de referencia con tipo de cambio simple si hace falta
  // Nota: sin TC dinámico acá, se suman por separado USD y ARS para no mezclar de forma incorrecta
  const sumaAseguradaUSD = polizasFiltradas.filter((p) => p.moneda === 'USD').reduce((s, p) => s + (Number(p.sumaAseg) || 0), 0);
  const sumaAseguradaARS = polizasFiltradas.filter((p) => p.moneda === 'ARS').reduce((s, p) => s + (Number(p.sumaAseg) || 0), 0);

  const primaAnualUSD = polizasFiltradas.filter((p) => p.moneda === 'USD').reduce((s, p) => s + (Number(p.primaAnual) || 0), 0);
  const primaAnualARS = polizasFiltradas.filter((p) => p.moneda === 'ARS').reduce((s, p) => s + (Number(p.primaAnual) || 0), 0);

  const cantPolizas = polizasFiltradas.length;
  const primaPromedioAnualUSD = cantPolizas > 0 ? primaAnualUSD / polizasFiltradas.filter((p) => p.moneda === 'USD').length || 0 : 0;
  const primaPromedioAnualARS = cantPolizas > 0 ? primaAnualARS / polizasFiltradas.filter((p) => p.moneda === 'ARS').length || 0 : 0;

  const cantUSD = polizasFiltradas.filter((p) => p.moneda === 'USD').length;
  const cantARS = polizasFiltradas.filter((p) => p.moneda === 'ARS').length;

  const promUSD = cantUSD > 0 ? primaAnualUSD / cantUSD : 0;
  const promARS = cantARS > 0 ? primaAnualARS / cantARS : 0;
  const promMensualUSD = promUSD / 12;
  const promMensualARS = promARS / 12;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px 60px' }}>
      <h2 style={{ fontFamily: T.serif, fontSize: 22, margin: '0 0 4px' }}>Cartera</h2>
      <p style={{ fontSize: 13, color: T.tinta40, margin: '0 0 24px' }}>Análisis de sumas aseguradas y primas sobre las pólizas importadas de Life Seguros.</p>

      {/* Filtro de estado */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {ESTADOS_FILTRO.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${filtroEstado === e ? T.tinta : T.borde}`,
              background: filtroEstado === e ? T.tinta : '#fff',
              color: filtroEstado === e ? '#fff' : T.tinta60,
              cursor: 'pointer',
            }}
          >
            {e}
            {e !== 'Todas' && conteosPorEstado[e] > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{conteosPorEstado[e]}</span>
            )}
            {e === 'Todas' && <span style={{ marginLeft: 6, opacity: 0.7 }}>{todasPolizas.length}</span>}
          </button>
        ))}
      </div>

      {/* Métricas principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <CardMetrica label="Cantidad de pólizas" valor={cantPolizas} sub={filtroEstado} />
        <CardMetrica label="Suma asegurada (USD)" valor={fmtUSD(sumaAseguradaUSD)} sub={`${cantUSD} pólizas`} />
        <CardMetrica label="Suma asegurada (ARS)" valor={fmtARS(sumaAseguradaARS)} sub={`${cantARS} pólizas`} />
        <CardMetrica label="Clientes en cartera" valor={new Set(polizasFiltradas.map((p) => p.prospectoId)).size} sub="con al menos 1 póliza" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        <CardMetrica label="Prima anual total (USD)" valor={fmtUSD(primaAnualUSD)} sub={`${cantUSD} pólizas`} />
        <CardMetrica label="Prima anual total (ARS)" valor={fmtARS(primaAnualARS)} sub={`${cantARS} pólizas`} />
        <CardMetrica label="Prima anual prom. (USD)" valor={fmtUSD(promUSD)} sub="por póliza" />
        <CardMetrica label="Prima anual prom. (ARS)" valor={fmtARS(promARS)} sub="por póliza" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
        <CardMetrica label="Prima mensual prom. (USD)" valor={fmtUSD(promMensualUSD)} sub="por póliza" color={T.sage} />
        <CardMetrica label="Prima mensual prom. (ARS)" valor={fmtARS(promMensualARS)} sub="por póliza" color={T.sage} />
      </div>

      {/* Tabla de pólizas */}
      <h3 style={{ fontFamily: T.serif, fontSize: 16, margin: '0 0 12px' }}>
        Pólizas {filtroEstado !== 'Todas' ? `· ${filtroEstado}` : ''} ({polizasFiltradas.length})
      </h3>
      <div style={{ background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: T.papel2, textAlign: 'left' }}>
              <th style={th}>Cliente</th>
              <th style={th}>Nro póliza</th>
              <th style={th}>Plan</th>
              <th style={th}>Estado</th>
              <th style={th}>SA</th>
              <th style={th}>Prima anual</th>
              <th style={th}>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {polizasFiltradas.map((pol) => {
              const color = (pol.estado || '').toLowerCase().includes('vigente') ? T.sage
                : (pol.estado || '').toLowerCase().includes('cancelad') ? T.terracota
                : (pol.estado || '').toLowerCase().includes('lapsead') ? T.dorado
                : T.tinta40;
              return (
                <tr key={`${pol.prospectoId}-${pol.id || pol.nroPoliza}`} style={{ borderTop: `1px solid ${T.borde}` }}>
                  <td style={td}>{pol.prospectoNombre}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>#{pol.nroPoliza}</td>
                  <td style={td}>{pol.descripcionPlan}</td>
                  <td style={td}><span style={{ color, fontWeight: 600 }}>{pol.estado}</span></td>
                  <td style={td}>{fmtMoneda(pol.sumaAseg, pol.moneda)}</td>
                  <td style={td}>{fmtMoneda(pol.primaAnual, pol.moneda)}</td>
                  <td style={td}>{pol.fechaVigencia || '—'}</td>
                </tr>
              );
            })}
            {polizasFiltradas.length === 0 && (
              <tr><td style={{ ...td, textAlign: 'center', color: T.tinta40 }} colSpan={7}>No hay pólizas con este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardMetrica({ label, valor, sub, color }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 10.5, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: color || T.tinta }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: T.tinta40, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const th = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#6B6660', textTransform: 'uppercase', letterSpacing: 0.3 };
const td = { padding: '10px 14px', color: '#1A2E29' };
