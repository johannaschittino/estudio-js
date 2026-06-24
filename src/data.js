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
  { id: 'alpha', label: 'Alpha', color: '#C9A24B' },
  { id: 'entrevistado', label: 'Entrevistado', color: '#3D6B4F' },
  { id: 'propuesta', label: 'Propuesta', color: '#1A2E29' },
  { id: 'cerrado', label: 'Cerrado', color: '#3D6B4F' },
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
  rol: '',            // ocupación / empresa
  fuente: 'LinkedIn',
  estado: 'alpha',    // etapa del pipeline
  accion: '',         // próxima acción
  fechaAccion: '',    // fecha de la próxima acción
  notas: '',          // notas generales / último contacto
  historial: [],      // [{ id, fecha, tipo, texto }]

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
  // (cobró seguro de un familiar, historia laboral, contexto emocional, etc.)
  contextPersonal: '',
  // Grupo familiar — ID compartido entre fichas vinculadas
  grupoFamiliarId: null,
  // IDs de prospectos vinculados (cónyuge, hijos mayores, etc.)
  vinculados: [],  // [{ id, relacion: 'conyuge'|'hijo'|'padre'|'otro', nombre }]
  // Datos del cierre — se completan cuando el prospecto pasa a "cerrado"
  cierre: {
    fechaEmision: '',
    primaMensualUSD: '',   // prima mensual real de la póliza (sin discriminar impuestos)
    sumaAseguradaUSD: '',  // suma asegurada contratada con Joha
    compania: 'Life Seguros',
    notas: '',
  },

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
