import React, { useState, useRef } from 'react';
import { T } from './tokens.js';
import { ETAPAS, FUENTES, nuevoProspecto, migrarDesdeCRM, uid, todayISO } from './data.js';

/* ============================================================
   ICONOS
   ============================================================ */
const Icon = ({ name, size = 16 }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    check: 'M20 6 9 17l-5-5',
    linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ''} />
    </svg>
  );
};

/* ============================================================
   COLORES POR ETAPA
   ============================================================ */
const ETAPA_COLOR = {
  alpha: T.dorado,
  entrevistado: '#5B8FA8',
  propuesta: T.sage,
  cerrado: '#2D5016',
  en_pausa: T.tinta40,
  cancelado: T.terracota,
};

const ETAPA_BG = {
  alpha: 'rgba(201,162,75,0.1)',
  entrevistado: 'rgba(91,143,168,0.1)',
  propuesta: 'rgba(61,107,79,0.1)',
  cerrado: 'rgba(45,80,22,0.1)',
  en_pausa: 'rgba(26,46,41,0.06)',
  cancelado: 'rgba(181,72,61,0.08)',
};

/* ============================================================
   PIPELINE PRINCIPAL
   ============================================================ */

export default function Pipeline({ prospectos, onAbrir, onCreate, onUpdate, onEliminar }) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarImport, setMostrarImport] = useState(false);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const fileInputRef = useRef(null);

  const etapasActivas = ETAPAS.filter((e) => e.id !== 'cancelado' && e.id !== 'en_pausa');
  const etapasColapsadas = ETAPAS.filter((e) => e.id === 'en_pausa' || e.id === 'cancelado');

  const filtrados = busqueda
    ? prospectos.filter((p) =>
        (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.rol || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : prospectos;

  const porEtapa = (etapaId) => filtrados.filter((p) => p.estado === etapaId);

  const hoy = todayISO();
  const vencidos = (lista) => lista.filter((p) => p.fechaAccion && p.fechaAccion < hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado');

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      const migrados = arr.map(migrarDesdeCRM);
      migrados.forEach((p) => onCreate(p));
      setMostrarImport(false);
      alert(`✓ ${migrados.length} prospectos importados correctamente.`);
    } catch (err) {
      alert('No se pudo leer el archivo. Asegurate de que sea el crm-backup.json.');
    }
  };

  const moverEtapa = (prospecto, nuevaEtapa) => {
    onUpdate(prospecto.id, { estado: nuevaEtapa });
  };

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
          <div style={S.searchBox}>
            <Icon name="search" size={15} />
            <input
              style={S.searchInput}
              placeholder="Buscar prospecto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <span style={{ fontSize: 12, color: T.tinta40 }}>{prospectos.length} prospectos</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhost} onClick={() => setMostrarImport(true)}>
            <Icon name="upload" size={14} /> Importar CRM
          </button>
          <button style={S.btnPrimary} onClick={() => onCreate(nuevoProspecto())}>
            <Icon name="plus" size={15} /> Nuevo prospecto
          </button>
        </div>
      </div>

      {/* Modal importar */}
      {mostrarImport && (
        <div style={S.modalOverlay} onClick={() => setMostrarImport(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: T.serif, fontSize: 18, margin: '0 0 12px' }}>Importar desde CRM anterior</h3>
            <p style={{ fontSize: 13, color: T.tinta60, lineHeight: 1.6 }}>
              Seleccioná el archivo <strong>crm-backup.json</strong> que descargaste del CRM viejo. Todos tus prospectos van a aparecer en el pipeline automáticamente.
            </p>
            <button style={{ ...S.btnPrimary, marginTop: 16 }} onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" size={15} /> Seleccionar archivo
            </button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            <button style={{ ...S.btnGhost, marginTop: 10, width: '100%' }} onClick={() => setMostrarImport(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Columnas activas */}
      <div style={S.columnas}>
        {etapasActivas.map((etapa) => {
          const lista = porEtapa(etapa.id);
          const venc = vencidos(lista);
          return (
            <div key={etapa.id} style={S.columna}>
              <div style={{ ...S.columnaHeader, borderBottom: `2px solid ${ETAPA_COLOR[etapa.id]}` }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: ETAPA_COLOR[etapa.id] }}>{etapa.label}</span>
                <span style={{ fontSize: 11, color: T.tinta40, background: T.papel2, borderRadius: 10, padding: '2px 8px' }}>{lista.length}</span>
                {venc.length > 0 && (
                  <span style={{ fontSize: 10, color: T.terracota, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon name="alert" size={11} />{venc.length}
                  </span>
                )}
              </div>
              <div style={S.columnaBody}>
                {lista.map((p) => (
                  <TarjetaProspecto
                    key={p.id}
                    prospecto={p}
                    onAbrir={() => onAbrir(p.id)}
                    onMover={(etapaId) => moverEtapa(p, etapaId)}
                    hoy={hoy}
                  />
                ))}
                {lista.length === 0 && (
                  <div style={{ fontSize: 12, color: T.tinta40, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                    Sin prospectos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fila colapsada: En pausa + Cancelados */}
      <div style={S.colapsadoWrap}>
        {etapasColapsadas.map((etapa) => {
          const lista = porEtapa(etapa.id);
          if (lista.length === 0) return null;
          return (
            <details key={etapa.id} style={{ marginRight: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, color: ETAPA_COLOR[etapa.id], fontWeight: 600, padding: '6px 0', userSelect: 'none' }}>
                {etapa.label} ({lista.length})
              </summary>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {lista.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => onAbrir(p.id)}
                    style={{ background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.nombre || 'Sin nombre'}</div>
                    <div style={{ fontSize: 11, color: T.tinta40 }}>{p.rol}</div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   TARJETA DE PROSPECTO
   ============================================================ */

function TarjetaProspecto({ prospecto: p, onAbrir, onMover, hoy }) {
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const vencido = p.fechaAccion && p.fechaAccion < hoy;
  const etapasDestino = ETAPAS.filter((e) => e.id !== p.estado);

  return (
    <div style={{ ...S.tarjeta, borderLeft: `3px solid ${ETAPA_COLOR[p.estado] || T.borde}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onAbrir}>
          <div style={S.tarjetaNombre}>{p.nombre || 'Sin nombre'}</div>
          {p.rol && <div style={S.tarjetaRol}>{p.rol}</div>}
        </div>
        <div style={{ position: 'relative' }}>
          <button style={S.menuBtn} onClick={() => setMostrarMenu(!mostrarMenu)}>···</button>
          {mostrarMenu && (
            <div style={S.menuDrop} onClick={(e) => e.stopPropagation()}>
              <div style={S.menuLabel}>Mover a</div>
              {etapasDestino.map((e) => (
                <div
                  key={e.id}
                  style={S.menuItem}
                  onClick={() => { onMover(e.id); setMostrarMenu(false); }}
                >
                  <span style={{ color: ETAPA_COLOR[e.id] }}>●</span> {e.label}
                </div>
              ))}
              <div style={{ ...S.menuItem, borderTop: `1px solid ${T.borde}`, marginTop: 4, paddingTop: 8 }} onClick={() => { onAbrir(); setMostrarMenu(false); }}>
                Ver ficha completa
              </div>
            </div>
          )}
        </div>
      </div>

      {p.fuente && (
        <div style={{ fontSize: 11, color: T.tinta40, marginTop: 4 }}>
          {p.fuente}
        </div>
      )}

      {p.accion && (
        <div style={{ marginTop: 8, fontSize: 12, color: vencido ? T.terracota : T.tinta60 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {vencido && <Icon name="alert" size={11} />}
            {p.accion}
          </span>
          {p.fechaAccion && (
            <span style={{ fontSize: 11, color: vencido ? T.terracota : T.tinta40 }}>
              {new Date(p.fechaAccion + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ESTILOS
   ============================================================ */

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: `1px solid ${T.borde}`, gap: 12, flexShrink: 0 },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 8, padding: '7px 12px', color: T.tinta40 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: T.tinta, width: 200 },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: T.tinta, color: T.papel, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: T.tinta, border: `1px solid ${T.borde}`, borderRadius: 8, padding: '9px 16px', fontSize: 13, cursor: 'pointer' },
  columnas: { display: 'flex', gap: 0, flex: 1, overflow: 'hidden' },
  columna: { flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.borde}` },
  columnaHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', flexShrink: 0 },
  columnaBody: { flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  tarjeta: { background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 10, padding: '12px 14px', cursor: 'default', position: 'relative' },
  tarjetaNombre: { fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, color: T.tinta },
  tarjetaRol: { fontSize: 12, color: T.tinta60, marginTop: 2 },
  menuBtn: { background: 'none', border: 'none', color: T.tinta40, fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  menuDrop: { position: 'absolute', right: 0, top: 24, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 160, padding: '8px 0' },
  menuLabel: { fontSize: 10, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 14px' },
  menuItem: { fontSize: 13, padding: '7px 14px', cursor: 'pointer', color: T.tinta, display: 'flex', alignItems: 'center', gap: 8 },
  colapsadoWrap: { borderTop: `1px solid ${T.borde}`, padding: '12px 24px', flexShrink: 0 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,46,41,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: T.papel, borderRadius: 14, padding: '28px 30px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  borde: T.borde,
};
