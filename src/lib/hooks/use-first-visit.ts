"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "hubi-tour-seen:";

/** Controla se o tutorial de uma tela deve aparecer (uma vez por navegador). */
export function useFirstVisit(screenKey: string) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_PREFIX + screenKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!seen) setShow(true);
    } catch {
      // localStorage indisponivel (ex.: navegacao privada) - tutorial nao aparece
    }
  }, [screenKey]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_PREFIX + screenKey, "1");
    } catch {
      // idem acima - sem persistencia, mas nao quebra a tela
    }
  }

  return { show, dismiss };
}
