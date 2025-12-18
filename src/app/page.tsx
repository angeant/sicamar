'use client'

import { useAuth, useUser, SignInButton } from "@clerk/nextjs"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"

// Tipos para el log de actividad
interface MarcacionLog {
  id: number
  id_biometrico: string
  tipo: 'E' | 'S'
  fecha_hora: string
  hora_local: string
  empleado: {
    id: number
    legajo: string
    nombre: string
    apellido: string
    nombre_completo: string
    sector: string
    categoria: string
    foto_thumb_url: string | null
  } | null
}

// Determinar turno actual basado en la hora
function getTurnoActual(hora: number): { nombre: string; inicio: string; fin: string; color: string } {
  if (hora >= 6 && hora < 14) {
    return { nombre: 'Mañana', inicio: '06:00', fin: '14:00', color: 'text-[#C4322F]' }
  } else if (hora >= 14 && hora < 22) {
    return { nombre: 'Tarde', inicio: '14:00', fin: '22:00', color: 'text-[#C4322F]' }
  } else {
    return { nombre: 'Noche', inicio: '22:00', fin: '06:00', color: 'text-[#C4322F]' }
  }
}

function getTurnoSiguiente(hora: number): { nombre: string; inicio: string } {
  if (hora >= 6 && hora < 14) {
    return { nombre: 'Tarde', inicio: '14:00' }
  } else if (hora >= 14 && hora < 22) {
    return { nombre: 'Noche', inicio: '22:00' }
  } else {
    return { nombre: 'Mañana', inicio: '06:00' }
  }
}

function getTurnoAnterior(hora: number): { nombre: string; fin: string } {
  if (hora >= 6 && hora < 14) {
    return { nombre: 'Noche', fin: '06:00' }
  } else if (hora >= 14 && hora < 22) {
    return { nombre: 'Mañana', fin: '14:00' }
  } else {
    return { nombre: 'Tarde', fin: '22:00' }
  }
}

// Determinar turno de una hora específica
function getTurnoDeHora(hora: number): string {
  if (hora >= 6 && hora < 14) return 'Mañana'
  if (hora >= 14 && hora < 22) return 'Tarde'
  return 'Noche'
}

// Componente Avatar pequeño con foto B&W
function AvatarMini({ foto_thumb_url, nombre, apellido }: { foto_thumb_url: string | null, nombre: string, apellido: string }) {
  const iniciales = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()
  
  if (foto_thumb_url) {
    return (
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
        <img 
          src={foto_thumb_url} 
          alt={`${nombre} ${apellido}`}
          className="w-full h-full object-cover grayscale"
        />
      </div>
    )
  }
  
  return (
    <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-400 flex-shrink-0">
      {iniciales}
    </div>
  )
}

// Log de actividad del sistema
function ActivityLog() {
  const [marcaciones, setMarcaciones] = useState<MarcacionLog[]>([])
  const [loading, setLoading] = useState(true)
  
  const cargarMarcaciones = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/sicamar/marcaciones?fecha=${hoy}`)
      const data = await res.json()
      
      if (data.marcaciones) {
        // Ordenar por fecha_hora descendente (más recientes primero)
        const ordenadas = [...data.marcaciones].sort((a: MarcacionLog, b: MarcacionLog) => 
          new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime()
        )
        setMarcaciones(ordenadas.slice(0, 30)) // Últimas 30
      }
    } catch (err) {
      console.error('Error cargando marcaciones:', err)
    } finally {
      setLoading(false)
    }
  }, [])
  
  useEffect(() => {
    cargarMarcaciones()
    // Refrescar cada 30 segundos
    const interval = setInterval(cargarMarcaciones, 30000)
    return () => clearInterval(interval)
  }, [cargarMarcaciones])
  
  const formatHora = (fechaStr: string, horaLocal: string) => {
    return horaLocal.slice(0, 5) // HH:MM
  }
  
  const formatFecha = (fechaStr: string) => {
    const fecha = new Date(fechaStr)
    const ahora = new Date()
    const esHoy = fecha.toDateString() === ahora.toDateString()
    
    if (esHoy) {
      return 'Hoy'
    }
    return fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Header del log */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-300">
          Actividad en planta
        </p>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-neutral-300">En vivo</span>
        </div>
      </div>
      
      {/* Lista de actividad */}
      <div className="flex-1 overflow-y-auto space-y-0.5 -mx-1 px-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-neutral-300 text-xs">Cargando...</span>
          </div>
        ) : marcaciones.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-neutral-300 text-xs">Sin actividad hoy</span>
          </div>
        ) : (
          marcaciones.map((marc) => {
            const horaNum = new Date(marc.fecha_hora).getHours()
            const turno = getTurnoDeHora(horaNum)
            const esEntrada = marc.tipo === 'E'
            
            return (
              <div 
                key={marc.id}
                className="flex items-center gap-3 py-2 px-2 rounded hover:bg-neutral-50/50 transition-colors group"
              >
                {/* Avatar */}
                {marc.empleado ? (
                  <AvatarMini 
                    foto_thumb_url={marc.empleado.foto_thumb_url}
                    nombre={marc.empleado.nombre}
                    apellido={marc.empleado.apellido}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs text-neutral-300 flex-shrink-0">
                    ?
                  </div>
                )}
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-600 truncate">
                    {marc.empleado?.nombre_completo || marc.id_biometrico}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                    <span className={esEntrada ? 'text-green-500' : 'text-neutral-400'}>
                      {esEntrada ? '→ Entró' : '← Salió'}
                    </span>
                    <span>·</span>
                    <span>Turno {turno}</span>
                  </div>
                </div>
                
                {/* Hora */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm tabular-nums text-neutral-500">
                    {formatHora(marc.fecha_hora, marc.hora_local)}
                  </p>
                  <p className="text-[10px] text-neutral-300">
                    {formatFecha(marc.fecha_hora)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
      
      {/* Footer con stats */}
      <div className="pt-4 mt-2 border-t border-neutral-100">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>{marcaciones.filter(m => m.tipo === 'E').length} entradas</span>
          <span>{marcaciones.filter(m => m.tipo === 'S').length} salidas</span>
        </div>
      </div>
    </div>
  )
}

function DashboardArtistico() {
  const [tiempo, setTiempo] = useState(new Date())
  
  useEffect(() => {
    const interval = setInterval(() => setTiempo(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  
  const hora = tiempo.getHours()
  const minutos = tiempo.getMinutes()
  const segundos = tiempo.getSeconds()
  
  const turnoActual = getTurnoActual(hora)
  const turnoSiguiente = getTurnoSiguiente(hora)
  const turnoAnterior = getTurnoAnterior(hora)
  
  // Calcular progreso del turno (0-100) y tiempos
  const calcularTiempos = () => {
    let minutosDesdeInicio: number
    if (hora >= 6 && hora < 14) {
      minutosDesdeInicio = (hora - 6) * 60 + minutos
    } else if (hora >= 14 && hora < 22) {
      minutosDesdeInicio = (hora - 14) * 60 + minutos
    } else if (hora >= 22) {
      minutosDesdeInicio = (hora - 22) * 60 + minutos
    } else {
      minutosDesdeInicio = (hora + 2) * 60 + minutos // 00:00 a 06:00
    }
    const minutosRestantes = 480 - minutosDesdeInicio
    const progreso = Math.min((minutosDesdeInicio / 480) * 100, 100)
    
    const horasTranscurridas = Math.floor(minutosDesdeInicio / 60)
    const minsTranscurridos = minutosDesdeInicio % 60
    const horasRestantes = Math.floor(minutosRestantes / 60)
    const minsRestantes = minutosRestantes % 60
    
    return { 
      progreso, 
      transcurrido: `${horasTranscurridas}h ${minsTranscurridos}m`,
      restante: `${horasRestantes}h ${minsRestantes}m`
    }
  }
  
  const { progreso, transcurrido, restante } = calcularTiempos()
  
  // Formatear fecha
  const fechaFormateada = tiempo.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
  
  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden py-8">
      {/* Grid de dos columnas: 1fr para dashboard, 2fr para log */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
        
        {/* Columna izquierda: Dashboard del turno (1 fracción) */}
        <div className="text-center lg:text-left">
          {/* SICAMAR arriba en rojo pequeño */}
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          
          {/* Imagen con bordes a blanco */}
          <div className="relative w-full h-48 md:h-56 mb-4">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: 'url(/caratula_sicamar.png)',
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
          
          {/* Recursos Humanos debajo de la imagen */}
          <h1 className="text-2xl md:text-3xl font-light text-neutral-300 tracking-wide mb-4">
            Recursos Humanos
          </h1>
          
          {/* Fecha */}
          <p className="text-xs text-neutral-400 uppercase tracking-widest mb-6">
            {fechaFormateada}
          </p>
          
          {/* Reloj grande */}
          <div className="mb-8">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-5xl md:text-6xl font-extralight text-neutral-900 tabular-nums">
                {String(hora).padStart(2, '0')}
              </span>
              <span className="text-5xl md:text-6xl font-extralight text-[#C4322F] animate-pulse">
                :
              </span>
              <span className="text-5xl md:text-6xl font-extralight text-neutral-900 tabular-nums">
                {String(minutos).padStart(2, '0')}
              </span>
              <span className="text-2xl md:text-3xl font-extralight text-neutral-400 tabular-nums ml-2">
                {String(segundos).padStart(2, '0')}
              </span>
            </div>
          </div>
          
          {/* Línea de progreso del turno con tiempos */}
          <div className="relative mb-4 max-w-xs mx-auto lg:mx-0">
            {/* Labels de tiempo */}
            <div className="flex justify-between text-xs text-neutral-400 mb-2">
              <span>{transcurrido}</span>
              <span>{restante}</span>
            </div>
            
            {/* Barra de progreso */}
            <div className="relative">
              <div className="h-1 bg-neutral-100 w-full rounded-full" />
              <div 
                className="absolute top-0 left-0 h-1 bg-[#C4322F] rounded-full transition-all duration-1000"
                style={{ width: `${progreso}%` }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-[#C4322F] rounded-full shadow-lg shadow-[#C4322F]/50 transition-all duration-1000 border-2 border-white"
                style={{ left: `${progreso}%` }}
              />
            </div>
            
            {/* Labels inicio/fin */}
            <div className="flex justify-between text-xs text-neutral-300 mt-2">
              <span>{turnoActual.inicio}</span>
              <span>{turnoActual.fin}</span>
            </div>
          </div>
          
          {/* Turno actual centrado */}
          <div className="text-center lg:text-left mb-6">
            <p className={`text-lg font-medium ${turnoActual.color}`}>
              Turno {turnoActual.nombre}
            </p>
          </div>
          
          {/* Anterior y Próximo */}
          <div className="flex items-center justify-center lg:justify-start gap-8 text-sm mb-8">
            <div className="text-center lg:text-left">
              <p className="text-neutral-300 text-[10px] uppercase tracking-wider mb-0.5">Anterior</p>
              <p className="text-neutral-400 text-sm">
                {turnoAnterior.nombre}
              </p>
            </div>
            
            <div className="w-px h-8 bg-neutral-100" />
            
            <div className="text-center lg:text-left">
              <p className="text-neutral-300 text-[10px] uppercase tracking-wider mb-0.5">Próximo</p>
              <p className="text-neutral-400 text-sm">
                {turnoSiguiente.nombre}
              </p>
            </div>
          </div>
          
          {/* Link a Planificación */}
          <div>
            <Link 
              href="/planificacion"
              className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#C4322F] transition-colors"
            >
              <span>Ver Planificación</span>
              <span>→</span>
            </Link>
          </div>
        </div>
        
        {/* Columna derecha: Log de actividad (2 fracciones) */}
        <div className="lg:col-span-2 h-[calc(100vh-8rem)] min-h-[500px] max-h-[700px]">
          <div className="h-full border-l border-neutral-100 pl-8">
            <ActivityLog />
          </div>
        </div>
        
      </div>
      
      {/* Footer con logo Kalia */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <img 
          src="/kalia_logo_black.svg" 
          alt="Kalia" 
          className="h-5 opacity-20 hover:opacity-40 transition-opacity cursor-pointer"
        />
      </div>
    </div>
  )
}

// Página de login para no autenticados - misma estética que dashboard
function LoginPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden py-8">
      <div className="relative z-10 text-center px-4 max-w-md">
        {/* SICAMAR arriba en rojo pequeño */}
        <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
          Sicamar
        </p>
        
        {/* Imagen con bordes a blanco */}
        <div className="relative w-full h-48 md:h-56 mb-4">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/caratula_sicamar.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </div>
        
        {/* Recursos Humanos debajo de la imagen */}
        <h1 className="text-2xl md:text-3xl font-light text-neutral-300 tracking-wide mb-4">
          Recursos Humanos
        </h1>
        
        <p className="text-xs text-neutral-400 mb-8">
          Sistema de Gestión de Planificación y Jornadas
        </p>
        
        {/* Botón de acceso */}
        <SignInButton mode="modal">
          <button className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#C4322F] transition-colors cursor-pointer">
            <span>Acceder</span>
            <span>→</span>
          </button>
        </SignInButton>
      </div>
      
      {/* Footer con logo Kalia */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <img 
          src="/kalia_logo_black.svg" 
          alt="Kalia" 
          className="h-5 opacity-20 hover:opacity-40 transition-opacity cursor-pointer"
        />
      </div>
    </div>
  )
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const [isSicamarMember, setIsSicamarMember] = useState<boolean | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(false)
  
  // Verificar membresía a Sicamar
  useEffect(() => {
    async function checkMembership() {
      if (!user?.id) return
      
      setCheckingAccess(true)
      try {
        const res = await fetch(`/api/auth/check-sicamar?userId=${user.id}`)
        const data = await res.json()
        setIsSicamarMember(data.isMember)
      } catch (err) {
        console.error('Error checking membership:', err)
        setIsSicamarMember(false)
      } finally {
        setCheckingAccess(false)
      }
    }
    
    if (isSignedIn && user) {
      checkMembership()
    }
  }, [isSignedIn, user])
  
  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Cargando...</div>
      </div>
    )
  }
  
  // No autenticado: mostrar login
  if (!isSignedIn) {
    return <LoginPage />
  }
  
  // Verificando acceso
  if (checkingAccess || isSicamarMember === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-neutral-300 text-sm">Verificando acceso...</div>
      </div>
    )
  }
  
  // Sin acceso a Sicamar
  if (!isSicamarMember) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-sm font-medium text-[#C4322F] tracking-[0.3em] uppercase mb-4">
            Sicamar
          </p>
          <h1 className="text-2xl font-light text-neutral-300 mb-4">
            Acceso Restringido
          </h1>
          <p className="text-sm text-neutral-400 mb-8">
            No tenés permisos para acceder a este sistema.<br />
            Contactá al administrador si creés que es un error.
          </p>
          <p className="text-xs text-neutral-300">
            {user?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>
    )
  }
  
  // Autenticado y es miembro: mostrar dashboard
  return <DashboardArtistico />
}
