'use client';

import type { LearningDetail } from '@studythinker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-provider';

export const keys = {
  learnings: ['learnings'] as const,
  learning: (id: string) => ['learnings', id] as const,
  step: (id: string, stepId: string) => ['learnings', id, 'steps', stepId] as const,
  assessments: (id: string) => ['learnings', id, 'assessments'] as const,
  assessment: (id: string) => ['assessments', id] as const,
  conversation: (id: string) => ['conversations', id] as const,
  aiSettings: ['ai', 'settings'] as const,
  aiStatus: ['ai', 'status'] as const,
  progress: ['progress'] as const,
  history: (id: string) => ['learnings', id, 'history'] as const,
};

function useSignedIn() {
  return useAuth().status === 'authenticated';
}

export function useLearnings() {
  return useQuery({
    queryKey: keys.learnings,
    queryFn: api.learnings.list,
    enabled: useSignedIn(),
  });
}

/** Polls while the journey is being built. */
export function useLearning(id: string) {
  return useQuery({
    queryKey: keys.learning(id),
    queryFn: () => api.learnings.get(id),
    enabled: useSignedIn(),
    // Poll quickly while the AI works, so the learner sees it happen.
    refetchInterval: (q) =>
      q.state.data?.live ? 900 : q.state.data?.status === 'BUILDING' ? 2000 : false,
  });
}

export function useSetLearning() {
  const qc = useQueryClient();
  return (learning: LearningDetail) => {
    qc.setQueryData(keys.learning(learning.id), learning);
    void qc.invalidateQueries({ queryKey: keys.learnings, exact: true });
    void qc.invalidateQueries({ queryKey: keys.progress });
    void qc.invalidateQueries({ queryKey: keys.history(learning.id) });
  };
}

export function useStep(id: string, stepId: string) {
  return useQuery({
    queryKey: keys.step(id, stepId),
    queryFn: () => api.learnings.step(id, stepId),
    enabled: useSignedIn(),
  });
}

export function useAssessments(learningId: string) {
  return useQuery({
    queryKey: keys.assessments(learningId),
    queryFn: () => api.learnings.assessments(learningId),
    enabled: useSignedIn(),
  });
}

export function useAssessment(id: string) {
  return useQuery({
    queryKey: keys.assessment(id),
    queryFn: () => api.assessments.get(id),
    enabled: useSignedIn(),
  });
}

export function useAiStatus() {
  return useQuery({ queryKey: keys.aiStatus, queryFn: api.ai.status, enabled: useSignedIn() });
}

export function useAiSettings() {
  return useQuery({ queryKey: keys.aiSettings, queryFn: api.ai.settings, enabled: useSignedIn() });
}

export function useInvalidateAi() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['ai'] });
  };
}

export function useDeleteLearning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.learnings.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: keys.learning(id) });
      void qc.invalidateQueries({ queryKey: keys.learnings, exact: true });
    },
  });
}

/** XP, level, streak, weekly goal, badges. Refreshed after anything that can earn XP. */
export function useProgress() {
  return useQuery({
    queryKey: keys.progress,
    queryFn: api.progress.get,
    enabled: useSignedIn(),
    staleTime: 15_000,
  });
}

/** Call after an action that may have earned XP. */
export function useRefreshProgress() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: keys.progress });
}

export function useHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.history(id),
    queryFn: () => api.learnings.history(id),
    enabled: useSignedIn() && enabled,
  });
}
