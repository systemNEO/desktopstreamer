import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionCard } from '../../../src/renderer/components/SectionCard';

describe('SectionCard', () => {
  it('rendert step-Nummer und Titel', () => {
    render(
      <SectionCard step={1} title="Was streamen?">
        <p>kid</p>
      </SectionCard>
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Was streamen?')).toBeInTheDocument();
  });

  it('rendert children', () => {
    render(
      <SectionCard step={2} title="t">
        <p data-testid="kid">child-content</p>
      </SectionCard>
    );
    expect(screen.getByTestId('kid')).toBeInTheDocument();
  });
});
