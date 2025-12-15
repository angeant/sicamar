'use client'

import { useState, useRef } from 'react'
import { User, Camera, Loader2, Trash2, X } from 'lucide-react'

interface EmpleadoAvatarProps {
  foto_url?: string | null
  foto_thumb_url?: string | null
  nombre?: string | null
  apellido?: string | null
  legajo?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-24 h-24 text-2xl'
}

export function EmpleadoAvatar({ 
  foto_url,
  foto_thumb_url,
  nombre,
  apellido,
  legajo,
  size = 'sm',
  className = ''
}: EmpleadoAvatarProps) {
  const initials = `${apellido?.[0] || ''}${nombre?.[0] || ''}`.toUpperCase()
  
  // Usar thumbnail para tamaños pequeños, foto completa para grande
  const useThumb = size === 'xs' || size === 'sm' || size === 'md'
  const imageUrl = useThumb 
    ? (foto_thumb_url || foto_url) 
    : foto_url

  if (imageUrl) {
    return (
      <img 
        src={imageUrl} 
        alt={apellido && nombre ? `${apellido}, ${nombre}` : `Empleado ${legajo}`}
        className={`${sizeClasses[size]} rounded-full object-cover bg-gray-100 shrink-0 ${className}`}
        onError={(e) => {
          // Fallback: ocultar imagen y mostrar iniciales
          const target = e.currentTarget
          target.style.display = 'none'
          const fallback = target.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
    )
  }

  // Fallback sin foto
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium shrink-0 ${className}`}>
      {initials || (legajo ? legajo.slice(-2) : <User className="w-1/2 h-1/2" />)}
    </div>
  )
}

// ========== COMPONENTE DE UPLOAD ==========

interface FotoUploadProps {
  empleadoId: number
  foto_url?: string | null
  foto_thumb_url?: string | null
  nombre?: string | null
  apellido?: string | null
  legajo?: string | null
  onUpdate?: (foto_url: string, foto_thumb_url: string) => void
  onDelete?: () => void
}

export function FotoUpload({
  empleadoId,
  foto_url,
  foto_thumb_url,
  nombre,
  apellido,
  legajo,
  onUpdate,
  onDelete
}: FotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = `${apellido?.[0] || ''}${nombre?.[0] || ''}`.toUpperCase()
  const displayUrl = preview || foto_url

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB')
      return
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes')
      return
    }

    setError(null)
    
    // Mostrar preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Subir
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('foto', file)

      const res = await fetch(`/api/sicamar/empleados/${empleadoId}/foto`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al subir imagen')
      }

      // Actualizar con cache buster
      const cacheBuster = `?t=${Date.now()}`
      onUpdate?.(data.foto_url + cacheBuster, data.foto_thumb_url + cacheBuster)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen')
      setPreview(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    if (!foto_url || !confirm('¿Eliminar la foto de este empleado?')) return

    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/sicamar/empleados/${empleadoId}/foto`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      onDelete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setIsDeleting(false)
    }
  }

  const cancelPreview = () => {
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar con overlay de upload */}
      <div className="relative group">
        {displayUrl ? (
          <img 
            src={displayUrl}
            alt={`${apellido}, ${nombre}`}
            className="w-24 h-24 rounded-full object-cover bg-gray-100 border-2 border-gray-200"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-medium border-2 border-gray-200">
            {initials || <User className="w-10 h-10" />}
          </div>
        )}

        {/* Overlay de carga */}
        {(isUploading || isDeleting) && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {/* Botón de cambiar foto */}
        {!isUploading && !isDeleting && !preview && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 rounded-full flex items-center justify-center transition-all cursor-pointer"
          >
            <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {/* Botón cancelar preview */}
        {preview && !isUploading && (
          <button
            onClick={cancelPreview}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Input file oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Acciones */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isDeleting}
          className="text-[11px] text-pink-600 hover:text-pink-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Camera className="w-3 h-3" />
          {foto_url ? 'Cambiar' : 'Subir'} foto
        </button>
        
        {foto_url && !preview && (
          <button
            onClick={handleDelete}
            disabled={isUploading || isDeleting}
            className="text-[11px] text-gray-400 hover:text-red-500 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            Eliminar
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-red-500 text-center max-w-[150px]">{error}</p>
      )}
    </div>
  )
}

// Versión simple que acepta un objeto empleado
interface EmpleadoSimple {
  foto_url?: string | null
  foto_thumb_url?: string | null
  nombre?: string | null
  apellido?: string | null
  legajo?: string | null
}

export function EmpleadoAvatarSimple({ 
  empleado, 
  size = 'sm',
  className = ''
}: { 
  empleado: EmpleadoSimple
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <EmpleadoAvatar
      foto_url={empleado.foto_url}
      foto_thumb_url={empleado.foto_thumb_url}
      nombre={empleado.nombre}
      apellido={empleado.apellido}
      legajo={empleado.legajo}
      size={size}
      className={className}
    />
  )
}

