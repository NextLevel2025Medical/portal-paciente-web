'use client';

import { Suspense } from 'react';
import Dashboard from '../../components/Dashboard';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
