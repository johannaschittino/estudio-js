import React, { useState } from 'react';
import { T } from './tokens.js';
import { ETAPAS } from './data.js';

const ETAPA_COLOR = {
  sin_contactar: '#8B9E8B', contactado: '#C9A24B', entrevistado: '#5B8FA8',
  propuesta: T.sage, cerrado: '#2D5016', en_pausa: T.tinta40, cancelado: T.terracota,
};

const META_MENSUAL_USD = 4000;
const META_ANUAL_USD = META_MENSUAL_USD * 12;

function fmtUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n) + '%';
}

// Detectar tipo de producto desde descripción del plan
function detectarTipoProducto(descripcion) {
  const d = (descripcion || '').toLowerCase();
  if (d.includes('retiro') || d.includes('family future')) return 'retiro';
  if (d.includes('salud') || d.includes('health')) return 'salud';
  return 'vida';
}

// Obtener mes actual como "YYYY-MM"
function mesActualKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function mesLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${meses[parseInt(m) - 1]} ${y}`;
}

// Storage para incentivos y objetivos mensuales (localStorage)
function cargarIncentivos() {
  try { return JSON.parse(localStorage.getItem('estudio_incentivos') || '[]'); } catch { return []; }
}
function guardarIncentivos(data) {
  localStorage.setItem('estudio_incentivos', JSON.stringify(data));
}
function cargarObjetivosMes(mesKey) {
  try { return JSON.parse(localStorage.getItem(`estudio_obj_${mesKey}`) || 'null') || { prima: '', polizasVida: '', endosos: '', retiro: '', salud: '', clientesNuevos: '' }; } catch { return { prima: '', polizasVida: '', endosos: '', retiro: '', salud: '', clientesNuevos: '' }; }
}
function guardarObjetivosMes(mesKey, data) {
  localStorage.setItem(`estudio_obj_${mesKey}`, JSON.stringify(data));
}

export default function Dashboard({ prospectos }) {
  const [tabDash, setTabDash] = useState('anual'); // anual | mensual | incentivos
  const [incentivos, setIncentivos] = useState(cargarIncentivos);
  const [editIncentivo, setEditIncentivo] = useState(null);
  const mesKey = mesActualKey();
  const [objMes, setObjMes] = useState(() => cargarObjetivosMes(mesKey));

  const guardarObjMes = (newObj) => {
    setObjMes(newObj);
    guardarObjetivosMes(mesKey, newObj);
  };

  const total = prospectos.length;
  const cerrados = prospectos.filter((p) => p.estado === 'cerrado');
  const cerradosConCierre = cerrados.filter((p) => p.cierre?.primaMensualUSD && Number(p.cierre.primaMensualUSD) > 0);

  // Métricas anuales
  const primaAnualTotal = cerradosConCierre.reduce((acc, p) => acc + Number(p.cierre.primaMensualUSD) * 12, 0);
  const primaMensualTotal = cerradosConCierre.reduce((acc, p) => acc + Number(p.cierre.primaMensualUSD), 0);
  const primaAnualPromedio = cerradosConCierre.length > 0 ? primaAnualTotal / cerradosConCierre.length : null;
  const pctMetaAnual = META_ANUAL_USD > 0 ? Math.min(100, (primaAnualTotal / META_ANUAL_USD) * 100) : 0;

  // Métricas por tipo de producto (cierres)
  const polizasVida = cerrados.filter(p => p.cierre?.tipoOperacion !== 'endoso' && detectarTipoProducto(p.cierre?.descripcionPlan || '') === 'vida').length;
  const polizasRetiro = cerrados.filter(p => detectarTipoProducto(p.cierre?.descripcionPlan || '') === 'retiro').length;
  const polizasSalud = cerrados.filter(p => detectarTipoProducto(p.cierre?.descripcionPlan || '') === 'salud').length;
  const endosos = cerrados.filter(p => p.cierre?.tipoOperacion === 'endoso').length;
  const clientesNuevos = cerrados.filter(p => p.cierre?.clienteNuevo).length;

  // Cierres del mes actual
  const cerradosMes = cerrados.filter(p => {
    const fecha = p.cierre?.fechaEmision || p.actualizadoEn || '';
    return fecha.startsWith(mesKey);
  });
  const primaAnualMes = cerradosMes.filter(p => p.cierre?.primaMensualUSD).reduce((acc, p) => acc + Number(p.cierre.primaMensualUSD) * 12, 0);

  const hoy = new Date().toISOString().slice(0, 10);
  const vencidas = prospectos.filter((p) => p.fechaAccion && p.fechaAccion < hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado').length;

  const porEtapa = ETAPAS.map((e) => ({ ...e, count: prospectos.filter((p) => p.estado === e.id).length }));
  const enPipeline = prospectos.filter(p => ['sin_contactar','contactado','entrevistado','propuesta','cerrado'].includes(p.estado)).length;
  const tasaConversion = enPipeline > 0 ? (cerrados.length / enPipeline) * 100 : 0;

  const fuenteMap = {};
  prospectos.forEach(p => { const f = p.fuente || 'Sin definir'; fuenteMap[f] = (fuenteMap[f] || 0) + 1; });
  const fuentes = Object.entries(fuenteMap).sort((a, b) => b[1] - a[1]);

  const mesActualNum = new Date().getMonth();
  const cumpleMes = prospectos.filter(p => {
    if (!p.fechaNacimiento) return false;
    const nac = new Date(p.fechaNacimiento + 'T00:00:00');
    return !isNaN(nac.getTime()) && nac.getMonth() === mesActualNum;
  });

  // Incentivos — guardar cambios
  const guardarCambioIncentivo = (inc) => {
    const nuevos = editIncentivo?.id
      ? incentivos.map(i => i.id === inc.id ? inc : i)
      : [...incentivos, inc];
    setIncentivos(nuevos);
    guardarIncentivos(nuevos);
    setEditIncentivo(null);
  };
  const eliminarIncentivo = (id) => {
    const nuevos = incentivos.filter(i => i.id !== id);
    setIncentivos(nuevos);
    guardarIncentivos(nuevos);
  };

  return (
    <div style={S.wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={S.titulo}>Dashboard</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {['anual', 'mensual', 'incentivos'].map(t => (
            <button key={t} onClick={() => setTabDash(t)} style={{ ...S.navBtn, ...(tabDash === t ? S.navBtnActivo : {}) }}>
              {t === 'anual' ? 'Anual' : t === 'mensual' ? `Mensual · ${mesLabel(mesKey)}` : 'CAV e Incentivos'}
            </button>
          ))}
        </div>
      </div>

      {vencidas > 0 && <div style={S.alerta}><span>⚠️</span><span><strong>{vencidas}</strong> acción{vencidas !== 1 ? 'es' : ''} vencida{vencidas !== 1 ? 's' : ''}</span></div>}

      {/* ===== ANUAL ===== */}
      {tabDash === 'anual' && (
        <>
          <div style={S.grid4}>
            <Metrica label="Total cartera" valor={total} sub="prospectos cargados" />
            <Metrica label="Cerrados" valor={cerrados.length} sub={`${fmtPct(tasaConversion)} conversión`} color="#2D5016" />
            <Metrica label="Prima mensual total" valor={fmtUSD(primaMensualTotal)} sub="cartera activa" color={T.sage} />
            <Metrica label="Prima anualizada total" valor={fmtUSD(primaAnualTotal)} sub="objetivo anual" color={T.dorado} />
          </div>

          <div style={S.cardWide}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Progreso meta anual · {fmtUSD(META_ANUAL_USD)}</div>
                <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700 }}>{fmtUSD(primaAnualTotal)}</div>
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 700, color: pctMetaAnual >= 100 ? '#2D5016' : T.dorado }}>{fmtPct(pctMetaAnual)}</div>
            </div>
            <div style={{ height: 10, background: T.papel2, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 6, background: pctMetaAnual >= 100 ? '#2D5016' : pctMetaAnual >= 50 ? T.sage : T.dorado, width: `${pctMetaAnual}%`, transition: 'width 0.5s' }} />
            </div>
            {primaAnualTotal < META_ANUAL_USD && <div style={{ fontSize: 12, color: T.tinta40, marginTop: 6 }}>Faltan {fmtUSD(META_ANUAL_USD - primaAnualTotal)} para la meta anual</div>}
          </div>

          <div style={S.grid4}>
            <Metrica label="Prima anual promedio" valor={fmtUSD(primaAnualPromedio)} sub="por cliente cerrado" color={T.dorado} />
            <Metrica label="Pólizas de vida" valor={polizasVida} />
            <Metrica label="Endosos" valor={endosos} />
            <Metrica label="Retiro" valor={polizasRetiro} />
          </div>
          <div style={S.grid4}>
            <Metrica label="Salud" valor={polizasSalud} />
            <Metrica label="Clientes nuevos" valor={clientesNuevos} />
            <Metrica label="Con cierre cargado" valor={cerradosConCierre.length} sub={`de ${cerrados.length} cerrados`} color={cerradosConCierre.length === cerrados.length ? T.sage : T.terracota} />
            <Metrica label="Conversión" valor={fmtPct(tasaConversion)} sub="total pipeline" />
          </div>

          <div style={S.grid2}>
            <div style={S.card}>
              <h3 style={S.cardTitulo}>Pipeline por etapa</h3>
              {porEtapa.map(e => (
                <div key={e.id} style={{ marginBottom: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: ETAPA_COLOR[e.id] || T.tinta, fontWeight: 600 }}>{e.label}</span>
                    <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{e.count}</span>
                  </div>
                  <div style={{ height: 6, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: ETAPA_COLOR[e.id] || T.tinta, width: total > 0 ? `${(e.count / total) * 100}%` : '0%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <h3 style={S.cardTitulo}>Clientes cerrados</h3>
              {cerrados.length === 0 && <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Sin cierres todavía.</p>}
              {cerrados.map(p => {
                const primaM = p.cierre?.primaMensualUSD ? Number(p.cierre.primaMensualUSD) : null;
                const primaA = primaM ? primaM * 12 : null;
                const esEndoso = p.cierre?.tipoOperacion === 'endoso';
                return (
                  <div key={p.id} style={{ padding: '9px 0', borderBottom: `1px solid ${T.borde}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</span>
                      {primaA && <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#2D5016', fontWeight: 600 }}>{fmtUSD(primaA)}/año</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: T.tinta40, flexWrap: 'wrap' }}>
                      {primaM && <span>{fmtUSD(primaM)}/mes</span>}
                      {esEndoso && <span style={{ color: T.dorado }}>endoso</span>}
                      {p.cierre?.clienteNuevo && <span style={{ color: T.sage }}>cliente nuevo</span>}
                      {!primaM && <span style={{ color: T.terracota }}>⚠ Sin datos</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={S.card}>
              <h3 style={S.cardTitulo}>Fuentes</h3>
              {fuentes.map(([fuente, count]) => (
                <div key={fuente} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                  <span style={{ fontSize: 13 }}>{fuente}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 70, height: 6, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: T.dorado, borderRadius: 4, width: `${(count / total) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 12, color: T.tinta60, minWidth: 20 }}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <h3 style={S.cardTitulo}>Cumpleaños este mes 🎂</h3>
              {cumpleMes.length === 0 && <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Ninguno.</p>}
              {[...cumpleMes].sort((a, b) => new Date(a.fechaNacimiento).getDate() - new Date(b.fechaNacimiento).getDate()).map(p => {
                const nac = new Date(p.fechaNacimiento + 'T00:00:00');
                const edad = new Date().getFullYear() - nac.getFullYear();
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                    <span style={{ color: T.tinta60 }}>{nac.getDate()}/{nac.getMonth() + 1} · {edad} años</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ===== MENSUAL ===== */}
      {tabDash === 'mensual' && (
        <>
          <div style={S.cardWide}>
            <h3 style={S.cardTitulo}>Objetivos de {mesLabel(mesKey)}</h3>
            <div style={S.grid4}>
              <ObjCampo label="Prima anualizada (USD)" value={objMes.prima} onChange={v => guardarObjMes({ ...objMes, prima: v })} />
              <ObjCampo label="Pólizas de vida" value={objMes.polizasVida} onChange={v => guardarObjMes({ ...objMes, polizasVida: v })} />
              <ObjCampo label="Endosos" value={objMes.endosos} onChange={v => guardarObjMes({ ...objMes, endosos: v })} />
              <ObjCampo label="Retiro" value={objMes.retiro} onChange={v => guardarObjMes({ ...objMes, retiro: v })} />
              <ObjCampo label="Salud" value={objMes.salud} onChange={v => guardarObjMes({ ...objMes, salud: v })} />
              <ObjCampo label="Clientes nuevos" value={objMes.clientesNuevos} onChange={v => guardarObjMes({ ...objMes, clientesNuevos: v })} />
            </div>
          </div>

          <div style={S.cardWide}>
            <h3 style={S.cardTitulo}>Producción de {mesLabel(mesKey)}</h3>
            {cerradosMes.length === 0 ? (
              <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Sin cierres registrados este mes. Asegurate de completar la fecha de emisión en cada cierre.</p>
            ) : (
              <>
                <div style={S.grid4}>
                  <Metrica label="Prima anualizada" valor={fmtUSD(primaAnualMes)} sub={objMes.prima ? `meta: ${fmtUSD(Number(objMes.prima))}` : ''} color={objMes.prima && primaAnualMes >= Number(objMes.prima) ? '#2D5016' : T.dorado} />
                  <Metrica label="Cierres del mes" valor={cerradosMes.length} />
                  <Metrica label="Clientes nuevos" valor={cerradosMes.filter(p => p.cierre?.clienteNuevo).length} />
                  <Metrica label="Endosos" valor={cerradosMes.filter(p => p.cierre?.tipoOperacion === 'endoso').length} />
                </div>
                {objMes.prima && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ height: 8, background: T.papel2, borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 5, background: primaAnualMes >= Number(objMes.prima) ? '#2D5016' : T.dorado, width: `${Math.min(100, (primaAnualMes / Number(objMes.prima)) * 100)}%`, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: T.tinta40, marginTop: 4 }}>
                      {fmtPct((primaAnualMes / Number(objMes.prima)) * 100)} del objetivo mensual
                      {primaAnualMes < Number(objMes.prima) && ` · Faltan ${fmtUSD(Number(objMes.prima) - primaAnualMes)}`}
                    </div>
                  </div>
                )}
                {cerradosMes.map(p => {
                  const primaA = p.cierre?.primaMensualUSD ? Number(p.cierre.primaMensualUSD) * 12 : null;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${T.borde}`, fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                        <span style={{ fontSize: 11.5, color: T.tinta40, marginLeft: 8 }}>{p.cierre?.tipoOperacion === 'endoso' ? 'endoso' : 'póliza nueva'}{p.cierre?.clienteNuevo ? ' · cliente nuevo' : ''}</span>
                      </div>
                      <span style={{ fontFamily: 'monospace', color: '#2D5016', fontWeight: 600 }}>{primaA ? fmtUSD(primaA) + '/año' : '—'}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}

      {/* ===== INCENTIVOS ===== */}
      {tabDash === 'incentivos' && (
        <>
          {/* CAV fija */}
          <IncentivoBloqueCAV cerrados={cerrados} polizasVida={polizasVida} endosos={endosos} polizasRetiro={polizasRetiro} polizasSalud={polizasSalud} clientesNuevos={clientesNuevos} primaAnualTotal={primaAnualTotal} />

          {/* Incentivos adicionales */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 12px' }}>
            <h3 style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600, margin: 0 }}>Otros incentivos</h3>
            <button style={S.btnGhost} onClick={() => setEditIncentivo({ id: null, nombre: '', llaves: [] })}>+ Nuevo incentivo</button>
          </div>

          {incentivos.length === 0 && !editIncentivo && (
            <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>No hay incentivos activos. Agregá uno cuando haya un bono o concurso vigente.</p>
          )}

          {incentivos.map(inc => (
            <IncentivoBloqueCustom
              key={inc.id}
              incentivo={inc}
              cerrados={cerrados}
              polizasVida={polizasVida}
              endosos={endosos}
              polizasRetiro={polizasRetiro}
              polizasSalud={polizasSalud}
              clientesNuevos={clientesNuevos}
              primaAnualTotal={primaAnualTotal}
              onEditar={() => setEditIncentivo(inc)}
              onEliminar={() => eliminarIncentivo(inc.id)}
            />
          ))}

          {editIncentivo !== null && (
            <FormIncentivo
              incentivo={editIncentivo}
              onGuardar={guardarCambioIncentivo}
              onCancelar={() => setEditIncentivo(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   BLOQUE CAV
   ============================================================ */
const CAV_LLAVES_DEFAULT = [
  { id: 'prima', label: 'Prima anualizada (USD)', meta: '' },
  { id: 'vida', label: 'Pólizas de vida', meta: '' },
  { id: 'endosos', label: 'Endosos', meta: '' },
  { id: 'retiro', label: 'Planes de retiro', meta: '' },
  { id: 'salud', label: 'Seguros de salud', meta: '' },
  { id: 'clientes_nuevos', label: 'Clientes nuevos', meta: '' },
];

function cargarCAV() {
  try { return JSON.parse(localStorage.getItem('estudio_cav') || 'null') || { anio: new Date().getFullYear(), llaves: CAV_LLAVES_DEFAULT }; } catch { return { anio: new Date().getFullYear(), llaves: CAV_LLAVES_DEFAULT }; }
}
function guardarCAV(data) { localStorage.setItem('estudio_cav', JSON.stringify(data)); }

function IncentivoBloqueCAV({ cerrados, polizasVida, endosos, polizasRetiro, polizasSalud, clientesNuevos, primaAnualTotal }) {
  const [cav, setCAV] = useState(cargarCAV);
  const [editando, setEditando] = useState(false);

  const actuales = {
    prima: primaAnualTotal,
    vida: polizasVida,
    endosos,
    retiro: polizasRetiro,
    salud: polizasSalud,
    clientes_nuevos: clientesNuevos,
  };

  const fmtActual = (id) => {
    if (id === 'prima') return `$${Math.round(actuales[id]).toLocaleString('en-US')}`;
    return String(actuales[id] || 0);
  };

  return (
    <div style={{ ...S.card, border: '2px solid #C9A24B' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ ...S.cardTitulo, margin: 0, color: T.dorado }}>CAV {cav.anio} — Convención Anual de Ventas</h3>
          <div style={{ fontSize: 12, color: T.tinta40, marginTop: 2 }}>Llaves configurables · se actualiza con tus cierres</div>
        </div>
        <button style={S.btnMini} onClick={() => setEditando(!editando)}>{editando ? 'Cerrar' : 'Editar llaves'}</button>
      </div>

      {editando && (
        <div style={{ background: T.papel2, borderRadius: 8, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: T.tinta40, marginBottom: 10 }}>Cargá las metas de cada llave del CAV {cav.anio}</div>
          {cav.llaves.map((ll, i) => (
            <div key={ll.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 13, flex: 1 }}>{ll.label}</span>
              <input type="number" style={{ ...S.inputMini }} placeholder="Meta" value={ll.meta}
                onChange={e => {
                  const nuevas = cav.llaves.map((l, j) => j === i ? { ...l, meta: e.target.value } : l);
                  const nuevo = { ...cav, llaves: nuevas };
                  setCAV(nuevo); guardarCAV(nuevo);
                }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cav.llaves.map(ll => {
          const meta = Number(ll.meta) || 0;
          const actual = actuales[ll.id] || 0;
          const pct = meta > 0 ? Math.min(100, (actual / meta) * 100) : 0;
          const cumple = meta > 0 && actual >= meta;
          return (
            <div key={ll.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cumple && <span style={{ color: '#2D5016' }}>✓</span>}
                  {ll.label}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                  {fmtActual(ll.id)} {meta > 0 ? `/ ${ll.id === 'prima' ? '$' + Number(ll.meta).toLocaleString('en-US') : ll.meta}` : '(sin meta)'}
                </span>
              </div>
              {meta > 0 && (
                <div style={{ height: 6, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: cumple ? '#2D5016' : pct >= 50 ? T.dorado : T.terracota, width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncentivoBloqueCustom({ incentivo, cerrados, polizasVida, endosos, polizasRetiro, polizasSalud, clientesNuevos, primaAnualTotal, onEditar, onEliminar }) {
  const actuales = { prima: primaAnualTotal, vida: polizasVida, endosos, retiro: polizasRetiro, salud: polizasSalud, clientes_nuevos: clientesNuevos };
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ ...S.cardTitulo, margin: 0 }}>{incentivo.nombre}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnMini} onClick={onEditar}>Editar</button>
          <button style={{ ...S.btnMini, color: T.terracota, borderColor: T.terracota }} onClick={onEliminar}>Eliminar</button>
        </div>
      </div>
      {(incentivo.llaves || []).map(ll => {
        const meta = Number(ll.meta) || 0;
        const actual = actuales[ll.id] || 0;
        const pct = meta > 0 ? Math.min(100, (actual / meta) * 100) : 0;
        const cumple = meta > 0 && actual >= meta;
        return (
          <div key={ll.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
              <span>{cumple && '✓ '}{ll.label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12.5 }}>{actual} / {ll.meta || '—'}</span>
            </div>
            {meta > 0 && <div style={{ height: 6, background: T.papel2, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 4, background: cumple ? '#2D5016' : T.dorado, width: `${pct}%` }} /></div>}
          </div>
        );
      })}
    </div>
  );
}

function FormIncentivo({ incentivo, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(incentivo.nombre || '');
  const TIPOS_LLAVE = [
    { id: 'prima', label: 'Prima anualizada (USD)' },
    { id: 'vida', label: 'Pólizas de vida' },
    { id: 'endosos', label: 'Endosos' },
    { id: 'retiro', label: 'Planes de retiro' },
    { id: 'salud', label: 'Seguros de salud' },
    { id: 'clientes_nuevos', label: 'Clientes nuevos' },
  ];
  const [llaves, setLlaves] = useState(incentivo.llaves || []);
  const agregarLlave = () => setLlaves([...llaves, { id: 'vida', label: 'Pólizas de vida', meta: '' }]);
  const setLlave = (i, field, val) => setLlaves(llaves.map((l, j) => j === i ? { ...l, [field]: val, label: field === 'id' ? TIPOS_LLAVE.find(t => t.id === val)?.label || val : l.label } : l));
  const quitarLlave = (i) => setLlaves(llaves.filter((_, j) => j !== i));
  return (
    <div style={{ ...S.card, border: `1px solid ${T.dorado}`, marginTop: 14 }}>
      <h3 style={{ ...S.cardTitulo, marginBottom: 12 }}>{incentivo.id ? 'Editar incentivo' : 'Nuevo incentivo'}</h3>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 4 }}>Nombre del incentivo</label>
        <input style={{ ...S.inputBase, width: '100%' }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Bono Q3 2025" />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.3 }}>Llaves</label>
          <button style={S.btnMini} onClick={agregarLlave}>+ Agregar llave</button>
        </div>
        {llaves.map((ll, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select style={{ ...S.inputBase, flex: 2 }} value={ll.id} onChange={e => setLlave(i, 'id', e.target.value)}>
              {TIPOS_LLAVE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <input type="number" style={{ ...S.inputBase, flex: 1 }} placeholder="Meta" value={ll.meta} onChange={e => setLlave(i, 'meta', e.target.value)} />
            <button style={{ ...S.btnMini, color: T.terracota }} onClick={() => quitarLlave(i)}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={S.btnPrimary} onClick={() => onGuardar({ id: incentivo.id || Date.now().toString(), nombre, llaves })}>Guardar</button>
        <button style={S.btnGhost} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Metrica({ label, valor, sub, color }) {
  return (
    <div style={S.metricaCard}>
      <div style={{ fontSize: 10.5, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, color: color || T.tinta, lineHeight: 1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: T.tinta40, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ObjCampo({ label, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 5 }}>{label}</label>
      <input type="number" style={S.inputBase} value={value} onChange={e => onChange(e.target.value)} placeholder="—" />
    </div>
  );
}

const S = {
  wrap: { padding: '28px 28px 60px', maxWidth: 1100, margin: '0 auto' },
  titulo: { fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700, margin: 0, color: '#1A2E29' },
  navBtn: { background: 'none', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: T.tinta60 },
  navBtnActivo: { background: T.papel2, color: T.tinta, fontWeight: 600 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 },
  metricaCard: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 11, padding: '16px 18px' },
  card: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 11, padding: '18px 20px', marginBottom: 14 },
  cardWide: { background: '#fff', border: '1px solid #E8E4D9', borderRadius: 11, padding: '18px 22px', marginBottom: 14 },
  cardTitulo: { fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 600, margin: '0 0 14px', color: '#1A2E29' },
  alerta: { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(181,72,61,0.08)', border: '1px solid rgba(181,72,61,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: '#B5483D' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: T.tinta, border: `1px solid ${T.borde}`, borderRadius: 7, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: T.tinta, color: T.papel, border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnMini: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: T.tinta },
  inputBase: { border: `1px solid ${T.borde}`, borderRadius: 7, padding: '7px 10px', fontSize: 13, background: '#fff', color: T.tinta, width: '100%', boxSizing: 'border-box' },
  inputMini: { border: `1px solid ${T.borde}`, borderRadius: 6, padding: '5px 8px', fontSize: 12.5, background: '#fff', width: 100 },
};
