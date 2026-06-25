import React, { useState } from 'react';
import { T } from './tokens.js';
import { ETAPAS, FUENTES, uid, todayISO, nuevoProspecto, nuevaOperacionCierre } from './data.js';

const ETAPA_COLOR = {
  alpha: T.dorado, entrevistado: '#5B8FA8', propuesta: T.sage,
  cerrado: '#2D5016', en_pausa: T.tinta40, cancelado: T.terracota,
};

const Icon = ({ name, size = 16 }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z',
    back: 'M19 12H5M12 19l-7-7 7-7',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    check: 'M20 6 9 17l-5-5',
    phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l1.87-1.87a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z',
    mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
    alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    userplus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ''} />
    </svg>
  );
};

const TIPOS_CONTACTO = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'nota', label: 'Nota interna' },
];

export default function FichaProspecto({ prospecto: p, onUpdate, onVolver, onIrAnalisis, onCrearDesde, prospectos = [] }) {
  const [tab, setTab] = useState('seguimiento');
  const [nuevoContacto, setNuevoContacto] = useState({ tipo: 'llamada', texto: '', fecha: todayISO() });
  const [mostrarFormContacto, setMostrarFormContacto] = useState(false);

  const set = (field, value) => onUpdate({ [field]: value });

  const agregarContacto = () => {
    if (!nuevoContacto.texto.trim()) return;
    const historial = [...(p.historial || []), { id: uid(), ...nuevoContacto }];
    onUpdate({ historial });
    setNuevoContacto({ tipo: 'llamada', texto: '', fecha: todayISO() });
    setMostrarFormContacto(false);
  };

  const eliminarContacto = (id) => {
    onUpdate({ historial: (p.historial || []).filter((h) => h.id !== id) });
  };

  const etapaActual = ETAPAS.find((e) => e.id === p.estado);

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.fichaHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onVolver} style={S.backBtn}><Icon name="back" size={17} /></button>
          <div>
            <input
              style={S.nombreInput}
              value={p.nombre || ''}
              placeholder="Nombre del prospecto"
              onChange={(e) => set('nombre', e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <input
                style={S.rolInput}
                value={p.rol || ''}
                placeholder="Rol / empresa"
                onChange={(e) => set('rol', e.target.value)}
              />
              <select
                style={S.fuenteSelect}
                value={p.fuente || 'LinkedIn'}
                onChange={(e) => set('fuente', e.target.value)}
              >
                {FUENTES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            style={{ ...S.etapaSelect, borderColor: ETAPA_COLOR[p.estado] || T.borde, color: ETAPA_COLOR[p.estado] }}
            value={p.estado || 'alpha'}
            onChange={(e) => set('estado', e.target.value)}
          >
            {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          <button style={S.btnPrimary} onClick={onIrAnalisis}>
            <Icon name="target" size={15} /> Ver análisis
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[
          { id: 'seguimiento', label: 'Seguimiento', icono: 'clock' },
          { id: 'datos', label: 'Datos', icono: 'user' },
        ].map((t) => (
          <button
            key={t.id}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActivo : {}) }}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icono} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={S.contenido}>
        {tab === 'seguimiento' && (
          <TabSeguimiento
            p={p}
            set={set}
            nuevoContacto={nuevoContacto}
            setNuevoContacto={setNuevoContacto}
            mostrarFormContacto={mostrarFormContacto}
            setMostrarFormContacto={setMostrarFormContacto}
            agregarContacto={agregarContacto}
            eliminarContacto={eliminarContacto}
          />
        )}
        {tab === 'datos' && (
          <TabDatos p={p} onUpdate={onUpdate} onCrearDesde={onCrearDesde} prospectos={prospectos} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TAB: SEGUIMIENTO
   ============================================================ */

function TabSeguimiento({ p, set, nuevoContacto, setNuevoContacto, mostrarFormContacto, setMostrarFormContacto, agregarContacto, eliminarContacto }) {
  const hoy = todayISO();
  const vencido = p.fechaAccion && p.fechaAccion < hoy;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Próxima acción */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Próxima acción</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={S.label}>Qué hacer</label>
            <input
              style={S.input}
              placeholder="Ej: Llamar para confirmar reunión"
              value={p.accion || ''}
              onChange={(e) => set('accion', e.target.value)}
            />
          </div>
          <div>
            <label style={S.label}>Cuándo</label>
            <input
              type="date"
              style={{ ...S.input, borderColor: vencido ? T.terracota : T.borde, color: vencido ? T.terracota : T.tinta }}
              value={p.fechaAccion || ''}
              onChange={(e) => set('fechaAccion', e.target.value)}
            />
          </div>
        </div>
        {vencido && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.terracota, fontSize: 12.5, marginTop: 8 }}>
            <Icon name="alert" size={13} /> Esta acción está vencida
          </div>
        )}
      </div>

      {/* Notas generales */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Notas generales</h3>
        <textarea
          style={{ ...S.input, minHeight: 72, resize: 'vertical' }}
          placeholder="Contexto, observaciones, info del prospecto…"
          value={p.notas || ''}
          onChange={(e) => set('notas', e.target.value)}
        />
      </div>

      {/* Historial */}
      <div style={S.seccion}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ ...S.seccionTitulo, margin: 0 }}>Historial de contacto</h3>
          <button style={S.btnGhost} onClick={() => setMostrarFormContacto(!mostrarFormContacto)}>
            <Icon name="plus" size={13} /> Registrar contacto
          </button>
        </div>

        {mostrarFormContacto && (
          <div style={S.formContacto}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={S.label}>Tipo</label>
                <select style={S.input} value={nuevoContacto.tipo} onChange={(e) => setNuevoContacto({ ...nuevoContacto, tipo: e.target.value })}>
                  {TIPOS_CONTACTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Descripción</label>
                <input style={S.input} placeholder="Qué pasó…" value={nuevoContacto.texto} onChange={(e) => setNuevoContacto({ ...nuevoContacto, texto: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" style={S.input} value={nuevoContacto.fecha} onChange={(e) => setNuevoContacto({ ...nuevoContacto, fecha: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={S.btnPrimary} onClick={agregarContacto}>Guardar</button>
              <button style={S.btnGhost} onClick={() => setMostrarFormContacto(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {(p.historial || []).length === 0 && !mostrarFormContacto && (
          <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>Sin historial de contacto todavía.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...(p.historial || [])].reverse().map((h) => (
            <div key={h.id} style={S.contactoItem}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <span style={S.contactoTipo}>{TIPOS_CONTACTO.find((t) => t.value === h.tipo)?.label || h.tipo}</span>
                  <span style={{ fontSize: 11, color: T.tinta40, marginLeft: 8 }}>
                    {new Date(h.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: T.tinta }}>{h.texto}</p>
                </div>
                <button style={{ background: 'none', border: 'none', color: T.tinta40, cursor: 'pointer', padding: 4 }} onClick={() => eliminarContacto(h.id)}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: DATOS
   ============================================================ */

function TabDatos({ p, onUpdate, onCrearDesde, prospectos = [] }) {
  const set = (field, value) => onUpdate({ [field]: value });
  const setFinanzas = (field, value) => onUpdate({ finanzas: { ...p.finanzas, [field]: value } });
  const setTipoCambio = (field, value) => onUpdate({ tipoCambio: { ...p.tipoCambio, [field]: value } });
  const setDeduccion = (field, value) => onUpdate({ deduccionGanancias: { ...(p.deduccionGanancias || {}), [field]: value } });

  const setConyuge = (field, value) => {
    const base = p.conyuge || { nombre: '', edad: '', ocupacion: '' };
    onUpdate({ conyuge: { ...base, [field]: value } });
  };

  const agregarHijo = () => onUpdate({ hijos: [...(p.hijos || []), { id: uid(), nombre: '', edad: '', escolaridad: '', planEducativo: '' }] });
  const setHijo = (id, field, value) => onUpdate({ hijos: (p.hijos || []).map((h) => h.id === id ? { ...h, [field]: value } : h) });
  const quitarHijo = (id) => onUpdate({ hijos: (p.hijos || []).filter((h) => h.id !== id) });

  const segurosPrevios = p.segurosPrevios || [];
  const agregarSeguroPrevio = () => onUpdate({ segurosPrevios: [...segurosPrevios, { id: uid(), compania: '', tipo: 'vida', sumaAseguradaUSD: '' }] });
  const setSeguroPrevio = (id, field, value) => onUpdate({ segurosPrevios: segurosPrevios.map((s) => s.id === id ? { ...s, [field]: value } : s) });
  const quitarSeguroPrevio = (id) => onUpdate({ segurosPrevios: segurosPrevios.filter((s) => s.id !== id) });

  const compromisos = p.compromisos || [];
  const agregarCompromiso = () => onUpdate({ compromisos: [...compromisos, { id: uid(), tipo: 'educacion', descripcion: '', anosRestantes: '', montoAnualUSD: '' }] });
  const setCompromiso = (id, field, value) => onUpdate({ compromisos: compromisos.map((c) => c.id === id ? { ...c, [field]: value } : c) });
  const quitarCompromiso = (id) => onUpdate({ compromisos: compromisos.filter((c) => c.id !== id) });

  const numOrNull = (v) => { if (!v) return null; const n = Number(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const ingresoNum = numOrNull(p.finanzas?.ingresoMensual);
  const tcNum = numOrNull(p.tipoCambio?.valor);
  const ingresoUSD = p.finanzas?.monedaIngreso === 'USD' ? ingresoNum : (ingresoNum && tcNum ? ingresoNum / tcNum : null);
  const fmtUSD = (n) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) : '—';

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Datos personales */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Datos personales</h3>
        <Grid cols={3}>
          <Campo label="Fecha de nacimiento"><input type="date" style={S.input} value={p.fechaNacimiento || ''} onChange={(e) => set('fechaNacimiento', e.target.value)} /></Campo>
          <Campo label="Vivienda">
            <select style={S.input} value={p.vivienda || ''} onChange={(e) => set('vivienda', e.target.value)}>
              <option value="">Sin definir</option>
              <option value="alquila">Alquila</option>
              <option value="propietaria">Es propietario/a</option>
            </select>
          </Campo>
          <Campo label="Otras actividades"><input style={S.input} value={p.otrasActividades || ''} onChange={(e) => set('otrasActividades', e.target.value)} /></Campo>
        </Grid>
      </div>

      {/* Familia */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Familia</h3>

        {/* Grupo familiar — vínculos con otras fichas */}
        {(p.vinculados || []).length > 0 && (
          <div style={{ background: T.papel2, borderRadius: 9, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: T.tinta40, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>Grupo familiar</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(p.vinculados || []).map((v) => {
                const fichaVinculada = prospectos.find((pr) => pr.id === v.id);
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 7, padding: '5px 10px', fontSize: 12.5 }}>
                    <span style={{ color: T.tinta40, fontSize: 11 }}>{v.relacion}</span>
                    <span style={{ fontWeight: 600 }}>{fichaVinculada?.nombre || v.nombre}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={S.subLabel}>Cónyuge / pareja</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {p.conyuge && onCrearDesde && (
                <button
                  style={{ ...S.btnMini, color: T.sage, borderColor: T.sage }}
                  onClick={() => onCrearDesde({
                    nombre: p.conyuge.nombre || '',
                    rol: p.conyuge.ocupacion || '',
                    vinculados: [{ id: p.id, relacion: 'cónyuge', nombre: p.nombre }],
                    grupoFamiliarId: p.grupoFamiliarId || p.id,
                  })}
                  title="Crear ficha propia para el cónyuge"
                >
                  <Icon name="userplus" size={12} /> Crear ficha
                </button>
              )}
              {!p.conyuge
                ? <button style={S.btnMini} onClick={() => onUpdate({ conyuge: { nombre: '', edad: '', ocupacion: '' } })}>+ Agregar</button>
                : <button style={S.btnMini} onClick={() => onUpdate({ conyuge: null })}>Quitar</button>
              }
            </div>
          </div>
          {p.conyuge && (
            <Grid cols={3}>
              <Campo label="Nombre"><input style={S.input} value={p.conyuge.nombre || ''} onChange={(e) => setConyuge('nombre', e.target.value)} /></Campo>
              <Campo label="Edad"><input type="number" style={S.input} value={p.conyuge.edad || ''} onChange={(e) => setConyuge('edad', e.target.value)} /></Campo>
              <Campo label="Ocupación"><input style={S.input} value={p.conyuge.ocupacion || ''} onChange={(e) => setConyuge('ocupacion', e.target.value)} /></Campo>
            </Grid>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={S.subLabel}>Hijos</span>
          <button style={S.btnMini} onClick={agregarHijo}>+ Agregar hijo/a</button>
        </div>
        {(p.hijos || []).map((h, i) => (
          <div key={h.id} style={S.card2}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: T.tinta40 }}>HIJO/A {i + 1}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {h.nombre && onCrearDesde && (
                  <button
                    style={{ ...S.btnMini, fontSize: 11, color: T.sage, borderColor: T.sage }}
                    onClick={() => onCrearDesde({
                      nombre: h.nombre || '',
                      vinculados: [{ id: p.id, relacion: 'padre/madre', nombre: p.nombre }],
                      grupoFamiliarId: p.grupoFamiliarId || p.id,
                    })}
                    title="Crear ficha propia para este hijo/a"
                  >
                    <Icon name="userplus" size={11} /> Crear ficha
                  </button>
                )}
                <button style={S.iconBtnGhost} onClick={() => quitarHijo(h.id)}><Icon name="trash" size={13} /></button>
              </div>
            </div>
            <Grid cols={4}>
              <Campo label="Nombre"><input style={S.input} value={h.nombre || ''} onChange={(e) => setHijo(h.id, 'nombre', e.target.value)} /></Campo>
              <Campo label="Edad"><input type="number" style={S.input} value={h.edad || ''} onChange={(e) => setHijo(h.id, 'edad', e.target.value)} /></Campo>
              <Campo label="Escolaridad">
                <select style={S.input} value={h.escolaridad || ''} onChange={(e) => setHijo(h.id, 'escolaridad', e.target.value)}>
                  <option value="">Sin definir</option>
                  <option value="publica">Pública</option>
                  <option value="privada">Privada</option>
                  <option value="universidad">Universidad</option>
                </select>
              </Campo>
              <Campo label="Plan educativo"><input style={S.input} value={h.planEducativo || ''} onChange={(e) => setHijo(h.id, 'planEducativo', e.target.value)} /></Campo>
            </Grid>
          </div>
        ))}
      </div>

      {/* Proyectos */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Proyectos</h3>
        <Grid cols={2}>
          <Campo label="Proyectos actuales"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={p.proyectosActuales || ''} onChange={(e) => set('proyectosActuales', e.target.value)} /></Campo>
          <Campo label="Proyectos futuros"><textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={p.proyectosFuturos || ''} onChange={(e) => set('proyectosFuturos', e.target.value)} /></Campo>
        </Grid>
      </div>

      {/* Compromisos en el tiempo */}
      <div style={S.seccion}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ ...S.seccionTitulo, margin: 0 }}>Compromisos en el tiempo</h3>
          <button style={S.btnMini} onClick={agregarCompromiso}>+ Agregar</button>
        </div>
        {compromisos.map((cm, i) => (
          <div key={cm.id} style={S.card2}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: T.tinta40 }}>COMPROMISO {i + 1}</span>
              <button style={S.iconBtnGhost} onClick={() => quitarCompromiso(cm.id)}><Icon name="trash" size={13} /></button>
            </div>
            <Grid cols={4}>
              <Campo label="Tipo">
                <select style={S.input} value={cm.tipo} onChange={(e) => setCompromiso(cm.id, 'tipo', e.target.value)}>
                  <option value="educacion">Plan educativo</option>
                  <option value="credito">Crédito</option>
                  <option value="proyecto">Proyecto</option>
                  <option value="otro">Otro</option>
                </select>
              </Campo>
              <Campo label="Descripción"><input style={S.input} value={cm.descripcion || ''} onChange={(e) => setCompromiso(cm.id, 'descripcion', e.target.value)} /></Campo>
              <Campo label="Años restantes"><input type="number" style={S.input} value={cm.anosRestantes || ''} onChange={(e) => setCompromiso(cm.id, 'anosRestantes', e.target.value)} /></Campo>
              <Campo label="Costo anual (USD)"><input type="number" style={S.input} value={cm.montoAnualUSD || ''} onChange={(e) => setCompromiso(cm.id, 'montoAnualUSD', e.target.value)} /></Campo>
            </Grid>
          </div>
        ))}
      </div>

      {/* Seguros previos */}
      <div style={S.seccion}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ ...S.seccionTitulo, margin: 0 }}>Seguros vigentes (otras compañías)</h3>
          <button style={S.btnMini} onClick={agregarSeguroPrevio}>+ Agregar</button>
        </div>
        {segurosPrevios.map((s, i) => (
          <div key={s.id} style={S.card2}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: T.tinta40 }}>SEGURO PREVIO {i + 1}</span>
              <button style={S.iconBtnGhost} onClick={() => quitarSeguroPrevio(s.id)}><Icon name="trash" size={13} /></button>
            </div>
            <Grid cols={3}>
              <Campo label="Compañía"><input style={S.input} value={s.compania || ''} onChange={(e) => setSeguroPrevio(s.id, 'compania', e.target.value)} /></Campo>
              <Campo label="Tipo">
                <select style={S.input} value={s.tipo} onChange={(e) => setSeguroPrevio(s.id, 'tipo', e.target.value)}>
                  <option value="vida">Vida</option>
                  <option value="itp">ITP</option>
                  <option value="enfermedadesCriticas">Enf. críticas</option>
                  <option value="muerteAccidental">Muerte accidental</option>
                  <option value="otro">Otro</option>
                </select>
              </Campo>
              <Campo label="Suma asegurada (USD)"><input type="number" style={S.input} value={s.sumaAseguradaUSD || ''} onChange={(e) => setSeguroPrevio(s.id, 'sumaAseguradaUSD', e.target.value)} /></Campo>
            </Grid>
          </div>
        ))}
      </div>

      {/* Operaciones de cierre — visibles cuando el estado es cerrado */}
      {p.estado === 'cerrado' && (
        <div style={{ ...S.seccion, background: 'rgba(45,80,22,0.04)', borderRadius: 10, padding: 20, border: '1px solid rgba(45,80,22,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...S.seccionTitulo, color: '#2D5016', margin: 0 }}>✓ Operaciones de cierre</h3>
            <button style={{ ...S.btnMini, borderColor: '#2D5016', color: '#2D5016' }}
              onClick={() => onUpdate({ cierres: [...(p.cierres || []), nuevaOperacionCierre()] })}>
              + Agregar operación
            </button>
          </div>

          {(p.cierres || []).length === 0 && (
            <p style={{ fontSize: 13, color: T.tinta40, fontStyle: 'italic' }}>
              Sin operaciones cargadas. Agregá una póliza nueva, endoso, retiro o salud.
            </p>
          )}

          {(p.cierres || []).map((op, idx) => {
            const setCierre = (field, val) => {
              const nuevos = (p.cierres || []).map((c, i) => i === idx ? { ...c, [field]: val } : c);
              onUpdate({ cierres: nuevos });
            };
            const quitarCierre = () => onUpdate({ cierres: (p.cierres || []).filter((_, i) => i !== idx) });
            const primaM = Number(op.primaMensualUSD) || 0;
            const primaA = primaM * 12;
            const nbsM = op.tipo === 'endoso' && op.primaAnteriorUSD ? primaM - Number(op.primaAnteriorUSD) : null;

            const TIPO_LABELS = { poliza_nueva: 'Póliza nueva de vida', endoso: 'Endoso', retiro: 'Plan de retiro', salud: 'Seguro de salud' };

            return (
              <div key={op.id} style={{ background: '#fff', borderRadius: 9, padding: 16, marginBottom: 12, border: '1px solid rgba(45,80,22,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#2D5016', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Operación {idx + 1} — {TIPO_LABELS[op.tipo] || op.tipo}
                  </span>
                  <button style={{ background: 'none', border: 'none', color: T.terracota, cursor: 'pointer', fontSize: 13 }} onClick={quitarCierre}>✕ Quitar</button>
                </div>

                {/* Tipo + cliente nuevo */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select style={{ ...S.input, maxWidth: 220 }} value={op.tipo} onChange={e => setCierre('tipo', e.target.value)}>
                    <option value="poliza_nueva">Póliza nueva de vida</option>
                    <option value="endoso">Endoso</option>
                    <option value="retiro">Plan de retiro</option>
                    <option value="salud">Seguro de salud</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer', color: T.tinta60 }}>
                    <input type="checkbox" checked={op.clienteNuevo || false} onChange={e => setCierre('clienteNuevo', e.target.checked)} />
                    Cliente nuevo
                  </label>
                </div>

                <Grid cols={3}>
                  <Campo label="Fecha de emisión">
                    <input type="date" style={S.input} value={op.fechaEmision || ''} onChange={e => setCierre('fechaEmision', e.target.value)} />
                  </Campo>
                  <Campo label="Compañía">
                    <select style={S.input} value={op.compania || 'Life Seguros'} onChange={e => setCierre('compania', e.target.value)}>
                      <option value="Life Seguros">Life Seguros</option>
                      <option value="Orígenes">Orígenes</option>
                      <option value="Otra">Otra</option>
                    </select>
                  </Campo>
                  <Campo label={op.tipo === 'endoso' ? 'Prima nueva (USD/mes)' : 'Prima mensual (USD)'}>
                    <input type="number" style={S.input} placeholder="Ej: 261" value={op.primaMensualUSD || ''} onChange={e => setCierre('primaMensualUSD', e.target.value)} />
                  </Campo>
                </Grid>

                {op.tipo === 'endoso' && (
                  <Grid cols={3}>
                    <Campo label="Prima anterior (USD/mes)">
                      <input type="number" style={S.input} placeholder="Prima antes del endoso" value={op.primaAnteriorUSD || ''} onChange={e => setCierre('primaAnteriorUSD', e.target.value)} />
                    </Campo>
                    <Campo label="NBS mensual" span={2}>
                      <div style={{ ...S.input, background: T.papel2, color: '#2D5016', fontFamily: 'monospace', fontWeight: 700 }}>
                        {nbsM !== null ? `$${nbsM.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD/mes → $${(nbsM * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD/año` : '—'}
                      </div>
                    </Campo>
                  </Grid>
                )}

                <Grid cols={2} style={{ marginTop: 6 }}>
                  <Campo label="Suma asegurada (USD)">
                    <input type="number" style={S.input} placeholder="Ej: 100000" value={op.sumaAseguradaUSD || ''} onChange={e => setCierre('sumaAseguradaUSD', e.target.value)} />
                  </Campo>
                  <Campo label="Notas">
                    <input style={S.input} placeholder="Ej: Mod 5-10, nivelación año 3" value={op.notas || ''} onChange={e => setCierre('notas', e.target.value)} />
                  </Campo>
                </Grid>

                {primaM > 0 && (
                  <div style={{ display: 'flex', gap: 20, marginTop: 10, padding: '8px 12px', background: 'rgba(45,80,22,0.06)', borderRadius: 7 }}>
                    <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>Prima mensual</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2D5016' }}>${primaM.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</div></div>
                    <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>Prima anualizada</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2D5016' }}>${primaA.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</div></div>
                    {nbsM !== null && <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>NBS anual</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2D5016' }}>${(nbsM * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</div></div>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Totales de todas las operaciones */}
          {(p.cierres || []).length > 1 && (() => {
            const totalM = (p.cierres || []).reduce((acc, c) => acc + (Number(c.primaMensualUSD) || 0), 0);
            return (
              <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'rgba(45,80,22,0.08)', borderRadius: 8, marginTop: 4 }}>
                <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>Total mensual</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2D5016', fontSize: 15 }}>${totalM.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</div></div>
                <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>Total anualizado</div><div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2D5016', fontSize: 15 }}>${(totalM * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD</div></div>
                <div><div style={{ fontSize: 10, color: '#2D5016', textTransform: 'uppercase' }}>Operaciones</div><div style={{ fontWeight: 700, color: '#2D5016', fontSize: 15 }}>{(p.cierres || []).length}</div></div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Pólizas de cartera */}
      {(p.polizasCartera || []).length > 0 && (
        <div style={S.seccion}>
          <h3 style={S.seccionTitulo}>Pólizas en cartera</h3>
          <p style={{ fontSize: 12, color: T.tinta40, margin: '-8px 0 12px' }}>Importadas desde el reporte de Life Seguros. Podés actualizar el estado manualmente.</p>
          {(p.polizasCartera || []).map((pol) => {
            const estadoColor = (pol.estado || '').toLowerCase().includes('vigente') ? T.sage
              : (pol.estado || '').toLowerCase().includes('cancelad') ? T.terracota
              : (pol.estado || '').toLowerCase().includes('lapsead') ? T.dorado
              : T.tinta40;
            return (
              <div key={pol.id || pol.nroPoliza} style={{ borderBottom: `1px solid ${T.borde}`, padding: '10px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: T.tinta40, marginRight: 8 }}>#{pol.nroPoliza}</span>
                    <span style={{ fontWeight: 600 }}>{pol.descripcionPlan}</span>
                  </div>
                  <select
                    value={pol.estado || ''}
                    onChange={(e) => {
                      const nuevasPolizas = (p.polizasCartera || []).map(pp =>
                        (pp.id || pp.nroPoliza) === (pol.id || pol.nroPoliza)
                          ? { ...pp, estado: e.target.value }
                          : pp
                      );
                      onUpdate({ polizasCartera: nuevasPolizas });
                    }}
                    style={{ fontSize: 11.5, fontWeight: 600, color: estadoColor, border: `1px solid ${estadoColor}`, borderRadius: 5, padding: '2px 6px', background: '#fff', cursor: 'pointer' }}
                  >
                    <option value="Vigente">Vigente</option>
                    <option value="Cancelada">Cancelada</option>
                    <option value="Lapseada">Lapseada</option>
                    <option value="Rescatada">Rescatada</option>
                    <option value="Suspendida">Suspendida</option>
                    <option value="Vencida">Vencida</option>
                    <option value={pol.estado || ''}>{pol.estado || 'Sin estado'}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.tinta60 }}>
                  <span>SA: {pol.moneda === 'ARS' ? '$' : 'USD '}${Number(pol.sumaAseg).toLocaleString('es-AR')}</span>
                  <span>Prima: {pol.moneda === 'ARS' ? '$' : 'USD '}${Number(pol.primaAnual).toLocaleString('es-AR')}/año</span>
                  {pol.fechaVigencia && <span>Desde {pol.fechaVigencia}</span>}
                </div>
                {pol.tomador && pol.tomador !== pol.asegurado && (
                  <div style={{ fontSize: 11, color: T.tinta40, marginTop: 2 }}>Tomador: {pol.tomador}</div>
                )}
                {pol.suplementos?.length > 0 && (
                  <div style={{ fontSize: 11, color: T.tinta40, marginTop: 3 }}>{pol.suplementos.join(' · ')}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contexto personal */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Contexto personal</h3>
        <p style={{ fontSize: 12.5, color: T.tinta40, margin: '0 0 10px', lineHeight: 1.5 }}>
          Lo que importa saber y no entra en ninguna categoría — historia de vida, contexto familiar, experiencias con seguros, lo que mencionó en la reunión.
        </p>
        <textarea
          style={{ ...S.input, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
          placeholder="Ej: Cobró el seguro de su padre hace dos años. Tiene desconfianza inicial de las aseguradoras pero quedó muy conforme con la experiencia. Tuvo que dejar la facultad para trabajar y ahora lo retomó..."
          value={p.contextPersonal || ''}
          onChange={(e) => set('contextPersonal', e.target.value)}
        />
      </div>

      {/* Finanzas */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Situación financiera</h3>
        <Grid cols={3}>
          <Campo label="Ingreso mensual">
            <div style={{ display: 'flex', border: `1px solid ${T.borde}`, borderRadius: 7, overflow: 'hidden', background: '#fff' }}>
              <input type="number" style={{ ...S.input, border: 'none', flex: 1 }} value={p.finanzas?.ingresoMensual || ''} onChange={(e) => setFinanzas('ingresoMensual', e.target.value)} />
              <select style={{ border: 'none', borderLeft: `1px solid ${T.borde}`, background: T.papel2, fontSize: 12.5, padding: '0 8px', color: T.tinta60 }} value={p.finanzas?.monedaIngreso || 'ARS'} onChange={(e) => setFinanzas('monedaIngreso', e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </Campo>
          <Campo label="Gasto mensual"><input type="number" style={S.input} value={p.finanzas?.gastoMensual || ''} onChange={(e) => setFinanzas('gastoMensual', e.target.value)} /></Campo>
          <Campo label="Prima máxima mensual"><input type="number" style={S.input} placeholder="Si vacío, 10% del ingreso" value={p.finanzas?.primaMaxima || ''} onChange={(e) => setFinanzas('primaMaxima', e.target.value)} /></Campo>
          <Campo label="Ahorros"><input style={S.input} value={p.finanzas?.ahorros || ''} onChange={(e) => setFinanzas('ahorros', e.target.value)} /></Campo>
          <Campo label="Inversiones"><input style={S.input} value={p.finanzas?.inversiones || ''} onChange={(e) => setFinanzas('inversiones', e.target.value)} /></Campo>
          <Campo label="Créditos activos"><input style={S.input} value={p.finanzas?.creditosActivos || ''} onChange={(e) => setFinanzas('creditosActivos', e.target.value)} /></Campo>
        </Grid>
      </div>

      {/* Tipo de cambio */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Dolarización</h3>
        <Grid cols={3}>
          <Campo label="Tipo de cambio oficial mayorista">
            <input type="number" style={S.input} placeholder="Ej: 1450" value={p.tipoCambio?.valor || ''} onChange={(e) => setTipoCambio('valor', e.target.value)} />
          </Campo>
          <Campo label="Fecha">
            <input type="date" style={S.input} value={p.tipoCambio?.fecha || ''} onChange={(e) => setTipoCambio('fecha', e.target.value)} />
          </Campo>
          <Campo label="Ingreso en USD">
            <div style={{ ...S.input, background: T.papel2, color: T.tinta60, fontFamily: T.mono }}>{fmtUSD(ingresoUSD)}</div>
          </Campo>
        </Grid>
      </div>

      {/* Deducción de Ganancias */}
      <div style={S.seccion}>
        <h3 style={S.seccionTitulo}>Deducción de Ganancias</h3>
        <Grid cols={3}>
          <Campo label="Tope — Vida con ahorro (ARS)"><input type="number" style={S.input} value={p.deduccionGanancias?.topeVidaYAhorro || ''} onChange={(e) => setDeduccion('topeVidaYAhorro', e.target.value)} /></Campo>
          <Campo label="Tope — Vida puro (ARS)"><input type="number" style={S.input} value={p.deduccionGanancias?.topeVidaPuro || ''} onChange={(e) => setDeduccion('topeVidaPuro', e.target.value)} /></Campo>
          <Campo label="Tope — Retiro (ARS)"><input type="number" style={S.input} value={p.deduccionGanancias?.topeRetiro || ''} onChange={(e) => setDeduccion('topeRetiro', e.target.value)} /></Campo>
        </Grid>
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */
function Grid({ cols, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '12px 16px', marginBottom: 6 }}>{children}</div>;
}
function Campo({ label, children }) {
  return <div><label style={S.label}>{label}</label>{children}</div>;
}

/* ============================================================
   ESTILOS
   ============================================================ */
const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  fichaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${T.borde}`, flexShrink: 0, flexWrap: 'wrap', gap: 12 },
  backBtn: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.tinta, flexShrink: 0 },
  nombreInput: { fontFamily: T.serif, fontSize: 22, fontWeight: 600, border: 'none', borderBottom: `2px solid ${T.borde}`, background: 'transparent', padding: '2px 0', color: T.tinta, width: 340 },
  rolInput: { fontSize: 13, border: 'none', borderBottom: `1px solid ${T.borde}`, background: 'transparent', padding: '2px 0', color: T.tinta60, width: 200 },
  fuenteSelect: { fontSize: 12, border: `1px solid ${T.borde}`, borderRadius: 6, padding: '2px 8px', background: T.papel2, color: T.tinta60, marginLeft: 8 },
  etapaSelect: { fontSize: 13, fontWeight: 600, border: `2px solid`, borderRadius: 8, padding: '7px 12px', background: 'transparent', cursor: 'pointer' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: T.tinta, color: T.papel, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: T.tinta, border: `1px solid ${T.borde}`, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, cursor: 'pointer' },
  btnMini: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: T.tinta },
  iconBtnGhost: { background: 'none', border: 'none', color: T.tinta40, cursor: 'pointer', padding: 4 },
  tabs: { display: 'flex', borderBottom: `1px solid ${T.borde}`, padding: '0 24px', flexShrink: 0 },
  tab: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, cursor: 'pointer', color: T.tinta60, marginBottom: -1 },
  tabActivo: { color: T.tinta, borderBottomColor: T.dorado, fontWeight: 600 },
  contenido: { flex: 1, overflowY: 'auto', padding: '24px' },
  seccion: { marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${T.borde}` },
  seccionTitulo: { fontFamily: T.serif, fontSize: 16, fontWeight: 600, margin: '0 0 14px', color: T.tinta },
  subLabel: { fontSize: 12, fontWeight: 600, color: T.tinta60, textTransform: 'uppercase', letterSpacing: 0.3 },
  label: { display: 'block', fontSize: 11, color: T.tinta40, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { width: '100%', border: `1px solid ${T.borde}`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, background: '#fff', color: T.tinta, fontFamily: T.sans, boxSizing: 'border-box' },
  card2: { background: T.papel2, borderRadius: 9, padding: 14, marginBottom: 10 },
  formContacto: { background: T.papel2, borderRadius: 10, padding: 16, marginBottom: 14 },
  contactoItem: { background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 9, padding: '10px 14px' },
  contactoTipo: { fontSize: 11.5, fontWeight: 600, color: T.tinta60, textTransform: 'uppercase', letterSpacing: 0.3 },
};
