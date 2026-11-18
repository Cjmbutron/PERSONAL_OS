"use client";

import { useEffect } from "react";

/**
 * Tras enviar un formulario con errores, lleva el foco al primer campo inválido (D-123).
 * Un solo oyente global: no hace falta tocar cada formulario. Los campos ya marcan
 * `aria-invalid`; aquí solo se espera a que el servidor responda y aparezca el primero.
 */
export function FocusFirstError() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function stop() {
      observer?.disconnect();
      observer = null;
      clearTimeout(timer);
    }

    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      stop();
      const focusInvalid = () => {
        const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (!first) return false;
        first.focus();
        first.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        return true;
      };
      // Los errores de la respuesta anterior ya no cuentan: se espera a que cambie el formulario.
      observer = new MutationObserver(() => {
        if (focusInvalid()) stop();
      });
      observer.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-invalid"] });
      timer = setTimeout(stop, 4000);
    }

    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      stop();
    };
  }, []);

  return null;
}
