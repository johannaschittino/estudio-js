import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import {
  uid, todayISO, nuevoProspecto,
  cargarProspectos, guardarProspecto, eliminarProspecto,
} from './data.js';
import { T } from './tokens.js';
import Login from './Login.jsx';
import Pipeline from './Pipeline.jsx';
import FichaProspecto from './FichaProspecto.jsx';
import Dashboard from './Dashboard.jsx';

/* ============================================================
   UTILIDADES COMPARTIDAS (usadas en PanelAnalisis)
   ============================================================ */
const calcEdad = (fechaNac) => {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac + 'T00:00:00');
  if (isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
};
const fmtUSD = (n) => {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};
const fmtPct = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n) + '%';
};
const numOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const s = String(v).trim();
  // Si tiene coma Y punto, determinar cuál es decimal por posición
  // Ej: "1.234,56" → punto=miles, coma=decimal
  // Ej: "261.53" → punto=decimal (solo un punto, menos de 3 dígitos después)
  // Ej: "1,234.56" → coma=miles, punto=decimal
  let normalizado;
  if (s.includes(',') && s.includes('.')) {
    // Ambos presentes — el último es el decimal
    const ultimaComa = s.lastIndexOf(',');
    const ultimoPunto = s.lastIndexOf('.');
    if (ultimaComa > ultimoPunto) {
      // Formato argentino: 1.234,56
      normalizado = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,234.56
      normalizado = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Solo coma — puede ser decimal (0,5) o miles (1,234)
    const partes = s.split(',');
    if (partes.length === 2 && partes[1].length <= 2) {
      normalizado = s.replace(',', '.'); // decimal
    } else {
      normalizado = s.replace(/,/g, ''); // miles
    }
  } else if (s.includes('.')) {
    // Solo punto — puede ser decimal (261.53) o miles (1.234)
    const partes = s.split('.');
    if (partes.length === 2 && partes[1].length <= 2) {
      normalizado = s; // decimal: "261.53" → 261.53
    } else {
      normalizado = s.replace(/\./g, ''); // miles: "1.234" → 1234
    }
  } else {
    normalizado = s;
  }
  const n = Number(normalizado);
  return isNaN(n) ? null : n;
};

/* ============================================================
   ICONOS
   ============================================================ */
const Icon = ({ name, size = 18, className = '' }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    back: 'M19 12H5M12 19l-7-7 7-7',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z',
    check: 'M20 6 9 17l-5-5',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5',
    alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    family: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={paths[name] || ''} />
    </svg>
  );
};

/* ============================================================
   CÁLCULO DE COMPROMISOS (usada en PanelAnalisis)
   ============================================================ */
function calcularAporteCompromisos(compromisos, horizonteAnios) {
  let total = 0;
  for (const cm of compromisos || []) {
    const anios = numOrNull(cm.anosRestantes);
    const monto = numOrNull(cm.montoAnualUSD);
    if (!anios || !monto) continue;
    const aniosVigentes = Math.min(anios, horizonteAnios);
    if (aniosVigentes > 0) total += monto * aniosVigentes;
  }
  return total;
}

/* ============================================================
   APP — gate de autenticación
   ============================================================ */
export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  if (user === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.papel, fontFamily: T.sans, color: T.tinta60 }}>
        Verificando sesión…
      </div>
    );
  }

  if (!user) return <Login />;
  return <EstudioApp user={user} />;
}

/* ============================================================
   ESTUDIO APP — lógica principal
   ============================================================ */
function EstudioApp({ user }) {
  const [prospectos, setProspectos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('pipeline'); // pipeline | ficha | analisis
  const [activoId, setActivoId] = useState(null);
  const [guardadoEstado, setGuardadoEstado] = useState('ok');

  useEffect(() => {
    (async () => {
      try {
        const p = await cargarProspectos(user.uid);
        setProspectos(p);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  }, [user.uid]);

  const persistir = useCallback((id, patch) => {
    setProspectos((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, ...patch, actualizadoEn: new Date().toISOString() } : p
      );
      const actualizado = next.find((p) => p.id === id);
      if (actualizado) {
        setGuardadoEstado('guardando');
        guardarProspecto(user.uid, actualizado)
          .then(() => setGuardadoEstado('ok'))
          .catch(() => setGuardadoEstado('error'));
      }
      return next;
    });
  }, [user.uid]);

  const crearProspecto = useCallback((nuevo) => {
    setProspectos((prev) => [nuevo, ...prev]);
    setGuardadoEstado('guardando');
    guardarProspecto(user.uid, nuevo)
      .then(() => setGuardadoEstado('ok'))
      .catch(() => setGuardadoEstado('error'));
    setActivoId(nuevo.id);
    setVista('ficha');
  }, [user.uid]);

  const eliminarP = useCallback((id) => {
    setProspectos((prev) => prev.filter((p) => p.id !== id));
    eliminarProspecto(id).catch(console.error);
    if (activoId === id) { setVista('pipeline'); setActivoId(null); }
  }, [activoId]);

  const activo = prospectos.find((p) => p.id === activoId) || null;

  if (cargando) {
    return (
      <div style={{ ...SApp.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{globalCSS}</style>
        <div style={{ color: T.tinta60 }}>Cargando tu cartera…</div>
      </div>
    );
  }

  return (
    <div style={SApp.app}>
      <style>{globalCSS}</style>

      {/* Top bar */}
      <header style={SApp.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {(vista === 'pipeline' || vista === 'dashboard') && (
            <button onClick={() => { setVista('pipeline'); setActivoId(null); }} style={SApp.iconBtn}>
              <Icon name="back" size={17} />
            </button>
          )}
          {vista !== 'pipeline' && vista !== 'dashboard' && (
            <button onClick={() => { setVista('pipeline'); setActivoId(null); }} style={SApp.iconBtn}>
              <Icon name="back" size={17} />
            </button>
          )}
          <span style={SApp.brandMark}>Estudio</span>
          {/* Navegación principal — solo visible en pipeline y dashboard */}
          {(vista === 'pipeline' || vista === 'dashboard') && (
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              <button
                onClick={() => setVista('pipeline')}
                style={{ ...SApp.navBtn, ...(vista === 'pipeline' ? SApp.navBtnActivo : {}) }}
              >
                Pipeline
              </button>
              <button
                onClick={() => setVista('dashboard')}
                style={{ ...SApp.navBtn, ...(vista === 'dashboard' ? SApp.navBtnActivo : {}) }}
              >
                Dashboard
              </button>
            </div>
          )}
          {activo && vista !== 'pipeline' && vista !== 'dashboard' && (
            <>
              <span style={{ color: T.tinta40, fontSize: 14 }}>›</span>
              <span style={{ fontFamily: T.serif, fontSize: 15 }}>{activo.nombre || 'Sin nombre'}</span>
              {vista === 'analisis' && (
                <>
                  <span style={{ color: T.tinta40, fontSize: 14 }}>›</span>
                  <span style={{ fontSize: 13, color: T.tinta60 }}>Análisis</span>
                </>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {vista === 'ficha' && activo && (
            <button style={SApp.btnPrimary} onClick={() => setVista('analisis')}>
              <Icon name="target" size={15} /> Ver análisis
            </button>
          )}
          {vista === 'analisis' && activo && (
            <button style={SApp.btnGhost} onClick={() => setVista('ficha')}>
              <Icon name="edit" size={14} /> Editar ficha
            </button>
          )}
          <span style={{ fontSize: 11, color: guardadoEstado === 'error' ? T.terracota : T.tinta40 }}>
            {guardadoEstado === 'guardando' ? 'Guardando…' : guardadoEstado === 'error' ? 'Error al guardar' : 'Guardado'}
          </span>
          <span style={{ fontSize: 11.5, color: T.tinta40 }}>{user.email}</span>
          <button onClick={() => signOut(auth)} style={SApp.iconBtn} title="Cerrar sesión">
            <Icon name="logout" size={15} />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <div style={{ ...SApp.body, overflowY: (vista === 'analisis' || vista === 'dashboard') ? 'auto' : 'hidden' }}>
        {vista === 'dashboard' && (
          <Dashboard prospectos={prospectos} />
        )}
        {vista === 'pipeline' && (
          <Pipeline
            prospectos={prospectos}
            onAbrir={(id) => { setActivoId(id); setVista('ficha'); }}
            onCreate={crearProspecto}
            onUpdate={(id, patch) => persistir(id, patch)}
            onEliminar={eliminarP}
          />
        )}
        {vista === 'ficha' && activo && (
          <FichaProspecto
            prospecto={activo}
            prospectos={prospectos}
            onUpdate={(patch) => persistir(activo.id, patch)}
            onVolver={() => { setVista('pipeline'); setActivoId(null); }}
            onIrAnalisis={() => setVista('analisis')}
            onCrearDesde={(datosIniciales) => {
              // Crear ficha nueva para un familiar, vinculada al prospecto actual
              const nuevo = { ...nuevoProspecto(), ...datosIniciales };
              // Vincular al prospecto actual también
              const vinculadosActualizados = [...(activo.vinculados || []), {
                id: nuevo.id,
                relacion: datosIniciales.vinculados?.[0]?.relacion === 'padre/madre' ? 'hijo/a' : 'cónyuge',
                nombre: nuevo.nombre,
              }];
              persistir(activo.id, { vinculados: vinculadosActualizados, grupoFamiliarId: activo.grupoFamiliarId || activo.id });
              crearProspecto(nuevo);
            }}
          />
        )}
        {vista === 'analisis' && activo && (
          <PanelAnalisis
            prospecto={activo}
            onUpdate={(patch) => persistir(activo.id, patch)}
            onVolverFicha={() => setVista('ficha')}
          />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS DE UI — usados en PanelAnalisis
   ============================================================ */
function Seccion({ icono, titulo, children }) {
  const paths = {
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    check: 'M20 6 9 17l-5-5',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6',
    coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
    family: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  };
  return (
    <section style={{ marginBottom: 30, paddingBottom: 26, borderBottom: `1px solid ${T.borde}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={T.dorado} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={paths[icono] || ''} />
        </svg>
        <h2 style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, margin: 0 }}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Grid({ cols, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '14px 16px' }}>{children}</div>;
}

function Campo({ label, span, children }) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label style={{ display: 'block', fontSize: 11, color: T.tinta40, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}

function PanelAnalisis({ prospecto, onUpdate, onVolverFicha }) {
  const [mostrarCarga, setMostrarCarga] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [primaDiscriminada, setPrimaDiscriminada] = useState(false);

  const ingresoNum = numOrNull(prospecto.finanzas.ingresoMensual);
  const tcNum = numOrNull(prospecto.tipoCambio.valor);
  const ingresoMensualUSD = prospecto.finanzas.monedaIngreso === 'USD'
    ? ingresoNum
    : (ingresoNum && tcNum ? ingresoNum / tcNum : null);
  const ingresoAnualUSD = ingresoMensualUSD ? ingresoMensualUSD * 12 : null;

  const compromisos = prospecto.compromisos || [];
  const aporteCompromisosMin = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 3) : 0;
  const aporteCompromisosMax = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 5) : 0;
  const aporteCompromisosCentro = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 4) : 0;

  const sumaIdealMin = ingresoAnualUSD ? ingresoAnualUSD * 3 + aporteCompromisosMin : null;
  const sumaIdealMax = ingresoAnualUSD ? ingresoAnualUSD * 5 + aporteCompromisosMax : null;
  const sumaIdealCentro = ingresoAnualUSD ? ingresoAnualUSD * 4 + aporteCompromisosCentro : null;

  const tieneCompromisosRelevantes = compromisos.some((cm) => numOrNull(cm.anosRestantes) && numOrNull(cm.montoAnualUSD));

  const primaTope = numOrNull(prospecto.finanzas.primaMaxima) || (ingresoMensualUSD ? ingresoMensualUSD * 0.1 : null);

  const totales = sumarCoberturas(cotizacionesDe(prospecto));

  // Totales de seguros previos (otras compañías) — se suman al análisis pero
  // se muestran en color diferente en las barras.
  const segurosPrevios = prospecto.segurosPrevios || [];
  const totalesPrevios = { vida: 0, itp: 0, enfermedadesCriticas: 0, muerteAccidental: 0 };
  for (const s of segurosPrevios) {
    const monto = numOrNull(s.sumaAseguradaUSD) || 0;
    if (totalesPrevios[s.tipo] !== undefined) totalesPrevios[s.tipo] += monto;
  }
  const tienePrevios = segurosPrevios.length > 0 && Object.values(totalesPrevios).some((v) => v > 0);
  const primaMensualTotal = cotizacionesDe(prospecto).reduce((acc, c) => acc + (c.primaMensualUSD || 0), 0);

  const vidaTotal = totales.vida + totalesPrevios.vida;
  const itpTotal = totales.itp + totalesPrevios.itp;
  const pctCobertura = sumaIdealCentro && vidaTotal
    ? Math.min(999, (vidaTotal / sumaIdealCentro) * 100)
    : (sumaIdealCentro ? 0 : null);
  const pctCoberturaPropia = sumaIdealCentro && totales.vida
    ? Math.min(999, (totales.vida / sumaIdealCentro) * 100)
    : 0;

  const pctPrima = primaTope ? (primaMensualTotal / primaTope) * 100 : null;

  const agregarCotizacion = (cotizacion) => {
    onUpdate({ cotizaciones: [...cotizacionesDe(prospecto), cotizacion] });
    setMostrarCarga(false);
  };

  const quitarCotizacion = (id) => {
    onUpdate({ cotizaciones: cotizacionesDe(prospecto).filter((c) => c.id !== id) });
  };

  const datosListos = ingresoMensualUSD !== null;

  return (
    <main style={S.main}>
      <div style={S.fichaHeader}>
        <div>
          <h1 style={S.h1}>{prospecto.nombre || prospecto.nombreCompleto || 'Cliente sin nombre'}</h1>
          <p style={S.heroSub}>
            {calcEdad(prospecto.fechaNacimiento) !== null ? `${calcEdad(prospecto.fechaNacimiento)} años · ` : ''}
            {prospecto.rol || prospecto.ocupacion || 'Sin ocupación cargada'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.btnGhostSm} onClick={onVolverFicha}><Icon name="edit" size={14} /> Editar ficha</button>
            <button
              style={{ ...S.btnPrimary, opacity: datosListos && cotizacionesDe(prospecto).length > 0 ? 1 : 0.5 }}
              disabled={!datosListos || cotizacionesDe(prospecto).length === 0 || generandoPDF}
              onClick={() => generarPDFCliente(prospecto, { sumaIdealMin, sumaIdealMax, sumaIdealCentro, primaTope, totales, totalesPrevios, tienePrevios, primaMensualTotal, pctCobertura, pctPrima, ingresoAnualUSD, ingresoMensualUSD, aporteCompromisosCentro, tieneCompromisosRelevantes, primaDiscriminada }, setGenerandoPDF)}
            >
              <Icon name="download" size={16} /> {generandoPDF ? 'Generando…' : 'Descargar PDF'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.tinta60, cursor: 'pointer' }}>
            <input type="checkbox" checked={primaDiscriminada} onChange={(e) => setPrimaDiscriminada(e.target.checked)} />
            Mostrar prima discriminada por producto en el PDF
          </label>
        </div>
      </div>

      {!datosListos && (
        <div style={S.avisoFalta}>
          <Icon name="alert" size={16} />
          <span>Faltan datos para calcular: cargá el ingreso mensual y el tipo de cambio en la ficha del prospecto.</span>
          <button style={{ ...S.btnGhostSm, marginLeft: 'auto' }} onClick={onVolverFicha}>Completar ficha</button>
        </div>
      )}

      {datosListos && (
        <>
          <Seccion icono="target" titulo="Suma asegurada ideal">
            <div style={S.sumaIdealRow}>
              <div>
                <div style={S.sumaIdealNumero}>{fmtUSD(sumaIdealMin)} — {fmtUSD(sumaIdealMax)}</div>
                <div style={{ fontSize: 12.5, color: T.tinta60 }}>
                  Entre 3 y 5 años de ingreso anual ({fmtUSD(ingresoAnualUSD)}/año)
                  {tieneCompromisosRelevantes && ' + los compromisos en el tiempo que cargaste'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: T.tinta40, textTransform: 'uppercase', letterSpacing: 0.3 }}>Punto medio de referencia</div>
                <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 600, color: T.dorado }}>{fmtUSD(sumaIdealCentro)}</div>
              </div>
            </div>
            {tieneCompromisosRelevantes && (
              <div style={S.compromisosNota}>
                <Icon name="clock" size={14} />
                <span>
                  De ese total, <strong>{fmtUSD(aporteCompromisosCentro)}</strong> corresponden a los compromisos en el tiempo de la ficha (universidad, créditos, proyectos) — no solo al ingreso actual.
                </span>
              </div>
            )}
          </Seccion>

          <Seccion icono="check" titulo="Qué cubre la propuesta cargada">
            {tienePrevios && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 11.5, color: T.tinta60 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: T.sage, display: 'inline-block' }} />
                  Seguros previos (otras compañías)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: T.dorado, display: 'inline-block' }} />
                  Tu propuesta
                </span>
              </div>
            )}
            <BarraApilada
              label="Vida / fallecimiento"
              valorPropio={totales.vida}
              valorPrevio={totalesPrevios.vida}
              metaUSD={sumaIdealCentro}
            />
            <BarraApilada
              label="Invalidez total y permanente"
              valorPropio={totales.itp}
              valorPrevio={totalesPrevios.itp}
              metaUSD={sumaIdealCentro}
            />
            <BarraCobertura
              label="Enfermedades críticas"
              valorUSD={totales.enfermedadesCriticas + (totalesPrevios.enfermedadesCriticas || 0)}
              metaUSD={null}
              pct={null}
              sinMeta
            />
            <BarraCobertura
              label="Muerte accidental (adicional)"
              valorUSD={totales.muerteAccidental + (totalesPrevios.muerteAccidental || 0)}
              metaUSD={null}
              pct={null}
              sinMeta
            />
            {totales.fondoRetiro > 0 && (
              <BarraCobertura
                label="Fondo de retiro proyectado"
                valorUSD={totales.fondoRetiro}
                metaUSD={null}
                pct={null}
                sinMeta
                esRetiro
              />
            )}
            {totales.tieneSalud && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span>Cobertura de salud</span>
                  <span style={{ fontFamily: T.mono, color: T.tinta60, fontSize: 12 }}>sumas en pesos</span>
                </div>
                {totales.modulosSalud.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '3px 0', borderBottom: `1px solid ${T.borde}` }}>
                    <span style={{ color: T.tinta60 }}>{m.nombre}</span>
                    <span style={{ fontFamily: T.mono }}>${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(m.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Detalle del plan de retiro con doble tasa */}
            {cotizacionesDe(prospecto).some((c) => c.fuente === 'origenes') && (() => {
              const cotRetiro = cotizacionesDe(prospecto).find((c) => c.fuente === 'origenes');
              const cobRetiro = cotRetiro?.coberturas?.find((c) => c.tipo === 'fondoRetiro' && c.extra);
              if (!cobRetiro?.extra) return null;
              const ex = cobRetiro.extra;
              return (
                <div style={{ background: T.papel2, borderRadius: 9, padding: '12px 14px', marginTop: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.tinta60, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }}>Detalle plan de retiro</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.tinta40 }}>Tasa garantizada (1%)</div>
                      <div style={{ fontFamily: T.mono, fontSize: 13 }}>{fmtUSD(cotRetiro.primaMensualUSD !== undefined ? numOrNull(cobRetiro.beneficio) : null) || fmtUSD(numOrNull(cobRetiro.beneficio))}</div>
                    </div>
                    {ex.fondoProyectado && (
                      <div>
                        <div style={{ fontSize: 11, color: T.tinta40 }}>Tasa proyectada (6%)</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13 }}>{fmtUSD(ex.fondoProyectado)}</div>
                      </div>
                    )}
                    {ex.rentaGarantizada && (
                      <div>
                        <div style={{ fontSize: 11, color: T.tinta40 }}>Renta mensual garantizada</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13 }}>{fmtUSD(ex.rentaGarantizada)}/mes</div>
                      </div>
                    )}
                    {ex.rentaProyectada && (
                      <div>
                        <div style={{ fontSize: 11, color: T.tinta40 }}>Renta mensual proyectada</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13 }}>{fmtUSD(ex.rentaProyectada)}/mes</div>
                      </div>
                    )}
                    {ex.edadRetiro && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ fontSize: 11, color: T.tinta40 }}>Edad de retiro</div>
                        <div style={{ fontFamily: T.mono, fontSize: 13 }}>{ex.edadRetiro} años</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={S.divider} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Prima mensual total</div>
                <div style={{ fontSize: 12, color: T.tinta60 }}>Tope recomendado: 10% del ingreso = {fmtUSD(primaTope)}/mes</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 600, color: pctPrima > 100 ? T.terracota : T.sage }}>
                  {fmtUSD(primaMensualTotal)}
                </div>
                <div style={{ fontSize: 11.5, color: pctPrima > 100 ? T.terracota : T.tinta40 }}>
                  {fmtPct(pctPrima)} del tope {pctPrima > 100 ? '— excede lo recomendado' : ''}
                </div>
              </div>
            </div>
          </Seccion>

          {tieneCompromisosRelevantes && (
            <Seccion icono="clock" titulo="Compromisos en el tiempo">
              {compromisos.filter((cm) => numOrNull(cm.anosRestantes) && numOrNull(cm.montoAnualUSD)).map((cm) => (
                <div key={cm.id} style={S.compromisoRow}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{cm.descripcion || TIPOS_COMPROMISO.find((t) => t.value === cm.tipo)?.label}</div>
                    <div style={{ fontSize: 12, color: T.tinta60 }}>{cm.anosRestantes} años restantes · {fmtUSD(numOrNull(cm.montoAnualUSD))}/año</div>
                  </div>
                  <div style={{ fontFamily: T.mono, fontSize: 13, color: T.dorado }}>
                    {fmtUSD(numOrNull(cm.montoAnualUSD) * Math.min(numOrNull(cm.anosRestantes), 4))}
                  </div>
                </div>
              ))}
            </Seccion>
          )}

          <Seccion icono="file" titulo="Cotizaciones cargadas">
            {cotizacionesDe(prospecto).length === 0 && <p style={S.vacioMsg}>Todavía no cargaste ninguna cotización para este prospecto.</p>}
            {cotizacionesDe(prospecto).map((c) => (
              <div key={c.id} style={S.cotizCard}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.fuente === 'life' ? 'Life Seguros' : c.fuente === 'origenes' ? 'Orígenes Retiro' : 'Carga manual'}</div>
                  <div style={{ fontSize: 12, color: T.tinta60 }}>{c.fecha} {c.archivoNombre ? `· ${c.archivoNombre}` : ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 13 }}>{fmtUSD(c.primaMensualUSD)}/mes</span>
                  <button style={S.iconBtnGhost} onClick={() => quitarCotizacion(c.id)}><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
            <button style={{ ...S.btnGhostSm, marginTop: 14 }} onClick={() => setMostrarCarga(true)}>
              <Icon name="upload" size={14} /> Cargar cotización
            </button>
          </Seccion>
        </>
      )}

      {mostrarCarga && (
        <ModalCargaCotizacion
          tcNum={tcNum}
          onCerrar={() => setMostrarCarga(false)}
          onConfirmar={agregarCotizacion}
        />
      )}
    </main>
  );
}

const cotizacionesDe = (prospecto) => prospecto.cotizaciones || [];

function sumarCoberturas(cotizaciones) {
  const acc = { vida: 0, itp: 0, enfermedadesCriticas: 0, muerteAccidental: 0, fondoRetiro: 0 };
  let saludARS = 0; // salud siempre en pesos originales
  const modulosSalud = []; // lista de módulos de salud para mostrar en el PDF
  for (const c of cotizaciones) {
    for (const cob of c.coberturas || []) {
      if (cob.tipo === 'salud') {
        saludARS += cob.beneficioOriginal || numOrNull(cob.beneficio) || 0;
        modulosSalud.push({ nombre: cob.nombre, monto: cob.beneficioOriginal || numOrNull(cob.beneficio) || 0 });
      } else if (acc[cob.tipo] !== undefined) {
        acc[cob.tipo] += cob.beneficioUSD || 0;
      }
    }
  }
  return { ...acc, saludARS, modulosSalud, tieneSalud: modulosSalud.length > 0 };
}

function BarraCobertura({ label, valorUSD, metaUSD, pct, sinMeta, esRetiro }) {
  const anchoPct = pct !== null && pct !== undefined ? Math.min(100, pct) : (valorUSD > 0 ? 100 : 0);
  const color = sinMeta ? (esRetiro ? T.dorado : T.tinta40) : (pct >= 100 ? T.sage : pct >= 50 ? T.dorado : T.terracota);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
        <span style={{ color: T.tinta }}>{label}</span>
        <span style={{ fontFamily: T.mono, color: T.tinta60 }}>
          {fmtUSD(valorUSD)}{!sinMeta && metaUSD ? ` · ${fmtPct(pct)} de la meta` : ''}
        </span>
      </div>
      <div style={S.barraTrack}>
        <div style={{ ...S.barraFill, width: `${anchoPct}%`, background: color }} />
      </div>
    </div>
  );
}

// Barra con dos capas: previos (verde sage) + propios (dorado), ambos contra la meta
function BarraApilada({ label, valorPropio, valorPrevio, metaUSD }) {
  const total = valorPropio + valorPrevio;
  const pctTotal = metaUSD ? Math.min(100, (total / metaUSD) * 100) : (total > 0 ? 100 : 0);
  const pctPrevio = metaUSD ? Math.min(100, (valorPrevio / metaUSD) * 100) : 0;
  const pctPropio = metaUSD ? Math.min(pctTotal - pctPrevio, 100 - pctPrevio) : (valorPropio > 0 ? 100 : 0);
  const colorTotal = metaUSD ? (pctTotal >= 100 ? T.sage : pctTotal >= 50 ? T.dorado : T.terracota) : T.dorado;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
        <span style={{ color: T.tinta }}>{label}</span>
        <div style={{ textAlign: 'right', fontFamily: T.mono, color: T.tinta60, fontSize: 12 }}>
          {valorPrevio > 0 && <span style={{ color: T.sage }}>{fmtUSD(valorPrevio)} prev. </span>}
          {valorPropio > 0 && <span style={{ color: T.dorado }}>+ {fmtUSD(valorPropio)} prop. </span>}
          {metaUSD && <span>· {fmtPct(pctTotal)} de la meta</span>}
        </div>
      </div>
      <div style={S.barraTrack}>
        {/* Capa previos (sage) */}
        {pctPrevio > 0 && (
          <div style={{ ...S.barraFill, width: `${pctPrevio}%`, background: T.sage, position: 'absolute' }} />
        )}
        {/* Capa propios (dorado) — arranca donde termina el previo */}
        {pctPropio > 0 && (
          <div style={{ ...S.barraFill, width: `${pctPropio}%`, background: T.dorado, marginLeft: `${pctPrevio}%`, position: 'absolute' }} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE CARGA DE COTIZACIÓN — extractor Life / Orígenes
   ============================================================ */

function ModalCargaCotizacion({ tcNum, onCerrar, onConfirmar }) {
  const [modo, setModo] = useState('elegir');
  const [fuente, setFuente] = useState('life');
  const [archivoNombre, setArchivoNombre] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [coberturas, setCoberturas] = useState([]);
  const [primaMensual, setPrimaMensual] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const fileInputRef = useRef(null);

  const onArchivoSeleccionado = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);
    setProcesando(true);
    setError('');
    try {
      let texto = '';
      if (file.type === 'application/pdf') {
        texto = await extraerTextoPDF(file);
      } else if (file.type.startsWith('image/')) {
        texto = await extraerTextoImagenViaIA(file);
      } else {
        throw new Error('Formato no soportado. Subí un PDF o una imagen (foto/captura).');
      }
      const resultado = fuente === 'life' ? parsearLife(texto) : parsearOrigenes(texto);
      if (!resultado || (resultado.coberturas.length === 0 && !resultado.primaMensual)) {
        throw new Error('No pude reconocer el formato. Revisá que sea una cotización de ' + (fuente === 'life' ? 'Life Seguros' : 'Orígenes (Plan Ardilla)') + ', o cargá los datos a mano.');
      }
      setCoberturas(resultado.coberturas);
      setPrimaMensual(resultado.primaMensual || '');
      setMoneda(resultado.moneda || 'USD');
      setModo('revisar');
    } catch (err) {
      setError(err.message || 'No pude leer el archivo. Probá cargar los datos a mano.');
    } finally {
      setProcesando(false);
    }
  };

  const confirmarCarga = () => {
    const primaNum = numOrNull(primaMensual) || 0;
    const primaUSD = moneda === 'USD' ? primaNum : (tcNum ? primaNum / tcNum : 0);
    const coberturasConvertidas = coberturas.map((c) => ({
      ...c,
      beneficioOriginal: numOrNull(c.beneficio) || 0,
      monedaOriginal: moneda,
      // Salud no entra en el cálculo de suma asegurada en USD —
      // sus sumas aseguradas son en pesos con ajuste por coeficiente.
      beneficioUSD: c.tipo === 'salud'
        ? 0
        : moneda === 'USD'
          ? numOrNull(c.beneficio) || 0
          : (tcNum ? (numOrNull(c.beneficio) || 0) / tcNum : 0),
    }));
    onConfirmar({
      id: uid(),
      fecha: todayISO(),
      fuente,
      archivoNombre,
      coberturas: coberturasConvertidas,
      primaMensualUSD: primaUSD,
      moneda,
    });
  };

  const actualizarCobertura = (idx, field, value) => {
    setCoberturas((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const quitarCobertura = (idx) => setCoberturas((prev) => prev.filter((_, i) => i !== idx));
  const agregarCoberturaManual = () => setCoberturas((prev) => [...prev, { nombre: '', beneficio: '', tipo: 'vida' }]);

  return (
    <div style={S.modalOverlay} onClick={onCerrar}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={{ fontFamily: T.serif, fontSize: 18, margin: 0 }}>Cargar cotización</h3>
          <button style={S.iconBtnGhost} onClick={onCerrar}>✕</button>
        </div>

        {modo === 'elegir' && (
          <div style={{ padding: '20px 0' }}>
            <Campo label="Producto">
              <select style={S.input} value={fuente} onChange={(e) => setFuente(e.target.value)}>
                <option value="life">Life Seguros (Solución Detallada)</option>
                <option value="origenes">Orígenes Retiro (Plan Ardilla)</option>
              </select>
            </Campo>

            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <button style={S.btnPrimary} onClick={() => fileInputRef.current?.click()} disabled={procesando}>
                <Icon name="upload" size={16} /> {procesando ? 'Leyendo…' : 'Subir PDF o foto'}
              </button>
              <button style={S.btnGhostSm} onClick={() => { setCoberturas([{ nombre: '', beneficio: '', tipo: 'vida' }]); setModo('revisar'); }}>
                Cargar a mano
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={onArchivoSeleccionado} />

            {error && (
              <div style={S.errorBox}>
                <Icon name="alert" size={14} /> {error}
                <button style={{ ...S.btnGhostSm, marginLeft: 'auto' }} onClick={() => { setCoberturas([{ nombre: '', beneficio: '', tipo: 'vida' }]); setError(''); setModo('revisar'); }}>
                  Cargar a mano
                </button>
              </div>
            )}
          </div>
        )}

        {modo === 'revisar' && (
          <div style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 12.5, color: T.tinta60, marginTop: 0 }}>
              Revisá los montos antes de confirmar — son los que va a usar el análisis.
            </p>
            <Grid cols={2}>
              <Campo label="Moneda de los montos">
                <select style={S.input} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                  <option value="USD">Dólares (USD)</option>
                  <option value="ARS">Pesos (ARS) — se convierte con el TC cargado</option>
                </select>
              </Campo>
              <Campo label="Prima mensual">
                <input type="text" inputMode="decimal" style={S.input} value={primaMensual} onChange={(e) => setPrimaMensual(e.target.value)} />
              </Campo>
            </Grid>

            <div style={{ fontSize: 11.5, color: T.tinta40, marginTop: -10, marginBottom: 14 }}>
              Se va a guardar como: <strong>{fmtUSD(moneda === 'USD' ? numOrNull(primaMensual) : (tcNum ? (numOrNull(primaMensual) || 0) / tcNum : null))}</strong> al confirmar.
            </div>

            <div style={{ marginTop: 16 }}>
              <span style={S.subTitulo}>Coberturas</span>
              {coberturas.map((c, i) => (
                <div key={i} style={S.coberturaRow}>
                  <input style={{ ...S.input, flex: 2 }} placeholder="Nombre" value={c.nombre} onChange={(e) => actualizarCobertura(i, 'nombre', e.target.value)} />
                  <input type="number" style={{ ...S.input, flex: 1 }} placeholder="Beneficio" value={c.beneficio} onChange={(e) => actualizarCobertura(i, 'beneficio', e.target.value)} />
                  <select style={{ ...S.input, flex: 1 }} value={c.tipo} onChange={(e) => actualizarCobertura(i, 'tipo', e.target.value)}>
                    <option value="vida">Vida</option>
                    <option value="itp">ITP</option>
                    <option value="enfermedadesCriticas">Enf. críticas</option>
                    <option value="muerteAccidental">Muerte accidental</option>
                    <option value="fondoRetiro">Fondo de retiro</option>
                    <option value="salud">Salud</option>
                    <option value="otro">Otro</option>
                  </select>
                  <button style={S.iconBtnGhost} onClick={() => quitarCobertura(i)}><Icon name="trash" size={14} /></button>
                </div>
              ))}
              <button style={{ ...S.btnGhostSm, marginTop: 8 }} onClick={agregarCoberturaManual}><Icon name="plus" size={13} /> Agregar fila</button>
            </div>

            {moneda === 'ARS' && !tcNum && (
              <p style={{ ...S.vacioMsg, color: T.terracota, marginTop: 12 }}>
                <Icon name="alert" size={13} /> No hay tipo de cambio cargado en la ficha — los montos no se van a poder dolarizar.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={S.btnGhostSm} onClick={() => setModo('elegir')}>Volver</button>
              <button style={S.btnPrimary} onClick={confirmarCarga}>Confirmar y agregar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   EXTRACCIÓN DE PDF (texto seleccionable)
   ============================================================ */

async function extraerTextoPDF(file) {
  if (!window.pdfjsLib) {
    await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let texto = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((it) => it.str).join(' ') + '\n';
  }
  if (!texto.trim()) {
    throw new Error('El PDF parece ser una imagen escaneada sin texto. Probá subiéndolo como foto.');
  }
  return texto;
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar un recurso necesario.'));
    document.head.appendChild(s);
  });
}

/* ============================================================
   EXTRACCIÓN DE IMAGEN — vía API de Claude (Sonnet con visión)
   ============================================================ */

async function extraerTextoImagenViaIA(file) {
  const base64 = await fileToBase64(file);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
          { type: 'text', text: 'Transcribí TODO el texto visible en esta imagen de una cotización de seguro, tal cual aparece, línea por línea, incluyendo etiquetas y valores numéricos. No interpretes ni resumas, solo transcribí el texto plano que ves.' }
        ]
      }]
    })
  });
  const data = await response.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  if (!textBlock || !textBlock.text) throw new Error('No pude leer el contenido de la imagen.');
  return textBlock.text;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = () => reject(new Error('No se pudo procesar el archivo.'));
    r.readAsDataURL(file);
  });
}

/* ============================================================
   PARSERS — Life Seguros / Orígenes
   ============================================================ */

function numDesdeTexto(s) {
  if (!s) return null;
  const limpio = s.replace(/\$/g, '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

function buscarMonto(texto, etiquetas) {
  for (const etq of etiquetas) {
    const re = new RegExp(etq + '\\s*\\$?\\s*([\\d.,]+)', 'i');
    const m = texto.match(re);
    if (m) {
      const n = numDesdeTexto(m[1]);
      if (n !== null) return n;
    }
  }
  return null;
}

function parsearLife(texto) {
  const coberturas = [];
  const mapaCoberturas = [
    { etiquetas: ['Vida Permanente \\d+', 'Vida Permanente'], tipo: 'vida', nombre: 'Vida Permanente' },
    { etiquetas: ['Beneficio por Muerte Accidental'], tipo: 'muerteAccidental', nombre: 'Muerte Accidental' },
    { etiquetas: ['Enfermedades Cr[ií]ticas'], tipo: 'enfermedadesCriticas', nombre: 'Enfermedades Críticas' },
    { etiquetas: ['Incapacidad Total y Permanente'], tipo: 'itp', nombre: 'Incapacidad Total y Permanente' },
    { etiquetas: ['Renta Diaria Internaci[oó]n por accidente'], tipo: 'otro', nombre: 'Renta Diaria por Internación' },
  ];

  for (const c of mapaCoberturas) {
    const monto = buscarMonto(texto, c.etiquetas);
    if (monto !== null && monto > 0) {
      coberturas.push({ nombre: c.nombre, beneficio: String(monto), tipo: c.tipo });
    }
  }

  // Módulos de salud: el PDF tiene nombres en columna izquierda y montos en columna derecha.
  // pdf.js puede extraer el texto de dos formas:
  // A) Todo junto en una línea: "Salud - Cáncer Integral $ 50.000.000,00"
  // B) Nombres primero, montos después (columnas separadas)
  // Manejamos ambos casos.

  // Paso 1: extraer todos los nombres de módulos de salud
  const nombresSalud = [];
  const regexNombreSalud = /Salud\s*[-–]\s*([^\n\r$\d]{3,60}?)(?=\s*(?:Salud|$|\n|\r|\$|\d))/gi;
  let matchNombre;
  while ((matchNombre = regexNombreSalud.exec(texto)) !== null) {
    const n = matchNombre[1].trim().replace(/\s+/g, ' ');
    if (n.length > 2) nombresSalud.push(n);
  }

  if (nombresSalud.length > 0) {
    // Paso 2: intentar extraer montos asociados a cada módulo en la misma línea
    let modulosEncontrados = 0;
    for (const nombre of nombresSalud) {
      const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reLinea = new RegExp(escapado + '\\s+\\$?\\s*([\\d.,]+)', 'i');
      const mLinea = texto.match(reLinea);
      if (mLinea) {
        const monto = numDesdeTexto(mLinea[1]);
        if (monto && monto > 0) {
          coberturas.push({ nombre: `Salud - ${nombre}`, beneficio: String(monto), tipo: 'salud' });
          modulosEncontrados++;
        }
      }
    }

    // Paso 3: si no encontramos montos en la misma línea (formato columnar),
    // buscamos los montos de beneficio que aparecen ANTES de la sección de prima,
    // excluyendo los montos de prima inicial (columna derecha del PDF de salud).
    if (modulosEncontrados === 0) {
      // Extraemos el bloque entre "Cobertura" y "Prima" para capturar solo los beneficios
      const bloqueCobertura = texto.match(/Cobertura[\s\S]*?(?=Prima\s|$)/i)?.[0] || texto;
      // Capturamos todos los montos grandes (beneficios) en orden de aparición
      const regexMontos = /\$\s*([\d.,]+)/g;
      const montos = [];
      let mMonto;
      while ((mMonto = regexMontos.exec(bloqueCobertura)) !== null) {
        const n = numDesdeTexto(mMonto[1]);
        // Filtramos montos pequeños (primas) vs grandes (beneficios): > 1000
        if (n && n > 1000) montos.push(n);
      }
      // Emparejamos nombres con montos por posición
      nombresSalud.forEach((nombre, idx) => {
        if (montos[idx]) {
          coberturas.push({ nombre: `Salud - ${nombre}`, beneficio: String(montos[idx]), tipo: 'salud' });
        } else {
          // Si no hay monto, igual agregamos el módulo sin beneficio para que aparezca
          coberturas.push({ nombre: `Salud - ${nombre}`, beneficio: '0', tipo: 'salud' });
        }
      });
    }
  }

  if (!coberturas.some((c) => c.tipo === 'vida')) {
    const totalBeneficio = buscarMonto(texto, ['Total Beneficio[^\\d]*']);
    if (totalBeneficio) coberturas.push({ nombre: 'Total Beneficio', beneficio: String(totalBeneficio), tipo: 'vida' });
  }

  const primaTotal = buscarMonto(texto, ['Prima Total']) || buscarMonto(texto, ['\\bPrima\\b(?!\\s*Total)']);
  const dicePesos = /moneda\s*:?\s*pesos?/i.test(texto) || /moneda\s*:?\s*ars\b/i.test(texto);
  const moneda = dicePesos ? 'ARS' : 'USD';

  return { coberturas, primaMensual: primaTotal ? String(primaTotal) : '', moneda };
}

function parsearOrigenes(texto) {
  const coberturas = [];

  // Capturar fondo garantizado (primera columna) y proyectado (segunda columna)
  // Formato: "Fondo Acumulado:   u$s 19.879,57   u$s 44.486,96"
  const matchFondos = texto.match(/Fondo Acumulado[:\s]*u?\$?s?\s*([\d.,]+)[^\d]*([\d.,]+)/i);
  const fondoGarantizado = matchFondos ? numDesdeTexto(matchFondos[1]) : null;
  const fondoProyectado = matchFondos ? numDesdeTexto(matchFondos[2]) : null;

  // También capturar renta mensual garantizada y proyectada
  const matchRenta = texto.match(/Renta Mensual[:\s]*u?\$?s?\s*([\d.,]+)[^\d]*([\d.,]+)/i);
  const rentaGarantizada = matchRenta ? numDesdeTexto(matchRenta[1]) : null;
  const rentaProyectada = matchRenta ? numDesdeTexto(matchRenta[2]) : null;

  // Edad de retiro y aporte mensual
  const matchEdadRetiro = texto.match(/Edad\s+Retiro[:\s]*(\d+)/i);
  const edadRetiro = matchEdadRetiro ? parseInt(matchEdadRetiro[1]) : null;
  const matchFechaNac = texto.match(/Fecha\s+Nacimiento[^:]*:\s*(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);

  if (fondoGarantizado) {
    coberturas.push({
      nombre: 'Fondo de retiro — tasa garantizada (1%)',
      beneficio: String(fondoGarantizado),
      tipo: 'fondoRetiro',
      extra: {
        fondoProyectado: fondoProyectado || null,
        rentaGarantizada: rentaGarantizada || null,
        rentaProyectada: rentaProyectada || null,
        edadRetiro: edadRetiro || null,
        tasaGarantizada: 1,
        tasaProyectada: 6,
      }
    });
  } else {
    // Fallback al regex original si no captura la doble columna
    const matchFondo = texto.match(/Fondo Acumulado[:\s]*u?\$?s?\s*([\d.,]+)/i);
    const fondo = matchFondo ? numDesdeTexto(matchFondo[1]) : null;
    if (fondo) coberturas.push({ nombre: 'Fondo Acumulado (proyección garantizada)', beneficio: String(fondo), tipo: 'fondoRetiro' });
  }

  const aporteMensual = buscarMonto(texto, ['Aporte Mensual']);
  const moneda = /d[oó]lares/i.test(texto) ? 'USD' : 'ARS';

  return { coberturas, primaMensual: aporteMensual ? String(aporteMensual) : '', moneda };
}

/* ============================================================
   ANÁLISIS NARRATIVO — etapa de vida, faltantes, deducción
   ============================================================ */

function calcularEtapaDeVida(prospecto, edad) {
  const tieneHijosChicos = (prospecto.hijos || []).some((h) => numOrNull(h.edad) !== null && numOrNull(h.edad) < 18);
  const tieneHijosUniv = (prospecto.hijos || []).some((h) => h.escolaridad === 'universidad' || (numOrNull(h.edad) !== null && numOrNull(h.edad) >= 18));
  const tieneConyuge = !!prospecto.conyuge;
  const tieneCredito = !!(prospecto.finanzas?.creditosActivos && prospecto.finanzas.creditosActivos.trim());

  if (edad !== null && edad < 30 && !tieneConyuge && (prospecto.hijos || []).length === 0) {
    return 'Estás construyendo las bases de tu vida adulta — esta es la etapa donde una protección se contrata más barata y se sostiene por más años, justamente porque la edad todavía juega a tu favor.';
  }
  if (tieneHijosChicos) {
    return 'Tenés hijos que dependen de tu ingreso para crecer, estudiar y sostener su día a día. Esta etapa es el momento donde la cobertura tiene el impacto más directo: protege años de crianza que todavía están por delante.';
  }
  if (tieneCredito && !tieneHijosChicos) {
    return 'Estás en una etapa de construcción patrimonial — con compromisos financieros en marcha que tu familia no debería tener que afrontar sola si algo te pasara.';
  }
  if (tieneHijosUniv) {
    return 'Tus hijos están en la etapa de formarse para su futuro profesional — un momento donde sostener el plan educativo ya armado es tan importante como en cualquier otra etapa.';
  }
  if (edad !== null && edad >= 50) {
    return 'Estás en la etapa de consolidar lo construido y empezar a pensar en el retiro — el momento de revisar que la cobertura siga acompañando tu patrimonio actual, no la situación de hace diez años.';
  }
  return 'Estás en una etapa de tu vida donde anticiparte tiene más valor que reaccionar — la protección que armes hoy es la que tu familia va a agradecer en el momento menos pensado.';
}

function calcularFaltantes(totales, finanzas) {
  const faltantes = [];
  if (!totales.fondoRetiro || totales.fondoRetiro === 0) {
    faltantes.push({
      titulo: 'Plan de retiro',
      texto: 'Hoy estás construyendo tu presente — sumar un plan de retiro es la forma de empezar a construir, también desde ahora, los años en los que vas a querer vivir con la misma tranquilidad sin depender de seguir trabajando.',
    });
  }
  if (!totales.tieneSalud && (!finanzas?.otrosSeguros || !finanzas.otrosSeguros.trim())) {
    faltantes.push({
      titulo: 'Cobertura de salud',
      texto: 'Una cobertura de salud complementaria es otra capa de tranquilidad que vale la pena conversar más adelante, cuando el perfil y las prioridades lo permitan.',
    });
  }
  return faltantes;
}

function calcularDeduccion(prospecto, calc) {
  const dg = prospecto.deduccionGanancias || {};
  const items = [];
  if (numOrNull(dg.topeVidaYAhorro)) items.push({ nombre: 'Seguro de vida con ahorro', tope: numOrNull(dg.topeVidaYAhorro) });
  if (numOrNull(dg.topeVidaPuro)) items.push({ nombre: 'Seguro de vida puro', tope: numOrNull(dg.topeVidaPuro) });
  if (numOrNull(dg.topeRetiro)) items.push({ nombre: 'Seguro de retiro', tope: numOrNull(dg.topeRetiro) });
  return items;
}

/* ============================================================
   GENERACIÓN DE PDF PARA EL CLIENTE
   ============================================================ */

async function generarPDFCliente(prospecto, calc, setGenerando) {
  setGenerando(true);
  try {
    if (!window.jspdf) {
      await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 50;
    const BOTTOM = H - 70;
    let y = 0;

    const colTinta = [26, 46, 41];
    const colDorado = [201, 162, 75];
    const colSage = [61, 107, 79];
    const colTerracota = [181, 72, 61];
    const colGris = [120, 120, 110];
    const colPapel2 = [244, 240, 230];
    const colBorde = [200, 196, 186];

    const edad = calcEdad(prospecto.fechaNacimiento);
    const nombrePila = (prospecto.nombre || prospecto.nombreCompleto || 'tu prospecto').split(' ')[0];

    const nuevaPagina = () => {
      doc.addPage();
      y = 60;
    };
    const asegurarEspacio = (necesario) => {
      if (y + necesario > BOTTOM) nuevaPagina();
    };
    const encabezadoSeccion = (titulo) => {
      asegurarEspacio(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(...colTinta);
      doc.text(titulo, M, y);
      y += 6;
      doc.setDrawColor(...colDorado);
      doc.setLineWidth(1.2);
      doc.line(M, y, M + 28, y);
      y += 20;
    };
    const parrafo = (texto, opts = {}) => {
      doc.setFont(opts.font || 'helvetica', opts.style || 'normal');
      doc.setFontSize(opts.size || 10.5);
      doc.setTextColor(...(opts.color || colTinta));
      const lines = doc.splitTextToSize(texto, opts.width || (W - M * 2));
      asegurarEspacio(lines.length * (opts.lineHeight || 15) + 6);
      doc.text(lines, M, y);
      y += lines.length * (opts.lineHeight || 15) + (opts.marginBottom ?? 10);
    };

    // ---------- Portada / header ----------
    doc.setFillColor(...colTinta);
    doc.rect(0, 0, W, 110, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.text('Análisis de cobertura', M, 44);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(prospecto.nombre || prospecto.nombreCompleto || 'Cliente', M, 68);
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 215);
    doc.text(`Preparado por Johanna Schittino · Life Advisor · ${new Date().toLocaleDateString('es-AR')}`, M, 88);

    y = 145;

    // ---------- Introducción emocional ----------
    parrafo(
      `Este análisis acompaña la forma en que tu familia sigue adelante, pase lo que pase, con el mismo plan de vida que armaron juntos.`,
      { font: 'times', style: 'italic', size: 13, lineHeight: 17, marginBottom: 18 }
    );

    // ---------- Etapa de vida ----------
    encabezadoSeccion('Tu momento');
    parrafo(calcularEtapaDeVida(prospecto, edad), { marginBottom: 4 });
    parrafo(
      'Hoy es el mejor momento para contratar: cada año que pasa, la cobertura cuesta más y tu margen para decidir con calma es más chico. Adelantarte ahora es la forma más simple de pagar menos por más años de protección.',
      { color: colGris, size: 9.5, marginBottom: 18 }
    );

    // ---------- Situación actual ----------
    encabezadoSeccion('Tu situación hoy');
    const filas = [
      ['Edad', edad !== null ? `${edad} años` : '—'],
      ['Ingreso mensual estimado', fmtUSD(calc.ingresoMensualUSD)],
      ['Ingreso anual estimado', fmtUSD(calc.ingresoAnualUSD)],
    ];
    doc.setFontSize(10.5);
    filas.forEach(([k, v]) => {
      asegurarEspacio(17);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colGris);
      doc.text(k, M, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colTinta);
      doc.text(String(v), M + 190, y);
      y += 17;
    });
    y += 12;

    // ---------- Suma asegurada ideal ----------
    encabezadoSeccion('Tu suma asegurada ideal');
    const textoSuma = calc.tieneCompromisosRelevantes
      ? 'Entre 3 y 5 años de tu ingreso anual, más los compromisos que ya tenés en marcha (educación, créditos, proyectos) — así la cifra refleja no solo tu presente, sino lo que tu familia va a necesitar sostener en los próximos años.'
      : 'Entre 3 y 5 años de tu ingreso anual: el estándar que te permite mantener tu nivel de vida y el de tu familia sin depender de que todo salga como hoy.';
    parrafo(textoSuma, { color: colGris, size: 10, marginBottom: 6 });
    asegurarEspacio(34);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...colDorado);
    doc.text(`${fmtUSD(calc.sumaIdealMin)} — ${fmtUSD(calc.sumaIdealMax)}`, M, y);
    y += 32;

    // ---------- Qué cubre la propuesta ----------
    encabezadoSeccion('Lo que ya tenés cubierto');
    const dibujarBarra = (label, valor, meta, esPct) => {
      asegurarEspacio(34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colTinta);
      doc.text(label, M, y);
      const valStr = fmtUSD(valor) + (meta ? `  ·  ${fmtPct(esPct)} de la meta` : '');
      doc.setTextColor(...colGris);
      doc.text(valStr, W - M, y, { align: 'right' });
      y += 8;
      const barW = W - M * 2;
      doc.setFillColor(...colPapel2);
      doc.roundedRect(M, y, barW, 7, 3, 3, 'F');
      const pctFill = meta ? Math.min(100, (valor / meta) * 100) : (valor > 0 ? 100 : 0);
      const color = !meta ? colDorado : (pctFill >= 100 ? colSage : pctFill >= 50 ? colDorado : colTerracota);
      doc.setFillColor(...color);
      if (pctFill > 0) doc.roundedRect(M, y, (barW * pctFill) / 100, 7, 3, 3, 'F');
      y += 26;
    };

    // Función de barra apilada para el PDF (previos en sage + propios en dorado)
    const dibujarBarraApilada = (label, valorPropio, valorPrevio, meta) => {
      const total = valorPropio + valorPrevio;
      asegurarEspacio(34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colTinta);
      doc.text(label, M, y);
      const pctTotal = meta ? Math.min(100, (total / meta) * 100) : (total > 0 ? 100 : 0);
      let valStr = fmtUSD(total);
      if (meta) valStr += `  ·  ${fmtPct(pctTotal)} de la meta`;
      doc.setTextColor(...colGris);
      doc.text(valStr, W - M, y, { align: 'right' });
      y += 8;
      const barW = W - M * 2;
      doc.setFillColor(...colPapel2);
      doc.roundedRect(M, y, barW, 7, 3, 3, 'F');
      // Capa previos (sage)
      if (valorPrevio > 0) {
        const pctP = meta ? Math.min(100, (valorPrevio / meta) * 100) : 50;
        doc.setFillColor(...colSage);
        doc.roundedRect(M, y, (barW * pctP) / 100, 7, 3, 3, 'F');
      }
      // Capa propios (dorado), arranca donde termina el previo
      if (valorPropio > 0) {
        const pctPrev = meta ? Math.min(100, (valorPrevio / meta) * 100) : 0;
        const pctProp = meta ? Math.min(pctTotal - pctPrev, 100 - pctPrev) : (valorPropio > 0 ? 100 : 0);
        if (pctProp > 0) {
          doc.setFillColor(...colDorado);
          doc.roundedRect(M + (barW * pctPrev) / 100, y, (barW * pctProp) / 100, 7, 3, 3, 'F');
        }
      }
      y += 26;
    };

    dibujarBarraApilada('Vida / fallecimiento', calc.totales.vida, (calc.totalesPrevios?.vida || 0), calc.sumaIdealCentro);
    dibujarBarraApilada('Invalidez total y permanente', calc.totales.itp, (calc.totalesPrevios?.itp || 0), calc.sumaIdealCentro);
    if ((calc.totales.enfermedadesCriticas + (calc.totalesPrevios?.enfermedadesCriticas || 0)) > 0)
      dibujarBarra('Enfermedades críticas', calc.totales.enfermedadesCriticas + (calc.totalesPrevios?.enfermedadesCriticas || 0), null, null);
    if ((calc.totales.muerteAccidental + (calc.totalesPrevios?.muerteAccidental || 0)) > 0)
      dibujarBarra('Muerte accidental (adicional)', calc.totales.muerteAccidental + (calc.totalesPrevios?.muerteAccidental || 0), null, null);
    if (calc.totales.fondoRetiro > 0) dibujarBarra('Fondo de retiro proyectado (tasa garantizada)', calc.totales.fondoRetiro, null, null);

    // Leyenda de colores si hay previos
    if (calc.tienePrevios) {
      asegurarEspacio(20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colSage);
      doc.text('■ Seguros previos (otras compañías)', M, y);
      doc.setTextColor(...colDorado);
      doc.text('■ Tu propuesta', M + 180, y);
      y += 16;
    }

    // Seguros previos — mención en texto
    if (calc.tienePrevios && (prospecto.segurosPrevios || []).length > 0) {
      asegurarEspacio(20 + prospecto.segurosPrevios.length * 15);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colTinta);
      doc.text('Seguros vigentes de otras compañías', M, y);
      y += 14;
      (prospecto.segurosPrevios || []).forEach((s) => {
        const monto = numOrNull(s.sumaAseguradaUSD);
        if (!monto) return;
        asegurarEspacio(15);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...colGris);
        const tipoLabel = { vida: 'Vida', itp: 'ITP', enfermedadesCriticas: 'Enf. críticas', muerteAccidental: 'Muerte accidental', otro: 'Otro' }[s.tipo] || s.tipo;
        doc.text(`${s.compania || 'Compañía no especificada'} — ${tipoLabel}`, M + 8, y);
        doc.setTextColor(...colSage);
        doc.text(fmtUSD(monto), W - M, y, { align: 'right' });
        y += 15;
      });
      y += 8;
    }

    // Salud en pesos — sección separada, no barra en USD
    if (calc.totales.tieneSalud) {
      asegurarEspacio(20 + calc.totales.modulosSalud.length * 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...colTinta);
      doc.text('Cobertura de salud', M, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...colGris);
      doc.text('sumas aseguradas en pesos', W - M, y, { align: 'right' });
      y += 14;
      calc.totales.modulosSalud.forEach((mod) => {
        asegurarEspacio(16);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...colGris);
        doc.text(mod.nombre, M + 8, y);
        doc.setTextColor(...colTinta);
        doc.text(`$${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(mod.monto)}`, W - M, y, { align: 'right' });
        y += 15;
      });
    }
    y += 8;

    // ---------- Detalle plan de retiro ----------
    const cotRetiro = (prospecto.cotizaciones || []).find((c) => c.fuente === 'origenes');
    const cobRetiro = cotRetiro?.coberturas?.find((c) => c.tipo === 'fondoRetiro' && c.extra);
    if (cobRetiro?.extra) {
      const ex = cobRetiro.extra;
      asegurarEspacio(90);
      doc.setFillColor(...colPapel2);
      doc.roundedRect(M, y, W - M * 2, 76, 6, 6, 'F');
      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...colTinta);
      doc.text('Plan de retiro — detalle de proyecciones', M + 10, y);
      y += 16;
      const cols = [];
      cols.push(['Fondo acumulado (1% garantizado)', fmtUSD(numOrNull(cobRetiro.beneficio))]);
      if (ex.fondoProyectado) cols.push(['Fondo acumulado (6% proyectado)', fmtUSD(ex.fondoProyectado)]);
      if (ex.rentaGarantizada) cols.push(['Renta mensual garantizada', fmtUSD(ex.rentaGarantizada) + '/mes']);
      if (ex.rentaProyectada) cols.push(['Renta mensual proyectada (6%)', fmtUSD(ex.rentaProyectada) + '/mes']);
      if (ex.edadRetiro) cols.push(['Edad de retiro', `${ex.edadRetiro} años`]);
      const colW = (W - M * 2 - 20) / 2;
      cols.forEach(([k, v], idx) => {
        const cx = M + 10 + (idx % 2) * colW;
        if (idx % 2 === 0 && idx > 0) y += 16;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...colGris);
        doc.text(k, cx, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...colTinta);
        doc.text(v, cx, y + 11);
      });
      y += 28;
    }

    // ---------- Prima mensual ----------
    encabezadoSeccion('Tu inversión mensual');
    parrafo(`Tope recomendado: hasta el 10% de tu ingreso mensual, equivalente a ${fmtUSD(calc.primaTope)}.`, { color: colGris, size: 10, marginBottom: 6 });

    if (calc.primaDiscriminada && (prospecto.cotizaciones || []).length > 1) {
      // Mostrar desglose por producto
      (prospecto.cotizaciones || []).forEach((cot) => {
        asegurarEspacio(17);
        const nombreProd = cot.fuente === 'life' ? 'Life Seguros — seguro de vida' : cot.fuente === 'origenes' ? 'Orígenes — plan de retiro' : (cot.archivoNombre || 'Otro producto');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...colTinta);
        doc.text(nombreProd, M, y);
        doc.setTextColor(...colGris);
        doc.text(fmtUSD(cot.primaMensualUSD) + '/mes', W - M, y, { align: 'right' });
        y += 17;
      });
      asegurarEspacio(26);
      doc.setDrawColor(...colBorde);
      doc.line(M, y - 4, W - M, y - 4);
    }
    asegurarEspacio(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const colorPrima = calc.pctPrima > 100 ? colTerracota : colSage;
    doc.setTextColor(...colorPrima);
    doc.text(`${fmtUSD(calc.primaMensualTotal)} / mes`, M, y);
    y += 30;

    // ---------- Compromisos en el tiempo ----------
    if (calc.tieneCompromisosRelevantes) {
      encabezadoSeccion('Lo que estás construyendo en el tiempo');
      parrafo('Más allá de tu ingreso de hoy, esto es lo que tu plan está acompañando a futuro:', { color: colGris, size: 9.5, marginBottom: 8 });
      for (const cm of prospecto.compromisos || []) {
        const anios = numOrNull(cm.anosRestantes);
        const monto = numOrNull(cm.montoAnualUSD);
        if (!anios || !monto) continue;
        asegurarEspacio(17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...colTinta);
        doc.text(`${cm.descripcion || 'Compromiso'} — ${anios} años por delante`, M, y);
        doc.setTextColor(...colGris);
        doc.text(`${fmtUSD(monto)}/año`, W - M, y, { align: 'right' });
        y += 17;
      }
      y += 10;
    }

    // ---------- Deducción de Ganancias ----------
    const itemsDeduccion = calcularDeduccion(prospecto, calc);
    if (itemsDeduccion.length > 0) {
      encabezadoSeccion('Un beneficio adicional: deducción de Ganancias');
      parrafo(
        'Lo que destinás a tu protección también puede jugar a tu favor en tu declaración anual. Estos son los topes vigentes que se aplican a tu plan:',
        { color: colGris, size: 9.5, marginBottom: 8 }
      );
      itemsDeduccion.forEach((it) => {
        asegurarEspacio(17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...colTinta);
        doc.text(it.nombre, M, y);
        doc.setTextColor(...colGris);
        doc.text(`tope anual: $${new Intl.NumberFormat('es-AR').format(it.tope)}`, W - M, y, { align: 'right' });
        y += 17;
      });
      y += 8;
    }

    // ---------- Lo que podés sumar ----------
    const faltantes = calcularFaltantes(calc.totales, prospecto.finanzas);
    if (faltantes.length > 0) {
      encabezadoSeccion('Lo que podés sumar a tu plan');
      faltantes.forEach((f) => {
        asegurarEspacio(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...colTinta);
        doc.text(f.titulo, M, y);
        y += 14;
        parrafo(f.texto, { color: colGris, size: 9.5, marginBottom: 12 });
      });
    }

    // ---------- Acompañamiento continuo ----------
    encabezadoSeccion('Mi acompañamiento');
    parrafo(
      `Este análisis es un punto de partida, no un cierre. Vamos a revisarlo juntos de forma periódica para que tu suma asegurada siga representando tu realidad — si cambia tu ingreso, tu familia crece, o aparece un nuevo proyecto, tu plan se actualiza con vos. Mi trabajo es que esta protección siempre tenga sentido para la vida que estás viviendo, no para la de hace cinco años.`,
      { marginBottom: 4 }
    );

    // ---------- Footer en cada página ----------
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...colGris);
      doc.text(
        'Los montos en pesos fueron dolarizados al tipo de cambio oficial mayorista cargado al momento del análisis. Este documento es una herramienta de planificación y no reemplaza las condiciones contractuales de la póliza.',
        M, H - 40, { maxWidth: W - M * 2 }
      );
      doc.text(`${p} / ${totalPaginas}`, W - M, H - 40, { align: 'right' });
    }

    const nombreArchivo = `Analisis-${(prospecto.nombre || prospecto.nombreCompleto || 'prospecto').replace(/\s+/g, '-')}-${todayISO()}.pdf`;
    doc.save(nombreArchivo);
  } catch (e) {
    alert('No se pudo generar el PDF: ' + e.message);
  } finally {
    setGenerando(false);
  }
}

/* ============================================================
   CSS GLOBAL Y ESTILOS
   ============================================================ */

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
::selection { background: ${T.doradoSoft}; }
.empty-icon { color: ${T.tinta40}; }
.seccion-icon { color: ${T.dorado}; }
button { cursor: pointer; font-family: ${T.sans}; }
input, select, textarea { font-family: ${T.sans}; }
input:focus, select:focus, textarea:focus { outline: 2px solid ${T.dorado}; outline-offset: 1px; }
`;

const S = {
  app: { minHeight: '100vh', background: T.papel, fontFamily: T.sans, color: T.tinta },
  topbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 28px', borderBottom: `1px solid ${T.borde}`, position: 'sticky', top: 0,
    background: 'rgba(251,249,244,0.92)', backdropFilter: 'blur(8px)', zIndex: 10,
  },
  brandMark: { fontFamily: T.serif, fontSize: 19, fontWeight: 600, letterSpacing: -0.2 },
  brandSub: { fontFamily: T.sans, fontSize: 12, color: T.tinta40, letterSpacing: 0.2 },
  iconBtn: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tinta },
  iconBtnGhost: { background: 'none', border: 'none', color: T.tinta40, padding: 4, borderRadius: 6 },
  main: { maxWidth: 1100, margin: '0 auto', padding: '40px 28px 80px' },
  heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, gap: 20, flexWrap: 'wrap' },
  h1: { fontFamily: T.serif, fontSize: 32, fontWeight: 600, margin: 0, letterSpacing: -0.3 },
  heroSub: { color: T.tinta60, fontSize: 14.5, maxWidth: 480, marginTop: 8, lineHeight: 1.55 },
  btnPrimary: {
    display: 'flex', alignItems: 'center', gap: 8, background: T.tinta, color: T.papel,
    border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 14, fontWeight: 600,
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', border: `1px dashed ${T.borde}`, borderRadius: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 },
  card: {
    background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 12, padding: '18px 18px 16px',
    position: 'relative', cursor: 'pointer',
  },
  cardName: { fontFamily: T.serif, fontSize: 16.5, fontWeight: 600 },
  cardMeta: { fontSize: 12.5, color: T.tinta60, marginTop: 3 },
  cardDivider: { height: 1, background: T.borde, margin: '12px 0' },
  confirmBox: { position: 'absolute', inset: 0, background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, border: `1px solid ${T.terracota}` },
  btnDanger: { background: T.terracota, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12.5, fontWeight: 600 },
  btnGhostSm: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 7, padding: '7px 14px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5, color: T.tinta },

  fichaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, marginBottom: 30, flexWrap: 'wrap' },
  inputHero: { fontFamily: T.serif, fontSize: 26, fontWeight: 600, border: 'none', borderBottom: `2px solid ${T.borde}`, background: 'transparent', padding: '4px 0', width: '100%', color: T.tinta },
  labelXs: { display: 'block', fontSize: 11, color: T.tinta40, marginBottom: 5, letterSpacing: 0.3, textTransform: 'uppercase' },
  input: { width: '100%', border: `1px solid ${T.borde}`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, background: '#fff', color: T.tinta },
  inputReadonly: { width: '100%', border: `1px solid transparent`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, background: T.papel2, color: T.tinta60, fontFamily: T.mono },
  textarea: { width: '100%', border: `1px solid ${T.borde}`, borderRadius: 7, padding: '8px 10px', fontSize: 13.5, minHeight: 64, fontFamily: T.sans, resize: 'vertical', color: T.tinta },
  inputConSelector: { display: 'flex', border: `1px solid ${T.borde}`, borderRadius: 7, overflow: 'hidden', background: '#fff' },
  inputSinBorde: { flex: 1, border: 'none', padding: '8px 10px', fontSize: 13.5, minWidth: 0 },
  selectorInline: { border: 'none', borderLeft: `1px solid ${T.borde}`, background: T.papel2, fontSize: 12.5, padding: '0 8px', color: T.tinta60 },

  seccion: { marginBottom: 30, paddingBottom: 26, borderBottom: `1px solid ${T.borde}` },
  seccionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
  seccionTitulo: { fontFamily: T.serif, fontSize: 18, fontWeight: 600, margin: 0 },
  subTitulo: { fontSize: 12.5, fontWeight: 600, color: T.tinta60, letterSpacing: 0.3, textTransform: 'uppercase' },
  vacioMsg: { fontSize: 13, color: T.tinta40, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 },
  hijoCard: { background: T.papel2, borderRadius: 9, padding: 14, marginBottom: 10 },

  avisoFalta: { display: 'flex', alignItems: 'center', gap: 10, background: T.terracotaSoft, border: `1px solid rgba(181,72,61,0.25)`, color: T.terracota, borderRadius: 10, padding: '12px 16px', fontSize: 13.5, marginBottom: 28 },

  sumaIdealRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 },
  sumaIdealNumero: { fontFamily: T.mono, fontSize: 24, fontWeight: 600, color: T.tinta },
  compromisosNota: { display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, padding: '10px 14px', background: T.doradoSoft, borderRadius: 9, fontSize: 12.5, color: T.tinta, lineHeight: 1.5 },
  compromisoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${T.borde}` },

  barraTrack: { height: 9, background: T.papel2, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  barraFill: { height: '100%', borderRadius: 5, transition: 'width 0.3s' },

  divider: { height: 1, background: T.borde, margin: '20px 0' },

  cotizCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,46,41,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: T.papel, borderRadius: 14, padding: '22px 26px', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borde}`, paddingBottom: 12 },

  errorBox: { display: 'flex', alignItems: 'center', gap: 8, background: T.terracotaSoft, color: T.terracota, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginTop: 14, flexWrap: 'wrap' },

  coberturaRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
};

const SApp = {
  app: { height: '100vh', display: 'flex', flexDirection: 'column', background: T.papel, fontFamily: T.sans, color: T.tinta, overflow: 'hidden' },
  topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${T.borde}`, background: 'rgba(251,249,244,0.95)', backdropFilter: 'blur(8px)', zIndex: 10, flexShrink: 0 },
  brandMark: { fontFamily: T.serif, fontSize: 18, fontWeight: 600, letterSpacing: -0.2 },
  body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  iconBtn: { background: 'none', border: `1px solid ${T.borde}`, borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.tinta, cursor: 'pointer' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: T.tinta, color: T.papel, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', color: T.tinta, border: `1px solid ${T.borde}`, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer' },
  navBtn: { background: 'none', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: T.tinta60, fontFamily: T.sans },
  navBtnActivo: { background: T.papel2, color: T.tinta, fontWeight: 600 },
};
