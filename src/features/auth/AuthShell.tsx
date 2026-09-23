import type { ReactNode } from 'react';
import { Soup } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="page" style={{ maxWidth: '28rem', paddingTop: 'calc(var(--space-6) + env(safe-area-inset-top))' }}>
      <div className="stack-lg">
        <div className="brand__mark" aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 18, alignSelf: 'center' }}>
          <Soup size={34} />
        </div>
        {children}
      </div>
    </main>
  );
}
