"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Factory, Shield, Users, Clock, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";

type Step = "email" | "otp" | "success";

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Enviar código OTP al email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    
    setLoading(true);
    setError("");

    try {
      // Iniciar el flujo de sign-in con email code
      await signIn.create({
        identifier: email,
        strategy: "email_code",
      });
      
      // Pasar al paso de verificación
      setStep("otp");
    } catch (err: unknown) {
      const error = err as { errors?: Array<{ message: string }> };
      setError(error.errors?.[0]?.message || "Error al enviar el código. Verificá tu email.");
    } finally {
      setLoading(false);
    }
  };

  // Verificar código OTP
  const handleVerifyCode = async (otpCode: string) => {
    if (!isLoaded || !signIn || otpCode.length !== 6) return;
    
    setLoading(true);
    setError("");

    try {
      // Intentar completar el sign-in con el código
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: otpCode,
      });

      if (result.status === "complete") {
        // Éxito - activar la sesión
        setStep("success");
        await setActive({ session: result.createdSessionId });
        
        // Redirigir después de un breve delay para mostrar el mensaje de éxito
        setTimeout(() => {
          router.push("/rrhh");
        }, 1000);
      }
    } catch (err: unknown) {
      const error = err as { errors?: Array<{ message: string }> };
      setError(error.errors?.[0]?.message || "Código inválido. Intentá de nuevo.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio en OTP
  const handleOTPChange = (value: string) => {
    setCode(value);
    setError("");
    
    // Auto-verificar cuando se completan 6 dígitos
    if (value.length === 6) {
      handleVerifyCode(value);
    }
  };

  // Volver al paso de email
  const handleBack = () => {
    setStep("email");
    setCode("");
    setError("");
  };

  // Reenviar código
  const handleResendCode = async () => {
    if (!isLoaded || !signIn) return;
    
    setLoading(true);
    setError("");

    try {
      await signIn.create({
        identifier: email,
        strategy: "email_code",
      });
      setCode("");
    } catch (err: unknown) {
      const error = err as { errors?: Array<{ message: string }> };
      setError(error.errors?.[0]?.message || "Error al reenviar el código.");
    } finally {
      setLoading(false);
    }
  };

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
          <Card className="w-full max-w-md shadow-xl border-0">
            {step === "email" && (
              <>
                <CardHeader className="space-y-1 pb-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#C4322F]/10 flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-[#C4322F]" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Bienvenido</CardTitle>
                  <CardDescription className="text-base">
                    Ingresá tu email corporativo para recibir un código de acceso
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSendCode} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email corporativo
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu.nombre@sicamar.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        required
                        disabled={loading}
                        className="h-12 text-base"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <Button 
                      type="submit" 
                      disabled={loading || !email}
                      className="w-full h-12 text-base font-semibold bg-[#C4322F] hover:bg-[#a82926] shadow-lg shadow-[#C4322F]/25"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Enviando código...
                        </>
                      ) : (
                        <>
                          Continuar
                          <Mail className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-sm text-gray-500">
                      Te enviaremos un código de 6 dígitos a tu email
                    </p>
                  </form>
                </CardContent>
              </>
            )}

            {step === "otp" && (
              <>
                <CardHeader className="space-y-1 pb-6">
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                  </button>
                  <div className="w-14 h-14 rounded-2xl bg-[#C4322F]/10 flex items-center justify-center mb-4">
                    <Shield className="w-7 h-7 text-[#C4322F]" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Verificá tu identidad</CardTitle>
                  <CardDescription className="text-base">
                    Ingresá el código de 6 dígitos que enviamos a{" "}
                    <span className="font-medium text-gray-700">{email}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={code}
                        onChange={handleOTPChange}
                        disabled={loading}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                          <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                          <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                          <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                          <InputOTPSlot index={5} className="w-12 h-14 text-xl" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    {loading && (
                      <div className="flex items-center justify-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Verificando...</span>
                      </div>
                    )}

                    {error && (
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-600 text-center">{error}</p>
                      </div>
                    )}

                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-2">
                        ¿No recibiste el código?
                      </p>
                      <button
                        onClick={handleResendCode}
                        disabled={loading}
                        className="text-sm font-medium text-[#C4322F] hover:text-[#a82926] transition-colors disabled:opacity-50"
                      >
                        Reenviar código
                      </button>
                    </div>
                  </div>
                </CardContent>
              </>
            )}

            {step === "success" && (
              <>
                <CardHeader className="space-y-1 pb-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-green-700">¡Bienvenido!</CardTitle>
                  <CardDescription className="text-base">
                    Acceso verificado correctamente. Redirigiendo al sistema...
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[#C4322F]" />
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 text-center">
          <p className="text-xs text-gray-400">
            ¿Problemas para ingresar? Contactá a RRHH
          </p>
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
