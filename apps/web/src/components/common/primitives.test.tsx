import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('explains an unreachable API in plain language and retries', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' })}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/can’t reach StudyThinker/i);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the request reference when the API provides one', () => {
    render(
      <ErrorState
        error={
          new ApiError({ status: 500, code: 'INTERNAL', message: 'boom', requestId: 'req-42' })
        }
      />,
    );
    expect(screen.getByText(/req-42/)).toBeInTheDocument();
  });
});

describe('initials', () => {
  it('uses letters only', async () => {
    const { initials } = await import('@/components/shell/user-menu');
    expect(initials('Maya (demo)')).toBe('MD');
    expect(initials('ada lovelace')).toBe('AL');
    expect(initials('  ')).toBe('?');
    expect(initials(undefined)).toBe('?');
  });
});
