import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Shield, Users, Factory, Clock } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  
  // If user is authenticated, redirect to RRHH
  if (userId) {
    redirect("/rrhh");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-20">
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

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 md:p-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Image
              src="/sicamar.png"
              alt="Sicamar Metales"
              width={160}
              height={50}
              className="h-10 md:h-12 w-auto brightness-0 invert"
              priority
            />
            <Link
              href="/sign-in"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#C4322F] hover:bg-[#a82926] text-white rounded-lg font-medium transition-all shadow-lg shadow-[#C4322F]/25 hover:shadow-[#C4322F]/40"
            >
              Ingresar
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center">
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-12 w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left - Text */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-gray-300">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Sistema en línea
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                  Gestión de
                  <span className="block text-[#e94560]">Recursos Humanos</span>
                </h1>

                <p className="text-lg md:text-xl text-gray-300 max-w-xl leading-relaxed">
                  Plataforma integral para la administración eficiente del capital humano. 
                  Control de asistencia, liquidaciones, capacitaciones y más.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/sign-in"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#C4322F] hover:bg-[#a82926] text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-[#C4322F]/25 hover:shadow-[#C4322F]/40 hover:scale-[1.02]"
                  >
                    Acceder al Sistema
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Right - Features Grid */}
              <div className="grid grid-cols-2 gap-4">
                <FeatureCard
                  icon={Users}
                  title="Nómina Completa"
                  description="Gestión integral de todos los empleados con legajos digitales"
                  delay="0"
                />
                <FeatureCard
                  icon={Clock}
                  title="Control de Tiempo"
                  description="Marcaciones, turnos rotativos y validación de jornadas"
                  delay="100"
                />
                <FeatureCard
                  icon={Factory}
                  title="Planta Industrial"
                  description="Layout interactivo y asignación de posiciones"
                  delay="200"
                />
                <FeatureCard
                  icon={Shield}
                  title="Seguridad Laboral"
                  description="EPP, capacitaciones y cumplimiento normativo"
                  delay="300"
                />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 md:p-8">
          <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
            <p>© 2025 Sicamar Metales S.A. · Sistema de Gestión RRHH · Powered by Kalia</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: string;
}) {
  return (
    <div 
      className="p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-[#e94560]/30"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-[#e94560]/20 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#e94560]" />
      </div>
      <h3 className="font-semibold text-white text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}
