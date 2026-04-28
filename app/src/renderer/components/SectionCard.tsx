import type { ReactNode } from 'react';

interface SectionCardProps {
  step: number;
  title: string;
  children: ReactNode;
}

export function SectionCard({ step, title, children }: SectionCardProps) {
  return (
    <section className="bg-bg-surface rounded-xl p-6 border border-bg-hover">
      <header className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold">
          {step}
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
      </header>
      <div>{children}</div>
    </section>
  );
}
