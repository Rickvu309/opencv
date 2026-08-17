"use client";

import { ScreenNotice } from "@/components/layout/not-found";
import { useT } from "@/lib/i18n/use-t";

export function RouteError() {
  const { t, m } = useT();
  return (
    <ScreenNotice
      title={t(m.support.errorTitle)}
      body={t(m.support.errorBody)}
      action={t(m.support.errorAction)}
    />
  );
}
