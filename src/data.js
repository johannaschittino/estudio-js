import {
collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayISO = () => new Date().toISOString().slice(0, 10);

/* ============================================================
ETAPAS DEL PIPELINE
============================================================ */

export const ETAPAS = [
{ id: 'sin_contactar', label: 'Sin contactar', color: '#8B9E8B' },
{ id: 'contactado', label: 'Contactado', color: '#C9A24B' },
{ id: 'entrevistado', label: 'Entrevistado', color: '#5B8FA8' },
{ id: 'propuesta', label: 'Propuesta', color: '#3D6B4F' },
{ id: 'cerrado', label: 'Cerrado', color: '#2D5016' },
{ id: 'en_pausa', label: 'En pausa', color: 'rgba(26,46,41,0.4)' },
{ id: 'cancelado', label: 'Cancelado', color: 'rgba(181,72,61,0.6)' },
];

export const FUENTES = ['LinkedIn', 'Cartera', 'Referido', 'Evento', 'Otro'];

/* ============================================================
MODELO UNIFICADO — prospecto + cliente
============================================================ */

export const nuevoProspecto = () => ({
id: uid(),

// — CRM —
nombre: '',
rol: '', // ocupación / empresa
fuente: 'LinkedIn',
estado: 'sin_contactar', // etapa del pipeline
accion: '', // próxima acción
fechaAccion: '', // fecha de la próxima acción
notas: '', // notas generales / último contacto
historial: [], // [{ id, fecha, tipo, texto }]

// — Estudio (datos de cobertura) —
fechaNacimiento: '',
conyuge: null,
hijos: [],
vivienda: '',
otrasActividades: '',
proyectosActuales: '',
proyectosFuturos: '',
finanzas: {
ingresoMensual: '',
monedaIngreso: 'ARS',
gastoMensual: '',
ahorros: '',
inversiones: '',
creditosActivos: '',
deudas: '',
otrosSeguros: '',
primaMaxima: '',
},
tipoCambio: { valor: '', fecha: todayISO() },
cotizaciones: [],
compromisos: [],
segurosPrevios: [],
deduccionGanancias: {
topeVidaYAhorro: '',
topeVidaPuro: '',
topeRetiro: '',
},
// Contexto personal — datos de vida que no entran en categorías estándar
contextPersonal: '',
grupoFamiliarId: null,
vinculados: [],
// Lista de operaciones de cierre — un cliente puede tener múltiples:
// póliza nueva de vida, endoso, plan de retiro, salud, etc.
// Cada operación es independiente y suma al total de prima y a los contadores del Dashboard/CAV.
// operacion: { id, tipo: 'poliza_nueva'|'endoso'|'retiro'|'salud',
// primaMensualUSD, sumaAseguradaUSD, compania,
// clienteNuevo, primaAnteriorUSD (endosos), fechaEmision, notas }
cierres: [],
// Pólizas de cartera importadas desde Excel
polizasCartera: [],
// Datos de contacto del Excel
nroDoc: '',
telefonos: [],
mail: '',

creadoEn: new Date().toISOString(),
actualizadoEn: new Date().toISOString(),
});

// Convierte un prospecto del CRM viejo al nuevo formato unificado
export const migrarDesdeCRM = (viejo) => ({
...nuevoProspecto(),
id: String(viejo.id || uid()),
nombre: viejo.nombre || '',
rol: viejo.rol || '',
fuente: capitalizarFuente(viejo.fuente || ''),
estado: normalizarEstado(viejo.estado || 'alpha'),
accion: viejo.accion || '',
fechaAccion: viejo.fecha || '',
notas: viejo.notas || '',
creadoEn: viejo.creado || new Date().toISOString(),
actualizadoEn: viejo.creado || new Date().toISOString(),
});

function capitalizarFuente(f) {
const mapa = { linkedin: 'LinkedIn', cartera: 'Cartera', referido: 'Referido', evento: 'Evento' };
return mapa[f.toLowerCase()] || f || 'Otro';
}

function normalizarEstado(e) {
const mapa = {
alpha: 'alpha', entrevistado: 'entrevistado', propuesta: 'propuesta',
cerrado: 'cerrado', 'en pausa': 'en_pausa', en_pausa: 'en_pausa',
cancelado: 'cancelado',
};
return mapa[e.toLowerCase().replace(' ', '_')] || 'alpha';
}

/* ============================================================
FIRESTORE — CRUD
============================================================ */

const coleccion = collection(db, 'prospectos');

export async function cargarProspectos(ownerId) {
if (!ownerId) return [];
const q = query(coleccion, where('ownerId', '==', ownerId));
const snap = await getDocs(q);
const lista = [];
snap.forEach((d) => lista.push(d.data().payload));
lista.sort((a, b) => new Date(b.actualizadoEn) - new Date(a.actualizadoEn));
return lista;
}

export async function guardarProspecto(ownerId, prospecto) {
if (!ownerId) throw new Error('Sin usuario autenticado.');
const ref = doc(db, 'prospectos', prospecto.id);
await setDoc(ref, {
ownerId,
payload: { ...prospecto, actualizadoEn: new Date().toISOString() },
actualizadoEnServer: serverTimestamp(),
});
}

export async function eliminarProspecto(id) {
await deleteDoc(doc(db, 'prospectos', id));
}

// Mantener compatibilidad con el Estudio viejo
export const nuevoCliente = nuevoProspecto;
export const cargarClientes = cargarProspectos;
export const guardarCliente = guardarProspecto;
export const eliminarClienteRemoto = eliminarProspecto;

// Crea una operación de cierre vacía
export const nuevaOperacionCierre = () => ({
id: uid(),
tipo: 'poliza_nueva', // 'poliza_nueva' | 'endoso' | 'retiro' | 'salud'
primaMensualUSD: '',
sumaAseguradaUSD: '',
compania: 'Life Seguros',
clienteNuevo: false,
primaAnteriorUSD: '', // solo para endosos
fechaEmision: '',
notas: '',
});

/* ============================================================
IMPORTACIÓN DE EXCEL DE CARTERA
============================================================ */

// Convierte número serial de Excel a fecha ISO (YYYY-MM-DD)
function excelFechaAISO(n) {
if (!n || isNaN(n)) return '';
// Excel epoch: 1 enero 1900 = 1 (con bug de 1900 como bisiesto)
const fecha = new Date(Math.round((n - 25569) * 86400 * 1000));
return fecha.toISOString().slice(0, 10);
}

// Convierte "APELLIDO/NOMBRE" a "Nombre Apellido"
export function formatearNombre(raw) {
if (!raw || !raw.trim()) return '';
const partes = raw.trim().split('/');
if (partes.length < 2) return capitalizar(raw.trim());
const apellido = capitalizar(partes[0].trim());
const nombre = capitalizar(partes.slice(1).join(' ').trim());
return `${nombre} ${apellido}`;
}

function capitalizar(s) {
return s.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

// Parsea el TSV del Excel (output de extract-text) en filas de objetos
export function parsearFilasExcel(tsv) {
const lineas = tsv.split('\n').filter((l) => l.trim());
// Saltar el encabezado "## Sheet: ..." y la fila de headers
const filas = [];
let pasaronHeaders = false;
for (const linea of lineas) {
if (linea.startsWith('##')) continue;
if (!pasaronHeaders) { pasaronHeaders = true; continue; } // saltar headers
const cols = linea.split('\t');
if (!cols[0] || isNaN(Number(cols[0]))) continue; // saltar filas sin NRO POLIZA
filas.push({
nroPoliza: String(cols[0] || '').trim(),
descripcionPlan: String(cols[1] || '').trim(),
sumaAseg: Number(cols[2]) || 0,
prima: Number(cols[3]) || 0,
moneda: String(cols[4] || 'D').trim() === 'P' ? 'ARS' : 'USD',
fechaVigencia: excelFechaAISO(Number(cols[5])),
estado: String(cols[6] || '').trim(),
tomadorRaw: String(cols[7] || '').trim(),
aseguradoRaw: String(cols[8] || '').trim(),
fechaNacRaw: Number(cols[9]) || 0,
nroDoc: String(cols[10] || '').trim(),
tel1: String(cols[11] || '').trim(),
tel2: String(cols[12] || '').trim(),
tel3: String(cols[13] || '').trim(),
mail: String(cols[14] || '').trim(),
suplementos: [cols[15], cols[16], cols[17], cols[18], cols[19]]
.map((s) => String(s || '').trim())
.filter(Boolean),
});
}
return filas;
}

// Agrupa filas por NRO DOC del tomador y crea/actualiza prospectos
export function procesarImportacionCartera(filas, prospectoExistentes) {
const grupos = {};

for (const fila of filas) {
const key = fila.nroDoc || fila.tomadorRaw; // agrupar por doc o por nombre si no hay doc
if (!grupos[key]) grupos[key] = { filas: [], nroDoc: fila.nroDoc, tomadorRaw: fila.tomadorRaw, aseguradoRaw: fila.aseguradoRaw, fechaNacRaw: fila.fechaNacRaw, tel1: fila.tel1, tel2: fila.tel2, tel3: fila.tel3, mail: fila.mail };
grupos[key].filas.push(fila);
}

const resultados = { nuevos: [], actualizados: [], total: 0 };

for (const [key, grupo] of Object.entries(grupos)) {
const polizas = grupo.filas.map((f) => ({
id: uid(),
nroPoliza: f.nroPoliza,
descripcionPlan: f.descripcionPlan,
sumaAseg: f.sumaAseg,
primaAnual: f.prima,
moneda: f.moneda,
fechaVigencia: f.fechaVigencia,
estado: f.estado,
asegurado: formatearNombre(f.aseguradoRaw),
suplementos: f.suplementos,
}));

const telefonos = [grupo.tel1, grupo.tel2, grupo.tel3].filter(Boolean);
const nombreFormateado = formatearNombre(grupo.tomadorRaw);
const fechaNac = excelFechaAISO(grupo.fechaNacRaw);

// Buscar si ya existe por nroDoc o por nombre similar
const existente = prospectoExistentes.find((p) =>
(grupo.nroDoc && p.nroDoc === grupo.nroDoc) ||
(!grupo.nroDoc && p.nombre && p.nombre.toLowerCase() === nombreFormateado.toLowerCase())
);

if (existente) {
// Actualizar ficha existente — agregar pólizas nuevas sin duplicar
const polizasExistentes = existente.polizasCartera || [];
const nrosExistentes = new Set(polizasExistentes.map((p) => p.nroPoliza));
const polizasNuevas = polizas.filter((p) => !nrosExistentes.has(p.nroPoliza));
const polizasActualizadas = [...polizasExistentes, ...polizasNuevas];
resultados.actualizados.push({
...existente,
polizasCartera: polizasActualizadas,
nroDoc: grupo.nroDoc || existente.nroDoc,
telefonos: telefonos.length > 0 ? telefonos : (existente.telefonos || []),
mail: grupo.mail || existente.mail,
fechaNacimiento: fechaNac || existente.fechaNacimiento,
});
} else {
// Crear prospecto nuevo
resultados.nuevos.push({
...nuevoProspecto(),
nombre: nombreFormateado,
fuente: 'Cartera',
estado: 'sin_contactar',
nroDoc: grupo.nroDoc,
telefonos,
mail: grupo.mail,
fechaNacimiento: fechaNac,
polizasCartera: polizas,
});
}
resultados.total++;
}

return resultados;
}
