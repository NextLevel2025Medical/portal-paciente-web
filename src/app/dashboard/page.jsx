'use client';
import { Suspense } from 'react';

function DashboardInner() {
  // TODO: TODO o seu componente aqui (estados/effects/JSX)
  return <div className="wrap">{/* seu JSX */}</div>;
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
