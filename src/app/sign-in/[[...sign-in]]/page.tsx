"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { Factory, Shield, Users, Clock } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#C4322F] rounded-full blur-[100px]" />
          <div className="absolute bottom-40 right-20 w-96 h-96 bg-[#e94560] rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-amber-500 rounded-full blur-[80px]" />
        </div>

        {/* Grid Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div>
            <Image
              src="/sicamar.png"
              alt="Sicamar Metales"
              width={180}
              height={60}
              className="h-14 w-auto brightness-0 invert"
              priority
            />
          </div>

          {/* Main Message */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Sistema de Gestión
                <span className="block text-[#e94560]">Recursos Humanos</span>
              </h1>
              <p className="text-lg text-gray-300 max-w-md leading-relaxed">
                Plataforma integral para la administración eficiente del capital humano de Sicamar Metales S.A.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <FeatureCard 
                icon={Users} 
                title="Nómina Completa" 
                description="Gestión integral de empleados"
              />
              <FeatureCard 
                icon={Clock} 
                title="Control de Asistencia" 
                description="Marcaciones y turnos"
              />
              <FeatureCard 
                icon={Factory} 
                title="Planta Industrial" 
                description="Layout y asignaciones"
              />
              <FeatureCard 
                icon={Shield} 
                title="Seguridad" 
                description="EPP y capacitaciones"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="text-sm text-gray-500">
            <p>© 2025 Sicamar Metales S.A. · Powered by Kalia</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-center py-8 bg-[#1a1a2e]">
          <Image
            src="/sicamar.png"
            alt="Sicamar Metales"
            width={160}
            height={50}
            className="h-12 w-auto brightness-0 invert"
            priority
          />
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-md space-y-8">
            {/* Welcome Text */}
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-gray-900">
                Bienvenido de nuevo
              </h2>
              <p className="mt-2 text-gray-600">
                Ingresá tus credenciales para acceder al sistema
              </p>
            </div>

            {/* Clerk SignIn Component */}
            <div className="flex justify-center">
              <SignIn 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none bg-transparent w-full",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton: "border-gray-300 hover:bg-gray-50 text-gray-700",
                    formFieldInput: "border-gray-300 focus:border-[#C4322F] focus:ring-[#C4322F]/20",
                    formButtonPrimary: "bg-[#C4322F] hover:bg-[#a82926] text-white shadow-lg shadow-[#C4322F]/25",
                    footerActionLink: "text-[#C4322F] hover:text-[#a82926]",
                    identityPreviewEditButton: "text-[#C4322F]",
                    formFieldAction: "text-[#C4322F]",
                    footer: "hidden"
                  },
                  layout: {
                    socialButtonsPlacement: "bottom",
                    showOptionalFields: false,
                  }
                }}
              />
            </div>

            {/* Additional Info */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t border-gray-200">
              <p>¿Problemas para ingresar? Contactá a RRHH</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-colors">
      <Icon className="w-5 h-5 text-[#e94560] mb-2" />
      <h3 className="font-semibold text-white text-sm">{title}</h3>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}

