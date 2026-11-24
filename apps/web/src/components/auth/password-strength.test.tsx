import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordStrength, passwordScore } from './password-strength';

describe('passwordScore', () => {
  it('caps short passwords at the lowest level', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('Ab1!')).toBeLessThanOrEqual(1);
  });

  it('rewards length and character variety', () => {
    const plain = passwordScore('abcdefghij');
    const varied = passwordScore('Abcdefgh1!');
    const long = passwordScore('Correct-Horse-Battery-9');
    expect(varied).toBeGreaterThan(plain);
    expect(long).toBe(4);
  });
});

describe('<PasswordStrength>', () => {
  it('shows the requirement and no rating while empty', () => {
    render(<PasswordStrength value="" />);
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/weak|fair|good|strong|too short/i)).not.toBeInTheDocument();
  });

  it('labels short and strong passwords', () => {
    const { rerender } = render(<PasswordStrength value="abc" />);
    expect(screen.getByText('Too short')).toBeInTheDocument();
    rerender(<PasswordStrength value="Correct-Horse-Battery-9" />);
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});
