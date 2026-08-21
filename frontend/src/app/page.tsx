'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
      <p className="text-sm font-semibold text-gray-500">Redirecionando para o painel...</p>
    </div>
  );
}
