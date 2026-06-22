import React, { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { uid, todayISO, nuevoCliente, cargarClientes, guardarCliente, eliminarClienteRemoto } from './data.js';
import { T } from './tokens.js';
import Login from './Login.jsx';

/* ============================================================
   FORMATO
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
  // Si ya es un número JS válido en formato estándar (punto decimal, sin
  // separador de miles) lo usamos directo — esto cubre los valores que
  // vienen del parser de cotizaciones, generados con String(numero).
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const directo = Number(s);
    if (!isNaN(directo)) return directo;
  }
  // Si no, asumimos formato argentino tipeado a mano: punto de miles,
  // coma decimal (ej: "1.234,56").
  const n = Number(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

/* ============================================================
   ICONOS (inline SVG, sin librería)
   ============================================================ */

const Icon = ({ name, size = 18, className = '' }) => {
  const paths = {
    plus: 'M12 5v14M5 12h14',
    user: 'M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    back: 'M19 12H5M12 19l-7-7 7-7',
    upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z M14 2v6h6',
    trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z',
    check: 'M20 6 9 17l-5-5',
    edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v12M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.5 1.3 2 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5-3-1-3-2.5',
    home: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z',
    alert: 'M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
    target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01',
    family: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    cap: 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 3 3 6 3s6-2 6-3v-5',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={paths[name] || ''} />
    </svg>
  );
};

/* ============================================================
   APP — gate de autenticación
   ============================================================ */

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión

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
   ESTUDIO — app autenticada
   ============================================================ */

function EstudioApp({ user }) {
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('lista');
  const [clienteActivoId, setClienteActivoId] = useState(null);
  const [guardadoEstado, setGuardadoEstado] = useState('ok'); // ok | guardando | error

  useEffect(() => {
    (async () => {
      try {
        const c = await cargarClientes(user.uid);
        setClientes(c);
      } catch (e) {
        console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  }, [user.uid]);

  const actualizarCliente = useCallback((id, patch) => {
    setClientes((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch, actualizadoEn: new Date().toISOString() } : c));
      const actualizado = next.find((c) => c.id === id);
      setGuardadoEstado('guardando');
      guardarCliente(user.uid, actualizado)
        .then(() => setGuardadoEstado('ok'))
        .catch((e) => { console.error(e); setGuardadoEstado('error'); });
      return next;
    });
  }, [user.uid]);

  const crearCliente = useCallback(() => {
    const c = nuevoCliente();
    setClientes((prev) => [c, ...prev]);
    setGuardadoEstado('guardando');
    guardarCliente(user.uid, c)
      .then(() => setGuardadoEstado('ok'))
      .catch((e) => { console.error(e); setGuardadoEstado('error'); });
    setClienteActivoId(c.id);
    setVista('ficha');
  }, [user.uid]);

  const eliminarCliente = useCallback((id) => {
    setClientes((prev) => prev.filter((c) => c.id !== id));
    eliminarClienteRemoto(id).catch((e) => console.error(e));
    if (clienteActivoId === id) {
      setVista('lista');
      setClienteActivoId(null);
    }
  }, [clienteActivoId]);

  const clienteActivo = clientes.find((c) => c.id === clienteActivoId) || null;

  if (cargando) {
    return (
      <div style={{ ...S.app, alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        <style>{globalCSS}</style>
        <div style={{ color: T.tinta60, fontFamily: T.sans }}>Abriendo carpetas de clientes…</div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{globalCSS}</style>
      <TopBar
        vista={vista}
        clienteActivo={clienteActivo}
        onBack={() => { setVista('lista'); setClienteActivoId(null); }}
        guardadoEstado={guardadoEstado}
        userEmail={user.email}
      />
      {vista === 'lista' && (
        <ListaClientes
          clientes={clientes}
          onAbrir={(id) => { setClienteActivoId(id); setVista('ficha'); }}
          onCrear={crearCliente}
          onEliminar={eliminarCliente}
        />
      )}
      {vista === 'ficha' && clienteActivo && (
        <FichaCliente
          cliente={clienteActivo}
          onUpdate={(patch) => actualizarCliente(clienteActivo.id, patch)}
          onIrAnalisis={() => setVista('analisis')}
        />
      )}
      {vista === 'analisis' && clienteActivo && (
        <PanelAnalisis
          cliente={clienteActivo}
          onUpdate={(patch) => actualizarCliente(clienteActivo.id, patch)}
          onVolverFicha={() => setVista('ficha')}
        />
      )}
    </div>
  );
}

/* ============================================================
   TOP BAR
   ============================================================ */

function TopBar({ vista, clienteActivo, onBack, guardadoEstado, userEmail }) {
  return (
    <header style={S.topbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {vista !== 'lista' && (
          <button onClick={onBack} style={S.iconBtn} aria-label="Volver">
            <Icon name="back" size={18} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.brandMark}>Estudio</span>
          <span style={S.brandSub}>análisis de cobertura</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {clienteActivo && vista !== 'lista' && (
          <span style={{ fontFamily: T.serif, fontSize: 15, color: T.tinta }}>
            {clienteActivo.nombreCompleto || 'Cliente sin nombre'}
          </span>
        )}
        <span style={{ fontSize: 11, color: guardadoEstado === 'error' ? T.terracota : T.tinta40, fontFamily: T.sans, letterSpacing: 0.3 }}>
          {guardadoEstado === 'guardando' ? 'Guardando…' : guardadoEstado === 'error' ? 'Error al guardar' : 'Guardado'}
        </span>
        <span style={{ fontSize: 11.5, color: T.tinta40 }}>{userEmail}</span>
        <button onClick={() => signOut(auth)} style={S.iconBtn} aria-label="Cerrar sesión" title="Cerrar sesión">
          <Icon name="logout" size={15} />
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   LISTA DE CLIENTES
   ============================================================ */

function ListaClientes({ clientes, onAbrir, onCrear, onEliminar }) {
  const [confirmarBorrado, setConfirmarBorrado] = useState(null);

  return (
    <main style={S.main}>
      <div style={S.heroRow}>
        <div>
          <h1 style={S.h1}>Tu cartera, en estructura.</h1>
          <p style={S.heroSub}>Cada cliente con su familia, sus números y qué tan cubierto está. Cargá una ficha y dejá que el análisis te diga dónde hay brecha.</p>
        </div>
        <button onClick={onCrear} style={S.btnPrimary}>
          <Icon name="plus" size={17} /> Nuevo cliente
        </button>
      </div>

      {clientes.length === 0 ? (
        <div style={S.empty}>
          <Icon name="family" size={32} className="empty-icon" />
          <p style={{ fontFamily: T.serif, fontSize: 18, color: T.tinta, margin: '14px 0 6px' }}>Todavía no cargaste a nadie.</p>
          <p style={{ color: T.tinta60, fontSize: 14, maxWidth: 380, textAlign: 'center', lineHeight: 1.5 }}>
            Empezá por el primer cliente: su familia, su situación y lo que ya tiene cubierto. El análisis se arma solo a partir de ahí.
          </p>
          <button onClick={onCrear} style={{ ...S.btnPrimary, marginTop: 18 }}>
            <Icon name="plus" size={17} /> Cargar primer cliente
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {clientes.map((c) => {
            const edad = calcEdad(c.fechaNacimiento);
            const nCotiz = c.cotizaciones?.length || 0;
            const ult = c.cotizaciones?.[c.cotizaciones.length - 1];
            return (
              <div key={c.id} style={S.card} onClick={() => onAbrir(c.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={S.cardName}>{c.nombreCompleto || 'Sin nombre todavía'}</div>
                    <div style={S.cardMeta}>
                      {edad !== null ? `${edad} años` : 'Edad sin cargar'}
                      {c.ocupacion ? ` · ${c.ocupacion}` : ''}
                    </div>
                  </div>
                  <button
                    style={S.iconBtnGhost}
                    onClick={(e) => { e.stopPropagation(); setConfirmarBorrado(c.id); }}
                    aria-label="Eliminar cliente"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
                <div style={S.cardDivider} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: T.tinta60, fontFamily: T.sans }}>
                  <span>{c.hijos?.length ? `${c.hijos.length} hijo${c.hijos.length > 1 ? 's' : ''}` : 'Sin hijos cargados'}</span>
                  <span>{nCotiz} cotización{nCotiz === 1 ? '' : 'es'}</span>
                </div>
                {ult && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: T.tinta40, fontFamily: T.mono }}>
                    última: {ult.fecha}
                  </div>
                )}

                {confirmarBorrado === c.id && (
                  <div style={S.confirmBox} onClick={(e) => e.stopPropagation()}>
                    <span style={{ fontSize: 12.5, color: T.tinta }}>¿Eliminar esta ficha?</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={S.btnDanger} onClick={() => { onEliminar(c.id); setConfirmarBorrado(null); }}>Eliminar</button>
                      <button style={S.btnGhostSm} onClick={() => setConfirmarBorrado(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

/* ============================================================
   FICHA DE CLIENTE
   ============================================================ */

const TIPOS_COMPROMISO = [
  { value: 'educacion', label: 'Plan educativo' },
  { value: 'credito', label: 'Crédito / hipoteca' },
  { value: 'proyecto', label: 'Proyecto' },
  { value: 'otro', label: 'Otro' },
];

function FichaCliente({ cliente, onUpdate, onIrAnalisis }) {
  const set = (field, value) => onUpdate({ [field]: value });
  const setFinanzas = (field, value) => onUpdate({ finanzas: { ...cliente.finanzas, [field]: value } });
  const setTipoCambio = (field, value) => onUpdate({ tipoCambio: { ...cliente.tipoCambio, [field]: value } });
  const setDeduccion = (field, value) => onUpdate({ deduccionGanancias: { ...(cliente.deduccionGanancias || {}), [field]: value } });

  const setConyuge = (field, value) => {
    const base = cliente.conyuge || { nombre: '', edad: '', ocupacion: '' };
    onUpdate({ conyuge: { ...base, [field]: value } });
  };
  const quitarConyuge = () => onUpdate({ conyuge: null });
  const agregarConyuge = () => onUpdate({ conyuge: { nombre: '', edad: '', ocupacion: '' } });

  const agregarHijo = () => {
    onUpdate({ hijos: [...cliente.hijos, { id: uid(), nombre: '', edad: '', escolaridad: '', planEducativo: '', notas: '' }] });
  };
  const setHijo = (id, field, value) => {
    onUpdate({ hijos: cliente.hijos.map((h) => (h.id === id ? { ...h, [field]: value } : h)) });
  };
  const quitarHijo = (id) => onUpdate({ hijos: cliente.hijos.filter((h) => h.id !== id) });

  const compromisos = cliente.compromisos || [];
  const agregarCompromiso = () => {
    onUpdate({ compromisos: [...compromisos, { id: uid(), tipo: 'educacion', descripcion: '', anosRestantes: '', montoAnualUSD: '', vinculadoA: '' }] });
  };
  const setCompromiso = (id, field, value) => {
    onUpdate({ compromisos: compromisos.map((cm) => (cm.id === id ? { ...cm, [field]: value } : cm)) });
  };
  const quitarCompromiso = (id) => onUpdate({ compromisos: compromisos.filter((cm) => cm.id !== id) });

  const edad = calcEdad(cliente.fechaNacimiento);
  const ingresoNum = numOrNull(cliente.finanzas.ingresoMensual);
  const tcNum = numOrNull(cliente.tipoCambio.valor);
  const ingresoUSD = cliente.finanzas.monedaIngreso === 'USD'
    ? ingresoNum
    : (ingresoNum && tcNum ? ingresoNum / tcNum : null);

  return (
    <main style={S.main}>
      <div style={S.fichaHeader}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={S.labelXs}>Nombre completo</label>
          <input
            style={S.inputHero}
            placeholder="Nombre y apellido del cliente"
            value={cliente.nombreCompleto}
            onChange={(e) => set('nombreCompleto', e.target.value)}
          />
        </div>
        <button style={S.btnPrimary} onClick={onIrAnalisis}>
          <Icon name="target" size={17} /> Ver análisis
        </button>
      </div>

      <Seccion icono="user" titulo="Datos personales">
        <Grid cols={3}>
          <Campo label="Fecha de nacimiento">
            <input type="date" style={S.input} value={cliente.fechaNacimiento} onChange={(e) => set('fechaNacimiento', e.target.value)} />
          </Campo>
          <Campo label="Edad">
            <div style={S.inputReadonly}>{edad !== null ? `${edad} años` : '—'}</div>
          </Campo>
          <Campo label="Ocupación">
            <input style={S.input} placeholder="A qué se dedica" value={cliente.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} />
          </Campo>
          <Campo label="Vivienda">
            <select style={S.input} value={cliente.vivienda} onChange={(e) => set('vivienda', e.target.value)}>
              <option value="">Sin definir</option>
              <option value="alquila">Alquila</option>
              <option value="propietaria">Es propietario/a</option>
            </select>
          </Campo>
          <Campo label="Otras actividades" span={2}>
            <input style={S.input} placeholder="Hobbies, actividades de riesgo, etc." value={cliente.otrasActividades} onChange={(e) => set('otrasActividades', e.target.value)} />
          </Campo>
        </Grid>
      </Seccion>

      <Seccion icono="family" titulo="Familia">
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={S.subTitulo}>Cónyuge / pareja</span>
            {!cliente.conyuge ? (
              <button style={S.btnGhostSm} onClick={agregarConyuge}><Icon name="plus" size={13} /> Agregar</button>
            ) : (
              <button style={S.btnGhostSm} onClick={quitarConyuge}>Quitar</button>
            )}
          </div>
          {cliente.conyuge && (
            <Grid cols={3}>
              <Campo label="Nombre">
                <input style={S.input} value={cliente.conyuge.nombre} onChange={(e) => setConyuge('nombre', e.target.value)} />
              </Campo>
              <Campo label="Edad">
                <input type="number" style={S.input} value={cliente.conyuge.edad} onChange={(e) => setConyuge('edad', e.target.value)} />
              </Campo>
              <Campo label="Ocupación">
                <input style={S.input} value={cliente.conyuge.ocupacion} onChange={(e) => setConyuge('ocupacion', e.target.value)} />
              </Campo>
            </Grid>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={S.subTitulo}>Hijos</span>
            <button style={S.btnGhostSm} onClick={agregarHijo}><Icon name="plus" size={13} /> Agregar hijo/a</button>
          </div>
          {cliente.hijos.length === 0 && <p style={S.vacioMsg}>Sin hijos cargados.</p>}
          {cliente.hijos.map((h, i) => (
            <div key={h.id} style={S.hijoCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.tinta40, fontFamily: T.mono }}>HIJO/A {i + 1}</span>
                <button style={S.iconBtnGhost} onClick={() => quitarHijo(h.id)}><Icon name="trash" size={14} /></button>
              </div>
              <Grid cols={4}>
                <Campo label="Nombre">
                  <input style={S.input} value={h.nombre} onChange={(e) => setHijo(h.id, 'nombre', e.target.value)} />
                </Campo>
                <Campo label="Edad">
                  <input type="number" style={S.input} value={h.edad} onChange={(e) => setHijo(h.id, 'edad', e.target.value)} />
                </Campo>
                <Campo label="Escolaridad">
                  <select style={S.input} value={h.escolaridad} onChange={(e) => setHijo(h.id, 'escolaridad', e.target.value)}>
                    <option value="">Sin definir</option>
                    <option value="publica">Pública</option>
                    <option value="privada">Privada</option>
                    <option value="universidad">Universidad</option>
                    <option value="no-escolar">No escolarizado aún</option>
                  </select>
                </Campo>
                <Campo label="Plan educativo">
                  <input style={S.input} placeholder="Universidad, intercambio…" value={h.planEducativo} onChange={(e) => setHijo(h.id, 'planEducativo', e.target.value)} />
                </Campo>
              </Grid>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion icono="clock" titulo="Compromisos en el tiempo">
        <p style={{ fontSize: 13, color: T.tinta60, marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>
          Todo lo que el cliente quiere sostener durante varios años más — la universidad de un hijo, un crédito, un proyecto — suma a la suma asegurada ideal mientras ese compromiso siga vigente. Así el análisis refleja no solo el ingreso de hoy, sino lo que la familia necesita sostener en el tiempo.
        </p>
        {compromisos.length === 0 && <p style={S.vacioMsg}>Sin compromisos cargados todavía.</p>}
        {compromisos.map((cm, i) => (
          <div key={cm.id} style={S.hijoCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: T.tinta40, fontFamily: T.mono }}>COMPROMISO {i + 1}</span>
              <button style={S.iconBtnGhost} onClick={() => quitarCompromiso(cm.id)}><Icon name="trash" size={14} /></button>
            </div>
            <Grid cols={4}>
              <Campo label="Tipo">
                <select style={S.input} value={cm.tipo} onChange={(e) => setCompromiso(cm.id, 'tipo', e.target.value)}>
                  {TIPOS_COMPROMISO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Campo>
              <Campo label="Descripción">
                <input style={S.input} placeholder="Ej: Universidad de Manuel" value={cm.descripcion} onChange={(e) => setCompromiso(cm.id, 'descripcion', e.target.value)} />
              </Campo>
              <Campo label="Años restantes">
                <input type="number" style={S.input} placeholder="Ej: 15" value={cm.anosRestantes} onChange={(e) => setCompromiso(cm.id, 'anosRestantes', e.target.value)} />
              </Campo>
              <Campo label="Costo anual estimado (USD)">
                <input type="number" style={S.input} placeholder="Ej: 4000" value={cm.montoAnualUSD} onChange={(e) => setCompromiso(cm.id, 'montoAnualUSD', e.target.value)} />
              </Campo>
            </Grid>
          </div>
        ))}
        <button style={{ ...S.btnGhostSm, marginTop: 4 }} onClick={agregarCompromiso}>
          <Icon name="plus" size={13} /> Agregar compromiso
        </button>
      </Seccion>

      <Seccion icono="edit" titulo="Proyectos">
        <Grid cols={2}>
          <Campo label="Proyectos actuales">
            <textarea style={S.textarea} value={cliente.proyectosActuales} onChange={(e) => set('proyectosActuales', e.target.value)} />
          </Campo>
          <Campo label="Proyectos futuros">
            <textarea style={S.textarea} value={cliente.proyectosFuturos} onChange={(e) => set('proyectosFuturos', e.target.value)} />
          </Campo>
        </Grid>
      </Seccion>

      <Seccion icono="coin" titulo="Situación financiera">
        <Grid cols={3}>
          <Campo label="Ingreso mensual">
            <div style={S.inputConSelector}>
              <input type="number" style={S.inputSinBorde} value={cliente.finanzas.ingresoMensual} onChange={(e) => setFinanzas('ingresoMensual', e.target.value)} />
              <select style={S.selectorInline} value={cliente.finanzas.monedaIngreso} onChange={(e) => setFinanzas('monedaIngreso', e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </Campo>
          <Campo label="Gasto mensual">
            <input type="number" style={S.input} value={cliente.finanzas.gastoMensual} onChange={(e) => setFinanzas('gastoMensual', e.target.value)} />
          </Campo>
          <Campo label="Prima máxima mensual (opcional)">
            <input type="number" style={S.input} placeholder="Si vacío, se usa 10% del ingreso" value={cliente.finanzas.primaMaxima} onChange={(e) => setFinanzas('primaMaxima', e.target.value)} />
          </Campo>
          <Campo label="Ahorros">
            <input style={S.input} value={cliente.finanzas.ahorros} onChange={(e) => setFinanzas('ahorros', e.target.value)} />
          </Campo>
          <Campo label="Inversiones">
            <input style={S.input} value={cliente.finanzas.inversiones} onChange={(e) => setFinanzas('inversiones', e.target.value)} />
          </Campo>
          <Campo label="Otros seguros">
            <input style={S.input} placeholder="Compañía y cobertura" value={cliente.finanzas.otrosSeguros} onChange={(e) => setFinanzas('otrosSeguros', e.target.value)} />
          </Campo>
          <Campo label="Créditos activos">
            <input style={S.input} value={cliente.finanzas.creditosActivos} onChange={(e) => setFinanzas('creditosActivos', e.target.value)} />
          </Campo>
          <Campo label="Deudas">
            <input style={S.input} value={cliente.finanzas.deudas} onChange={(e) => setFinanzas('deudas', e.target.value)} />
          </Campo>
        </Grid>
      </Seccion>

      <Seccion icono="coin" titulo="Dolarización">
        <Grid cols={3}>
          <Campo label="Tipo de cambio del día (oficial mayorista)">
            <input type="number" style={S.input} placeholder="Ej: 1450" value={cliente.tipoCambio.valor} onChange={(e) => setTipoCambio('valor', e.target.value)} />
          </Campo>
          <Campo label="Fecha del tipo de cambio">
            <input type="date" style={S.input} value={cliente.tipoCambio.fecha} onChange={(e) => setTipoCambio('fecha', e.target.value)} />
          </Campo>
          <Campo label="Ingreso mensual en USD">
            <div style={S.inputReadonly}>{fmtUSD(ingresoUSD)}</div>
          </Campo>
        </Grid>
        {cliente.finanzas.monedaIngreso === 'ARS' && !tcNum && (
          <p style={{ ...S.vacioMsg, color: T.terracota, marginTop: 10 }}>
            <Icon name="alert" size={13} /> Cargá el tipo de cambio para poder dolarizar el ingreso y comparar contra las cotizaciones.
          </p>
        )}
      </Seccion>

      <Seccion icono="coin" titulo="Deducción de Ganancias">
        <p style={{ fontSize: 13, color: T.tinta60, marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>
          Los topes anuales de deducción se actualizan por AFIP/ARCA cada período fiscal, así que quedan a tu criterio cargarlos con el valor vigente. Si los completás, el PDF para el cliente va a incluir esta ventaja como parte del análisis.
        </p>
        <Grid cols={3}>
          <Campo label="Tope anual — Vida con ahorro (ARS)">
            <input type="number" style={S.input} placeholder="Ej: 1500000" value={cliente.deduccionGanancias?.topeVidaYAhorro || ''} onChange={(e) => setDeduccion('topeVidaYAhorro', e.target.value)} />
          </Campo>
          <Campo label="Tope anual — Vida puro (ARS)">
            <input type="number" style={S.input} placeholder="Ej: 1500000" value={cliente.deduccionGanancias?.topeVidaPuro || ''} onChange={(e) => setDeduccion('topeVidaPuro', e.target.value)} />
          </Campo>
          <Campo label="Tope anual — Retiro (ARS)">
            <input type="number" style={S.input} placeholder="Ej: 1500000" value={cliente.deduccionGanancias?.topeRetiro || ''} onChange={(e) => setDeduccion('topeRetiro', e.target.value)} />
          </Campo>
        </Grid>
      </Seccion>

      <Seccion icono="edit" titulo="Notas">
        <textarea style={{ ...S.textarea, minHeight: 80 }} placeholder="Cualquier contexto que quieras recordar para la próxima reunión" value={cliente.notas} onChange={(e) => set('notas', e.target.value)} />
      </Seccion>
    </main>
  );
}

function Seccion({ icono, titulo, children }) {
  return (
    <section style={S.seccion}>
      <div style={S.seccionHeader}>
        <Icon name={icono} size={16} className="seccion-icon" />
        <h2 style={S.seccionTitulo}>{titulo}</h2>
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
      <label style={S.labelXs}>{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
   PANEL DE ANÁLISIS
   ============================================================ */

// Calcula cuánto suman los compromisos vigentes dentro del horizonte de
// referencia (3 a 5 años desde hoy). Un compromiso con anosRestantes=15 y
// montoAnualUSD=4000 aporta su monto anual completo a cada uno de los años
// del horizonte que todavía está vigente (porque en todos esos años el
// cliente seguiría necesitando sostenerlo si faltara).
function calcularAporteCompromisos(compromisos, horizonteAnios) {
  let total = 0;
  for (const cm of compromisos || []) {
    const anios = numOrNull(cm.anosRestantes);
    const monto = numOrNull(cm.montoAnualUSD);
    if (!anios || !monto) continue;
    const aniosVigentesEnHorizonte = Math.min(anios, horizonteAnios);
    if (aniosVigentesEnHorizonte > 0) total += monto * aniosVigentesEnHorizonte;
  }
  return total;
}

function PanelAnalisis({ cliente, onUpdate, onVolverFicha }) {
  const [mostrarCarga, setMostrarCarga] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const ingresoNum = numOrNull(cliente.finanzas.ingresoMensual);
  const tcNum = numOrNull(cliente.tipoCambio.valor);
  const ingresoMensualUSD = cliente.finanzas.monedaIngreso === 'USD'
    ? ingresoNum
    : (ingresoNum && tcNum ? ingresoNum / tcNum : null);
  const ingresoAnualUSD = ingresoMensualUSD ? ingresoMensualUSD * 12 : null;

  const compromisos = cliente.compromisos || [];
  const aporteCompromisosMin = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 3) : 0;
  const aporteCompromisosMax = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 5) : 0;
  const aporteCompromisosCentro = ingresoAnualUSD ? calcularAporteCompromisos(compromisos, 4) : 0;

  const sumaIdealMin = ingresoAnualUSD ? ingresoAnualUSD * 3 + aporteCompromisosMin : null;
  const sumaIdealMax = ingresoAnualUSD ? ingresoAnualUSD * 5 + aporteCompromisosMax : null;
  const sumaIdealCentro = ingresoAnualUSD ? ingresoAnualUSD * 4 + aporteCompromisosCentro : null;

  const tieneCompromisosRelevantes = compromisos.some((cm) => numOrNull(cm.anosRestantes) && numOrNull(cm.montoAnualUSD));

  const primaTope = numOrNull(cliente.finanzas.primaMaxima) || (ingresoMensualUSD ? ingresoMensualUSD * 0.1 : null);

  const totales = sumarCoberturas(cotizacionesDe(cliente));
  const primaMensualTotal = cotizacionesDe(cliente).reduce((acc, c) => acc + (c.primaMensualUSD || 0), 0);

  const pctCobertura = sumaIdealCentro && totales.vida
    ? Math.min(999, (totales.vida / sumaIdealCentro) * 100)
    : (sumaIdealCentro ? 0 : null);

  const pctPrima = primaTope ? (primaMensualTotal / primaTope) * 100 : null;

  const agregarCotizacion = (cotizacion) => {
    onUpdate({ cotizaciones: [...cotizacionesDe(cliente), cotizacion] });
    setMostrarCarga(false);
  };

  const quitarCotizacion = (id) => {
    onUpdate({ cotizaciones: cotizacionesDe(cliente).filter((c) => c.id !== id) });
  };

  const datosListos = ingresoMensualUSD !== null;

  return (
    <main style={S.main}>
      <div style={S.fichaHeader}>
        <div>
          <h1 style={S.h1}>{cliente.nombreCompleto || 'Cliente sin nombre'}</h1>
          <p style={S.heroSub}>
            {calcEdad(cliente.fechaNacimiento) !== null ? `${calcEdad(cliente.fechaNacimiento)} años · ` : ''}
            {cliente.ocupacion || 'Sin ocupación cargada'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btnGhostSm} onClick={onVolverFicha}><Icon name="edit" size={14} /> Editar ficha</button>
          <button
            style={{ ...S.btnPrimary, opacity: datosListos && cotizacionesDe(cliente).length > 0 ? 1 : 0.5 }}
            disabled={!datosListos || cotizacionesDe(cliente).length === 0 || generandoPDF}
            onClick={() => generarPDFCliente(cliente, { sumaIdealMin, sumaIdealMax, sumaIdealCentro, primaTope, totales, primaMensualTotal, pctCobertura, pctPrima, ingresoAnualUSD, ingresoMensualUSD, aporteCompromisosCentro, tieneCompromisosRelevantes }, setGenerandoPDF)}
          >
            <Icon name="download" size={16} /> {generandoPDF ? 'Generando…' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {!datosListos && (
        <div style={S.avisoFalta}>
          <Icon name="alert" size={16} />
          <span>Faltan datos para calcular: cargá el ingreso mensual y el tipo de cambio en la ficha del cliente.</span>
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
            <BarraCobertura
              label="Vida / fallecimiento"
              valorUSD={totales.vida}
              metaUSD={sumaIdealCentro}
              pct={pctCobertura}
            />
            <BarraCobertura
              label="Invalidez total y permanente"
              valorUSD={totales.itp}
              metaUSD={sumaIdealCentro}
              pct={sumaIdealCentro ? Math.min(999, (totales.itp / sumaIdealCentro) * 100) : null}
            />
            <BarraCobertura
              label="Enfermedades críticas"
              valorUSD={totales.enfermedadesCriticas}
              metaUSD={null}
              pct={null}
              sinMeta
            />
            <BarraCobertura
              label="Muerte accidental (adicional)"
              valorUSD={totales.muerteAccidental}
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
            {cotizacionesDe(cliente).length === 0 && <p style={S.vacioMsg}>Todavía no cargaste ninguna cotización para este cliente.</p>}
            {cotizacionesDe(cliente).map((c) => (
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

const cotizacionesDe = (cliente) => cliente.cotizaciones || [];

function sumarCoberturas(cotizaciones) {
  const acc = { vida: 0, itp: 0, enfermedadesCriticas: 0, muerteAccidental: 0, fondoRetiro: 0 };
  for (const c of cotizaciones) {
    for (const cob of c.coberturas || []) {
      if (acc[cob.tipo] !== undefined) acc[cob.tipo] += cob.beneficioUSD || 0;
    }
  }
  return acc;
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
      beneficioUSD: moneda === 'USD' ? numOrNull(c.beneficio) || 0 : (tcNum ? (numOrNull(c.beneficio) || 0) / tcNum : 0),
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

  if (!coberturas.some((c) => c.tipo === 'vida')) {
    const totalBeneficio = buscarMonto(texto, ['Total Beneficio[^\\d]*']);
    if (totalBeneficio) coberturas.push({ nombre: 'Total Beneficio', beneficio: String(totalBeneficio), tipo: 'vida' });
  }

  const primaTotal = buscarMonto(texto, ['Prima Total']) || buscarMonto(texto, ['\\bPrima\\b(?!\\s*Total)']);
  // Los productos de Life Seguros están dolarizados por definición (cotizan al
  // tipo de cambio oficial mayorista). Solo se marca ARS si el texto lo dice
  // explícitamente — de lo contrario, USD es el default correcto para esta
  // plantilla, evitando una doble conversión accidental.
  const dicePesos = /moneda\s*:?\s*pesos?/i.test(texto) || /moneda\s*:?\s*ars\b/i.test(texto);
  const moneda = dicePesos ? 'ARS' : 'USD';

  return { coberturas, primaMensual: primaTotal ? String(primaTotal) : '', moneda };
}

function parsearOrigenes(texto) {
  const coberturas = [];
  const matchFondo = texto.match(/Fondo Acumulado[:\s]*u?\$?s?\s*([\d.,]+)/i);
  const fondo = matchFondo ? numDesdeTexto(matchFondo[1]) : null;

  if (fondo) {
    coberturas.push({ nombre: 'Fondo Acumulado (proyección garantizada)', beneficio: String(fondo), tipo: 'fondoRetiro' });
  }

  const aporteMensual = buscarMonto(texto, ['Aporte Mensual']);
  const moneda = /d[oó]lares/i.test(texto) ? 'USD' : 'ARS';

  return { coberturas, primaMensual: aporteMensual ? String(aporteMensual) : '', moneda };
}

/* ============================================================
   ANÁLISIS NARRATIVO — etapa de vida, faltantes, deducción
   ============================================================ */

function calcularEtapaDeVida(cliente, edad) {
  const tieneHijosChicos = (cliente.hijos || []).some((h) => numOrNull(h.edad) !== null && numOrNull(h.edad) < 18);
  const tieneHijosUniv = (cliente.hijos || []).some((h) => h.escolaridad === 'universidad' || (numOrNull(h.edad) !== null && numOrNull(h.edad) >= 18));
  const tieneConyuge = !!cliente.conyuge;
  const tieneCredito = !!(cliente.finanzas?.creditosActivos && cliente.finanzas.creditosActivos.trim());

  if (edad !== null && edad < 30 && !tieneConyuge && (cliente.hijos || []).length === 0) {
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
  if (!finanzas?.otrosSeguros || !finanzas.otrosSeguros.trim()) {
    faltantes.push({
      titulo: 'Cobertura de salud',
      texto: 'Una cobertura de salud complementaria es otra capa de tranquilidad que vale la pena conversar más adelante, cuando el perfil y las prioridades lo permitan.',
    });
  }
  return faltantes;
}

function calcularDeduccion(cliente, calc) {
  const dg = cliente.deduccionGanancias || {};
  const items = [];
  if (numOrNull(dg.topeVidaYAhorro)) items.push({ nombre: 'Seguro de vida con ahorro', tope: numOrNull(dg.topeVidaYAhorro) });
  if (numOrNull(dg.topeVidaPuro)) items.push({ nombre: 'Seguro de vida puro', tope: numOrNull(dg.topeVidaPuro) });
  if (numOrNull(dg.topeRetiro)) items.push({ nombre: 'Seguro de retiro', tope: numOrNull(dg.topeRetiro) });
  return items;
}

/* ============================================================
   GENERACIÓN DE PDF PARA EL CLIENTE
   ============================================================ */

async function generarPDFCliente(cliente, calc, setGenerando) {
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

    const edad = calcEdad(cliente.fechaNacimiento);
    const nombrePila = (cliente.nombreCompleto || 'tu cliente').split(' ')[0];

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
    doc.text(cliente.nombreCompleto || 'Cliente', M, 68);
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
    parrafo(calcularEtapaDeVida(cliente, edad), { marginBottom: 4 });
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

    dibujarBarra('Vida / fallecimiento', calc.totales.vida, calc.sumaIdealCentro, calc.pctCobertura);
    dibujarBarra('Invalidez total y permanente', calc.totales.itp, calc.sumaIdealCentro, calc.sumaIdealCentro ? (calc.totales.itp / calc.sumaIdealCentro) * 100 : null);
    if (calc.totales.enfermedadesCriticas > 0) dibujarBarra('Enfermedades críticas', calc.totales.enfermedadesCriticas, null, null);
    if (calc.totales.muerteAccidental > 0) dibujarBarra('Muerte accidental (adicional)', calc.totales.muerteAccidental, null, null);
    if (calc.totales.fondoRetiro > 0) dibujarBarra('Fondo de retiro proyectado', calc.totales.fondoRetiro, null, null);
    y += 8;

    // ---------- Prima mensual ----------
    encabezadoSeccion('Tu inversión mensual');
    parrafo(`Tope recomendado: hasta el 10% de tu ingreso mensual, equivalente a ${fmtUSD(calc.primaTope)}.`, { color: colGris, size: 10, marginBottom: 6 });
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
      for (const cm of cliente.compromisos || []) {
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
    const itemsDeduccion = calcularDeduccion(cliente, calc);
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
    const faltantes = calcularFaltantes(calc.totales, cliente.finanzas);
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

    const nombreArchivo = `Analisis-${(cliente.nombreCompleto || 'cliente').replace(/\s+/g, '-')}-${todayISO()}.pdf`;
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

  barraTrack: { height: 9, background: T.papel2, borderRadius: 5, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 5, transition: 'width 0.3s' },

  divider: { height: 1, background: T.borde, margin: '20px 0' },

  cotizCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${T.borde}`, borderRadius: 9, padding: '12px 14px', marginBottom: 8 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(26,46,41,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: T.papel, borderRadius: 14, padding: '22px 26px', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.borde}`, paddingBottom: 12 },

  errorBox: { display: 'flex', alignItems: 'center', gap: 8, background: T.terracotaSoft, color: T.terracota, borderRadius: 9, padding: '10px 14px', fontSize: 13, marginTop: 14, flexWrap: 'wrap' },

  coberturaRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
};
