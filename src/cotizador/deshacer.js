// Deshacer (Ctrl+Z) para las pantallas de carga.
//
// No es un undo de editor de texto: cada acción sabe cómo revertirse contra el
// servidor. Se registra una entrada por acción, con la función que la deshace.
//
// Dos decisiones que importan:
//
// 1. La pila vive en memoria y se limpia al entrar a cada pantalla. Deshacer
//    algo de un presupuesto estando parado en otro no tendría sentido.
// 2. Antes de revertir se comprueba que el dato siga como lo dejamos. Si otro
//    usuario del estudio lo tocó mientras tanto, se avisa en vez de pisarle el
//    cambio — que es el riesgo real de un deshacer en un sistema compartido.

import { useEffect } from 'react';

const MAX = 25;
let pila = [];
let escuchas = [];

const avisar = () => escuchas.forEach(fn => fn(pila.length));

/** Suscribe un componente al tamaño de la pila (para pintar el botón). */
export function suscribir(fn) {
  escuchas.push(fn);
  fn(pila.length);
  return () => { escuchas = escuchas.filter(x => x !== fn); };
}

/**
 * Registra una acción deshacible.
 *   etiqueta : qué se hizo, en palabras ("Ítem eliminado")
 *   deshacer : async () => {}  — revierte contra el servidor
 *   verificar: async () => bool — opcional; false = el dato cambió, no revertir
 */
export function registrar({ etiqueta, deshacer, verificar }) {
  pila.push({ etiqueta, deshacer, verificar });
  if (pila.length > MAX) pila.shift();
  avisar();
}

export function limpiar() { pila = []; avisar(); }
export function cantidad() { return pila.length; }
export function etiquetaUltima() { return pila.length ? pila[pila.length - 1].etiqueta : null; }

/**
 * Deshace la última acción.
 * Devuelve { ok, etiqueta, motivo } — nunca lanza, para que la pantalla decida
 * qué mostrar.
 */
export async function deshacerUltima() {
  const a = pila.pop();
  avisar();
  if (!a) return { ok: false, motivo: 'vacio' };
  try {
    if (a.verificar) {
      const sigueIgual = await a.verificar();
      if (!sigueIgual) return { ok: false, etiqueta: a.etiqueta, motivo: 'cambio' };
    }
    await a.deshacer();
    return { ok: true, etiqueta: a.etiqueta };
  } catch (e) {
    return { ok: false, etiqueta: a.etiqueta, motivo: 'error', error: e };
  }
}

/**
 * Ctrl+Z / Cmd+Z en la pantalla.
 *
 * Se ignora cuando el foco está en un campo de texto: ahí Ctrl+Z tiene que
 * seguir deshaciendo lo que se está tipeando, que es lo que el usuario espera.
 */
export function useAtajoDeshacer(alDeshacer, activo = true) {
  useEffect(() => {
    if (!activo) return;
    const enCampo = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    };
    const onKey = (e) => {
      const z = (e.key === 'z' || e.key === 'Z');
      if (!z || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (enCampo(document.activeElement)) return;   // deshacer del texto, no nuestro
      if (!pila.length) return;
      e.preventDefault();
      alDeshacer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alDeshacer, activo]);
}

/** Limpia la pila al montar la pantalla (y al salir). */
export function useDeshacerLimpio(dep) {
  useEffect(() => { limpiar(); return limpiar; }, [dep]);
}
