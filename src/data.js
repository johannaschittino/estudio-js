import {
  collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const todayISO = () => new Date().toISOString().slice(0, 10);

/* ============================================================
   MODELO DE CLIENTE
   ============================================================ */

export const nuevoCliente = () => ({
  id: uid(),
  nombreCompleto: '',
  fechaNacimiento: '',
  ocupacion: '',
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
  // Línea de tiempo de compromisos financieros: cada uno con un horizonte en años
  // y un monto adicional que se suma a la suma asegurada ideal mientras ese
  // compromiso siga vigente (ej: universidad de un hijo, crédito hipotecario, etc.)
  compromisos: [],
  // Topes anuales de deducción de Ganancias (se actualizan por AFIP/ARCA cada
  // período fiscal, por eso quedan editables a mano en vez de hardcodeados).
  deduccionGanancias: {
    topeVidaYAhorro: '',   // Seguro de vida con ahorro
    topeVidaPuro: '',      // Seguro de vida puro (sin ahorro)
    topeRetiro: '',        // Seguro de retiro
  },
  notas: '',
  creadoEn: new Date().toISOString(),
  actualizadoEn: new Date().toISOString(),
});

// compromiso: {
//   id, tipo: 'educacion'|'credito'|'proyecto'|'otro',
//   descripcion: string,
//   anosRestantes: number,        // horizonte temporal del compromiso
//   montoAnualUSD: number,        // costo anual estimado en USD
//   vinculadoA: string | null,    // nombre del hijo, opcional, solo informativo
// }

/* ============================================================
   FIRESTORE — CRUD por usuario
   ============================================================ */

const coleccion = collection(db, 'clientes');

export async function cargarClientes(ownerId) {
  if (!ownerId) return [];
  const q = query(coleccion, where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  const lista = [];
  snap.forEach((d) => lista.push(d.data().payload));
  // Más reciente primero
  lista.sort((a, b) => new Date(b.actualizadoEn) - new Date(a.actualizadoEn));
  return lista;
}

export async function guardarCliente(ownerId, cliente) {
  if (!ownerId) throw new Error('Sin usuario autenticado.');
  const ref = doc(db, 'clientes', cliente.id);
  await setDoc(ref, {
    ownerId,
    payload: cliente,
    actualizadoEnServer: serverTimestamp(),
  });
}

export async function eliminarClienteRemoto(clienteId) {
  const ref = doc(db, 'clientes', clienteId);
  await deleteDoc(ref);
}
