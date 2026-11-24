'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

/** What the assistant should know about the screen the learner is on. */
export interface AssistantPage {
  /** A short description, e.g. "Settings → AI" or "Step “Chords” of Guitar". */
  page: string;
  /** On a learning's journey the assistant can also change the plan. */
  coach?: { learningId: string; title: string; language?: string };
}

const Ctx = createContext<{
  page: AssistantPage | null;
  setPage: (p: AssistantPage | null) => void;
}>({ page: null, setPage: () => undefined });

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [page, setPage] = useState<AssistantPage | null>(null);
  const value = useMemo(() => ({ page, setPage }), [page]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAssistantContext = () => useContext(Ctx);

/** Tells the assistant what this screen is about (cleared when the screen goes away). */
export function useAssistantPage(page: string, coach?: AssistantPage['coach']) {
  const { setPage } = useContext(Ctx);
  const learningId = coach?.learningId;
  const title = coach?.title;
  const language = coach?.language;
  useEffect(() => {
    setPage({
      page,
      coach: learningId ? { learningId, title: title ?? '', language } : undefined,
    });
    return () => setPage(null);
  }, [setPage, page, learningId, title, language]);
}
