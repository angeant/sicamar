'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function MantenimientoPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header mínimo */}
      <header className="border-b border-neutral-100">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-neutral-400 hover:text-[#C4322F] transition-colors">
            ← Inicio
          </Link>
        </div>
      </header>

      {/* Contenido centrado */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center px-8 py-16 max-w-2xl">
          {/* Logo */}
          <div className="mb-12">
            <Image
              src="/sicamar.png"
              alt="Sicamar Metales"
              width={200}
              height={65}
              className="mx-auto opacity-90"
              priority
            />
          </div>

          {/* Título */}
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.4em] uppercase mb-3">
            Sicamar
          </p>
          <h1 className="text-5xl font-light text-neutral-200 tracking-wide mb-16">
            Mantenimiento
          </h1>

          {/* Enlace principal */}
          <div className="space-y-8">
            <Link
              href="/mantenimiento/imp_y_pre"
              className="group block"
            >
              <div className="border border-neutral-100 rounded-lg p-10 hover:border-neutral-200 hover:bg-neutral-50/50 transition-all duration-300">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-3">
                  Proyecto 2025
                </p>
                <h2 className="text-xl font-light text-neutral-600 mb-4 group-hover:text-neutral-800 transition-colors">
                  Detalle de Implementación y Presupuesto
                </h2>
                <p className="text-base text-neutral-400 leading-relaxed mb-5">
                  Reconstrucción integral del Sistema de Gestión de Mantenimiento
                </p>
                <span className="text-sm text-[#C4322F] opacity-0 group-hover:opacity-100 transition-opacity">
                  Ver detalle →
                </span>
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-100">
        <div className="max-w-4xl mx-auto px-8 h-14 flex items-center justify-center text-sm text-neutral-300">
          Sicamar Metales S.A. · powered by Kalia
        </div>
      </footer>
    </div>
  )
}
