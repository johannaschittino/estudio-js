import React, { useState, useRef } from 'react';
import { T } from './tokens.js';
import { ETAPAS, FUENTES, nuevoProspecto, migrarDesdeCRM, uid, todayISO, parsearFilasExcel, procesarImportacionCartera, formatearNombre } from './data.js';

const ETAPA_COLOR = {
  sin_contactar: '#8B9E8B', contactado: '#C9A24B', entrevistado: '#5B8FA8',
  propuesta: T.sage, cerrado: '#2D5016', en_pausa: T.tinta40, cancelado: T.terracota,
};

const Icon = ({ name, size = 16 }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14', user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16', search: 'M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    check: 'M20 6 9 17l-5-5', filter: 'M22 3H2l8 9.46V19l4 2V12.46L22 3Z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ''} />
    </svg>
  );
};

export default function Pipeline({ prospectos, onAbrir, onCreate, onUpdate, onEliminar }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroFuente, setFiltroFuente] = useState('');
  const [tab, setTab] = useState('pipeline'); // pipeline | seguimientos
  const [mostrarImport, setMostrarImport] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const fileExcelRef = useRef(null);

  const etapasActivas = ETAPAS.filter((e) => e.id !== 'cancelado' && e.id !== 'en_pausa');
  const etapasColapsadas = ETAPAS.filter((e) => e.id === 'en_pausa' || e.id === 'cancelado');

  const filtrados = prospectos.filter((p) => {
    const matchBusqueda = !busqueda ||
      (p.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.rol || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.notas || '').toLowerCase().includes(busqueda.toLowerCase());
    const matchFuente = !filtroFuente || p.fuente === filtroFuente;
    return matchBusqueda && matchFuente;
  });

  const porEtapa = (etapaId) => filtrados.filter((p) => p.estado === etapaId);

  const hoy = todayISO();
  const vencidos = (lista) => lista.filter((p) => p.fechaAccion && p.fechaAccion < hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado');

  // Seguimientos del día — todos con acción para hoy o vencida
  const seguimientosHoy = prospectos.filter((p) =>
    p.fechaAccion && p.fechaAccion <= hoy && p.estado !== 'cerrado' && p.estado !== 'cancelado'
  ).sort((a, b) => a.fechaAccion.localeCompare(b.fechaAccion));

  // Cumpleaños próximos (7 días)
  const cumpleañosProximos = prospectos.filter((p) => {
    if (!p.fechaNacimiento) return false;
    const hoyDate = new Date();
    const nac = new Date(p.fechaNacimiento + 'T00:00:00');
    if (isNaN(nac.getTime())) return false;
    const cumple = new Date(hoyDate.getFullYear(), nac.getMonth(), nac.getDate());
    if (cumple < hoyDate) cumple.setFullYear(hoyDate.getFullYear() + 1);
    const diff = (cumple - hoyDate) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  // Fuentes únicas para el filtro
  const fuentesUnicas = [...new Set(prospectos.map((p) => p.fuente).filter(Boolean))].sort();

  const handleImportCRM = async (e) => {
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
      alert('No se pudo leer el archivo JSON.');
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      // Leer el Excel como ArrayBuffer y procesarlo con SheetJS en el navegador
      const arrayBuffer = await file.arrayBuffer();
      // Usamos FileReader para convertir a base64 y luego procesar
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          // Cargar SheetJS si no está disponible
          if (!window.XLSX) {
            await cargarScriptCartera('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
          }
          const workbook = window.XLSX.read(evt.target.result, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const filas = window.XLSX.utils.sheet_to_json(sheet, { header: 1 });

          // Procesar filas — primera fila es header
          const headers = filas[0] || [];
          const idx = {
            nroPoliza: headers.findIndex(h => String(h).includes('POLIZ')),
            descripcionPlan: headers.findIndex(h => String(h).includes('DESCRIPCION')),
            sumaAseg: headers.findIndex(h => String(h).includes('SUMA')),
            prima: headers.findIndex(h => String(h).includes('PRIMA') || String(h) === 'PRIMA'),
            moneda: headers.findIndex(h => String(h).includes('MONEDA')),
            fechaVigencia: headers.findIndex(h => String(h).includes('VIGENCIA')),
            estado: headers.findIndex(h => String(h).includes('ESTADO')),
            tomador: headers.findIndex(h => String(h).includes('TOMADOR')),
            asegurado: headers.findIndex(h => String(h).includes('ASEGURADO')),
            fechaNac: headers.findIndex(h => String(h).includes('FECHA NAC') || String(h).includes('FECHANAC')),
            nroDoc: headers.findIndex(h => String(h).includes('NRO DOC') || String(h).includes('NRODOC')),
            tel1: headers.findIndex(h => String(h).includes('TELEFONO 1') || String(h).includes('TEL1')),
            tel2: headers.findIndex(h => String(h).includes('TELEFONO 2') || String(h).includes('TEL2')),
            tel3: headers.findIndex(h => String(h).includes('TELEFONO 3') || String(h).includes('TEL3')),
            mail: headers.findIndex(h => String(h).includes('MAIL') || String(h).includes('EMAIL')),
            sup1: headers.findIndex(h => String(h).includes('SUPLEMENTO 1') || String(h).includes('SUP1')),
            sup2: headers.findIndex(h => String(h).includes('SUPLEMENTO 2') || String(h).includes('SUP2')),
            sup3: headers.findIndex(h => String(h).includes('SUPLEMENTO 3') || String(h).includes('SUP3')),
            sup4: headers.findIndex(h => String(h).includes('SUPLEMENTO 4') || String(h).includes('SUP4')),
            sup5: headers.findIndex(h => String(h).includes('SUPLEMENTO 5') || String(h).includes('SUP5')),
          };

          const excelFechaAISO = (n) => {
            if (!n || isNaN(n)) return '';
            const fecha = new Date(Math.round((n - 25569) * 86400 * 1000));
            return fecha.toISOString().slice(0, 10);
          };

          const filasProcesadas = filas.slice(1).filter(f => f[idx.nroPoliza]).map(f => ({
            nroPoliza: String(f[idx.nroPoliza] || '').trim(),
            descripcionPlan: String(f[idx.descripcionPlan] || '').trim(),
            sumaAseg: Number(f[idx.sumaAseg]) || 0,
            prima: Number(f[idx.prima]) || 0,
            moneda: String(f[idx.moneda] || 'D').trim() === 'P' ? 'ARS' : 'USD',
            fechaVigencia: excelFechaAISO(Number(f[idx.fechaVigencia])),
            estado: String(f[idx.estado] || '').trim(),
            tomadorRaw: String(f[idx.tomador] || '').trim(),
            aseguradoRaw: String(f[idx.asegurado] || '').trim(),
            fechaNacRaw: Number(f[idx.fechaNac]) || 0,
            nroDoc: String(f[idx.nroDoc] || '').trim(),
            tel1: String(f[idx.tel1] || '').trim(),
            tel2: String(f[idx.tel2] || '').trim(),
            tel3: String(f[idx.tel3] || '').trim(),
            mail: String(f[idx.mail] || '').trim(),
            suplementos: [f[idx.sup1], f[idx.sup2], f[idx.sup3], f[idx.sup4], f[idx.sup5]]
              .map(s => String(s || '').trim()).filter(Boolean),
          }));

          const resultado = procesarImportacionCartera(filasProcesadas, prospectos);
          resultado.nuevos.forEach(p => onCreate(p));
          resultado.actualizados.forEach(p => {
            onUpdate(p.id, {
              polizasCartera: p.polizasCartera,
              nroDoc: p.nroDoc,
              telefonos: p.telefonos,
              mail: p.mail,
              fechaNacimiento: p.fechaNacimiento,
              nombre: p.nombre, // actualizar al nombre del asegurado
            });
          });
          setImportResult(resultado);
        } catch (err) {
          alert('Error procesando el Excel: ' + err.message);
        } finally {
          setImportando(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      alert('Error leyendo el archivo: ' + err.message);
      setImportando(false);
    }
  };

  const moverEtapa = (prospecto, nuevaEtapa) => onUpdate(prospecto.id, { estado: nuevaEtapa });

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
          <div style={S.searchBox}>
            <Icon name="search" size={15} />
            <input style={S.searchInput} placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <select style={S.filtroSelect} value={filtroFuente} onChange={(e) => setFiltroFuente(e.target.value)}>
            <option value="">Todas las fuentes</option>
            {fuentesUnicas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <span style={{ fontSize: 12, color: T.tinta40 }}>{filtrados.length} de {prospectos.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnGhost} onClick={() => setMostrarImport(true)}>
            <Icon name="upload" size={14} /> Importar
          </button>
          <button style={S.btnPrimary} onClick={() => onCreate(nuevoProspecto())}>
            <Icon name="plus" size={15} /> Nuevo
          </button>
        </div>
      </div>

      {/* Tabs Pipeline / Seguimientos */}
      <div style={S.tabBar}>
        <button style={{ ...S.tabBtn, ...(tab === 'pipeline' ? S.tabBtnActivo : {}) }} onClick={() => setTab('pipeline')}>
          Pipeline
        </button>
        <button style={{ ...S.tabBtn, ...(tab === 'seguimientos' ? S.tabBtnActivo : {}) }} onClick={() => setTab('seguimientos')}>
          <Icon name="clock" size={13} /> Seguimientos del día
          {seguimientosHoy.length > 0 && (
            <span style={{ background: T.terracota, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 4 }}>{seguimientosHoy.length}</span>
          )}
        </button>
      </div>

      {/* Modal importar */}
      {mostrarImport && (
        <div style={S.modalOverlay} onClick={() => { setMostrarImport(false); setImportResult(null); }}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: T.serif, fontSize: 18, margin: '0 0 12px' }}>Importar datos</h3>
            {importResult ? (
              <div>
                <div style={{ background: 'rgba(61,107,79,0.1)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13.5 }}>
                  ✓ <strong>{importResult.nuevos.length}</strong> prospectos nuevos creados<br/>
                  ✓ <strong>{importResult.actualizados.length}</strong> fichas actualizadas con pólizas
                </div>
                <button style={S.btnPrimary} onClick={() => { setMostrarImport(false); setImportResult(null); }}>Listo</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: T.tinta60, marginBottom: 16 }}>¿Qué tipo de archivo querés importar?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={S.btnGhost} onClick={() => fileExcelRef.current?.click()}>
                    <Icon name="upload" size={14} /> {importando ? 'Procesando...' : 'Excel de cartera Life Seguros (.xlsx)'}
                  </button>
                  <button style={S.btnGhost} onClick={() => fileInputRef.current?.click()}>
                    <Icon name="upload" size={14} /> Backup CRM anterior (.json)
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportCRM} />
                <input ref={fileExcelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
                <button style={{ ...S.btnGhost, marginTop: 12, width: '100%' }} onClick={() => setMostrarImport(false)}>Cancelar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cumpleaños */}
      {tab === 'pipeline' && cumpleañosProximos.length > 0 && (
        <div style={{ background: 'rgba(201,162,75,0.1)', borderBottom: `1px solid rgba(201,162,75,0.3)`, padding: '8px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: T.dorado }}>🎂</span>
          {cumpleañosProximos.map((p) => {
            const nac = new Date(p.fechaNacimiento + 'T00:00:00');
            const hoyDate = new Date();
            const cumple = new Date(hoyDate.getFullYear(), nac.getMonth(), nac.getDate());
            if (cumple < hoyDate) cumple.setFullYear(hoyDate.getFullYear() + 1);
            const diff = Math.round((cumple - hoyDate) / (1000 * 60 * 60 * 24));
            const edad = hoyDate.getFullYear() - nac.getFullYear() + (diff === 0 ? 1 : 0);
            return (
              <button key={p.id} onClick={() => onAbrir(p.id)} style={{ background: '#fff', border: `1px solid ${T.dorado}`, borderRadius: 7, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: T.tinta }}>
                <strong>{p.nombre}</strong> <span style={{ color: T.tinta40 }}>{diff === 0 ? `¡hoy! ${edad}` : `en ${diff}d · ${edad}`} años</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Vista Pipeline */}
      {tab === 'pipeline' && (
        <>
          <div style={S.columnas}>
            {etapasActivas.map((etapa) => {
              const lista = porEtapa(etapa.id);
              const venc = vencidos(lista);
              return (
                <div key={etapa.id} style={S.columna}>
                  <div style={{ ...S.columnaHeader, borderBottom: `2px solid ${ETAPA_COLOR[etapa.id]}` }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: ETAPA_COLOR[etapa.id] }}>{etapa.label}</span>
                    <span style={{ fontSize: 11, color: T.tinta40, background: T.papel2, borderRadius: 10, padding: '1px 7px' }}>{lista.length}</span>
                    {venc.length > 0 && <span style={{ fontSize: 10, color: T.terracota, display: 'flex', alignItems: 'center', gap: 2 }}><Icon name="alert" size={10} />{venc.length}</span>}
                  </div>
                  <div style={S.columnaBody}>
                    {lista.map((p) => (
                      <TarjetaProspecto key={p.id} prospecto={p} onAbrir={() => onAbrir(p.id)} onMover={(e) => moverEtapa(p, e)} hoy={hoy} />
                    ))}
                    {lista.length === 0 && <div style={{ fontSize: 12, color: T.tinta40, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>—</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={S.colapsadoWrap}>
            {etapasColapsadas.map((etapa) => {
              const lista = porEtapa(etapa.id);
              if (lista.length === 0) return null;
              return (
                <details key={etapa.id} style={{ marginRight: 16 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12.5, color: ETAPA_COLOR[etapa.id], fontWeight: 600, padding: '6px 0', userSelect: 'none' }}>
                    {etapa.label} ({lista.length})
                  </summary>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {lista.map((p) => (
                      <div key={p.id} onClick={() => onAbrir(p.id)} style={{ background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{p.nombre || 'Sin nombre'}</div>
                        <div style={{ fontSize: 11, color: T.tinta40 }}>{p.rol}</div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}

      {/* Vista Seguimientos del día */}
      {tab === 'seguimientos' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {seguimientosHoy.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: T.tinta40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 14 }}>Sin seguimientos pendientes para hoy</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700 }}>
              {seguimientosHoy.map((p) => {
                const vencido = p.fechaAccion < hoy;
                return (
                  <div key={p.id} style={{ background: '#fff', border: `1px solid ${vencido ? T.terracota : T.borde}`, borderLeft: `3px solid ${vencido ? T.terracota : ETAPA_COLOR[p.estado] || T.borde}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer' }} onClick={() => onAbrir(p.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</span>
                        {p.rol && <span style={{ fontSize: 12, color: T.tinta40, marginLeft: 8 }}>{p.rol}</span>}
                      </div>
                      <span style={{ fontSize: 11.5, color: vencido ? T.terracota : T.tinta40, fontWeight: vencido ? 600 : 400 }}>
                        {vencido ? `Vencido ${p.fechaAccion}` : `Hoy · ${p.fechaAccion}`}
                      </span>
                    </div>
                    {p.accion && <div style={{ fontSize: 13, color: T.tinta60 }}>{p.accion}</div>}
                    <div style={{ fontSize: 11, color: ETAPA_COLOR[p.estado] || T.tinta40, marginTop: 4, fontWeight: 600 }}>
                      {ETAPAS.find(e => e.id === p.estado)?.label || p.estado} · {p.fuente}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaProspecto({ prospecto: p, onAbrir, onMover, hoy }) {
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const vencido = p.fechaAccion && p.fechaAccion < hoy;
  const tieneCartera = (p.polizasCartera || []).length > 0;
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
                <div key={e.id} style={S.menuItem} onClick={() => { onMover(e.id); setMostrarMenu(false); }}>
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
      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        {p.fuente && <span style={{ fontSize: 10.5, color: T.tinta40 }}>{p.fuente}</span>}
        {tieneCartera && <span style={{ fontSize: 10.5, color: T.sage, fontWeight: 600 }}>● {(p.polizasCartera || []).length} póliza{(p.polizasCartera || []).length !== 1 ? 's' : ''}</span>}
      </div>
      {p.accion && (
        <div style={{ marginTop: 7, fontSize: 12, color: vencido ? T.terracota : T.tinta60 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {vencido && <Icon name="alert" size={11} />}{p.accion}
          </span>
          {p.fechaAccion && <span style={{ fontSize: 11, color: vencido ? T.terracota : T.tinta40 }}>
            {new Date(p.fechaAccion + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
          </span>}
        </div>
      )}
    </div>
  );
}

function cargarScriptCartera(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${T.borde}`, gap: 10, flexShrink: 0, flexWrap: 'wrap' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 8, padding: '6px 12px', color: T.tinta40 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: T.tinta, width: 180 },
  filtroSelect: { border: `1px solid ${T.borde}`, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, background: '#fff', color: T.tinta, cursor: 'pointer' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: T.tinta, color: T.papel, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: T.tinta, border: `1px solid ${T.borde}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' },
  tabBar: { display: 'flex', borderBottom: `1px solid ${T.borde}`, padding: '0 20px', flexShrink: 0, background: T.papel },
  tabBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, cursor: 'pointer', color: T.tinta60, marginBottom: -1 },
  tabBtnActivo: { color: T.tinta, borderBottomColor: T.dorado, fontWeight: 600 },
  columnas: { display: 'flex', gap: 0, flex: 1, overflow: 'hidden' },
  columna: { flex: 1, minWidth: 190, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${T.borde}` },
  columnaHeader: { display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', flexShrink: 0 },
  columnaBody: { flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 7 },
  tarjeta: { background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 9, padding: '10px 12px', cursor: 'default', position: 'relative' },
  tarjetaNombre: { fontFamily: T.serif, fontSize: 13.5, fontWeight: 600, color: T.tinta },
  tarjetaRol: { fontSize: 11.5, color: T.tinta60, marginTop: 2 },
  menuBtn: { background: 'none', border: 'none', color: T.tinta40, fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  menuDrop: { position: 'absolute', right: 0, top: 24, background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 160, padding: '8px 0' },
  menuLabel: { fontSize: 10, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 14px' },
  menuItem: { fontSize: 13, padding: '7px 14px', cursor: 'pointer', color: T.tinta, display: 'flex', alignItems: 'center', gap: 8 },
  colapsadoWrap: { borderTop: `1px solid ${T.borde}`, padding: '10px 20px', flexShrink: 0, display: 'flex', gap: 20 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,46,41,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: T.papel, borderRadius: 14, padding: '26px 28px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
};
