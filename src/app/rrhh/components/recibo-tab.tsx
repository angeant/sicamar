'use client'

import { useState, useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import {
  Download,
  Printer,
  Palette,
  FileText,
  Building2,
  User,
  DollarSign,
  Calendar,
  Briefcase,
  FileSignature,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react'
import { ContextoButton, ContextoModal } from './contexto-modal'

// Firma del empleador embebida (no pública)
import { FIRMA_EMPLEADOR_BASE64 } from '@/lib/sicamar/firma-empleador'

// ===========================================
// TIPOS
// ===========================================

interface Concepto {
  codigo: string
  concepto: string
  unidades?: number
  haberesConDesc?: number
  haberesSinDesc?: number
  descuentos?: number
}

interface DatosRecibo {
  empresa: {
    nombre: string
    direccion: string
    cuit: string
    logo?: string
  }
  fechaPago: string
  periodoPago: string
  legajo: string
  empleado: {
    apellidoNombres: string
    dni: string
    fechaIngreso: string
    sector: string
    categoria: string
    basico: number
    cuil: string
  }
  conceptos: Concepto[]
  totalHaberesConDesc: number
  totalHaberesSinDesc: number
  totalDescuentos: number
  netoACobrar: number
  fechaDeposito: string
  antiguedad: string
  banco: string
  cbu: string
  montoEnLetras: string
  domicilio: string
}

type EstadoRecibo = 'borrador' | 'firmado_empleador' | 'firmado_completo' | 'rechazado'

// ===========================================
// DATOS DE EJEMPLO
// ===========================================

const datosEjemplo: DatosRecibo = {
  empresa: {
    nombre: 'SICAMAR METALES S.A.',
    direccion: 'Uruguay 880 - 3° Piso, 1015 - Capital Federal',
    cuit: '30-65600876-4',
  },
  fechaPago: '04/12/2025',
  periodoPago: 'VACAC',
  legajo: '111',
  empleado: {
    apellidoNombres: 'MORAN, JOSE ANTONIO',
    dni: '14.354.389',
    fechaIngreso: '14/10/1996',
    sector: 'MTO P2',
    categoria: 'OFICIAL MULT. A2',
    basico: 8093.70,
    cuil: '20-14354389-8',
  },
  conceptos: [
    { codigo: '0150', concepto: 'VACACIONES', haberesConDesc: 1837593.60 },
    { codigo: '0155', concepto: 'COEFICIENTE VACACIONES', haberesConDesc: 232736.18 },
    { codigo: '0401', concepto: 'JUBILACIÓN', descuentos: 227736.28 },
    { codigo: '0402', concepto: 'LEY 19032', descuentos: 62109.89 },
    { codigo: '0405', concepto: 'OBRA SOCIAL', descuentos: 62109.89 },
    { codigo: '0421', concepto: 'CTA SIND.UOM 2,5%', descuentos: 51758.25 },
  ],
  totalHaberesConDesc: 2070329.78,
  totalHaberesSinDesc: 0,
  totalDescuentos: 403714.31,
  netoACobrar: 1666615.52,
  fechaDeposito: '04/12/2025',
  antiguedad: '29 años',
  banco: 'Banco Credicoop',
  cbu: '5200332',
  montoEnLetras: 'Un Millón Seiscientos Sesenta y Seis Mil Seiscientos Quince Con 52/100',
  domicilio: 'CALLE 22 850 2 16',
}

// ===========================================
// PALETAS DE COLORES
// ===========================================

const colorPalettes = {
  sicamar: {
    name: 'Sicamar (Rojo)',
    primary: '#C4322F',
    primaryLight: '#fee2e2',
    secondary: '#1e293b',
    accent: '#dc2626',
    headerBg: 'linear-gradient(135deg, #C4322F 0%, #991b1b 100%)',
    tableBorder: '#fca5a5',
  },
  corporate: {
    name: 'Corporativo (Azul)',
    primary: '#1e40af',
    primaryLight: '#dbeafe',
    secondary: '#1e293b',
    accent: '#2563eb',
    headerBg: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
    tableBorder: '#93c5fd',
  },
  modern: {
    name: 'Moderno (Verde)',
    primary: '#059669',
    primaryLight: '#d1fae5',
    secondary: '#1e293b',
    accent: '#10b981',
    headerBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    tableBorder: '#6ee7b7',
  },
  elegant: {
    name: 'Elegante (Púrpura)',
    primary: '#7c3aed',
    primaryLight: '#ede9fe',
    secondary: '#1e293b',
    accent: '#8b5cf6',
    headerBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    tableBorder: '#c4b5fd',
  },
  warm: {
    name: 'Cálido (Naranja)',
    primary: '#ea580c',
    primaryLight: '#ffedd5',
    secondary: '#1e293b',
    accent: '#f97316',
    headerBg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
    tableBorder: '#fdba74',
  },
}

type PaletteKey = keyof typeof colorPalettes

// ===========================================
// FORMATEADORES
// ===========================================

const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === 0) return ''
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export function ReciboTab() {
  const [selectedPalette, setSelectedPalette] = useState<PaletteKey>('sicamar')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSigning, setIsSigning] = useState(false)
  const [estadoRecibo, setEstadoRecibo] = useState<EstadoRecibo>('borrador')
  const [reciboId, setReciboId] = useState<string | null>(null)
  const [firmaEmpleadorFecha, setFirmaEmpleadorFecha] = useState<string | null>(null)
  const [showSigningModal, setShowSigningModal] = useState(false)
  
  // Estado para firma del empleado (OTP)
  const [showOtpModal, setShowOtpModal] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpValidating, setOtpValidating] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [firmaEmpleado, setFirmaEmpleado] = useState<{nombre: string, fecha: string, hash: string} | null>(null)
  const [showContexto, setShowContexto] = useState(false)
  
  const reciboRef = useRef<HTMLDivElement>(null)

  const contextoContenido = {
    descripcion: 'Módulo de diseño, firma digital y distribución de recibos de sueldo. Permite generar PDFs personalizables, firmarlos digitalmente (empleador con certificado .p12 y empleado via OTP por WhatsApp) y mantener registro legal de conformidad.',
    reglas: [
      'El recibo debe generarse antes de poder firmarse',
      'Primero firma el empleador con certificado digital .p12',
      'Luego el empleado confirma via código OTP por WhatsApp',
      'Una vez firmado por ambas partes, el recibo tiene validez legal',
      'El empleado puede rechazar el recibo con comentario',
      'Cada firma incluye timestamp y hash de verificación',
    ],
    flujo: [
      'Seleccionar empleado y período',
      'Generar PDF del recibo (paso 1)',
      'Firma digital del empleador con certificado (paso 2)',
      'Enviar código OTP al empleado por WhatsApp',
      'El empleado ingresa código para firmar (paso 3)',
      'Recibo completado con ambas firmas',
      'Archivo almacenado con validez legal',
    ],
    integraciones: [
      'Bejerman: Datos de conceptos y montos del recibo',
      'WhatsApp: Envío de código OTP para firma del empleado',
      'Storage: Almacenamiento seguro de PDFs firmados',
      'Certificados: Firma digital con archivo .p12',
    ],
    notas: [
      'El certificado .p12 debe estar configurado en el servidor',
      'El código OTP tiene validez de 5 minutos',
      'Se puede personalizar la paleta de colores del recibo',
      'Los recibos firmados se archivan automáticamente',
    ],
  }
  const palette = colorPalettes[selectedPalette]

  // Generar PDF y retornar base64
  const generarPdfBase64 = useCallback(async (): Promise<string | null> => {
    if (!reciboRef.current) return null
    
    try {
      const imgData = await toPng(reciboRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      
      const img = new Image()
      img.src = imgData
      await new Promise((resolve) => { img.onload = resolve })
      
      const imgWidth = img.width
      const imgHeight = img.height
      
      const pdfWidth = 210
      const pdfHeight = 297
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })
      
      const margin = 5
      const ratio = Math.min(
        (pdfWidth - margin * 2) / (imgWidth * 0.264583),
        (pdfHeight - margin * 2) / (imgHeight * 0.264583)
      )
      
      const scaledWidth = (imgWidth * 0.264583) * ratio
      const scaledHeight = (imgHeight * 0.264583) * ratio
      
      const x = (pdfWidth - scaledWidth) / 2
      const y = margin
      
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight)
      
      // Retornar como base64
      const pdfBlob = pdf.output('arraybuffer')
      const base64 = btoa(
        new Uint8Array(pdfBlob).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )
      return base64
    } catch (error) {
      console.error('Error al generar PDF:', error)
      return null
    }
  }, [])

  const handleDownloadPDF = useCallback(async () => {
    if (!reciboRef.current) return
    
    setIsGeneratingPDF(true)
    try {
      const imgData = await toPng(reciboRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      
      const img = new Image()
      img.src = imgData
      await new Promise((resolve) => { img.onload = resolve })
      
      const imgWidth = img.width
      const imgHeight = img.height
      
      const pdfWidth = 210
      const pdfHeight = 297
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })
      
      const margin = 5
      const ratio = Math.min(
        (pdfWidth - margin * 2) / (imgWidth * 0.264583),
        (pdfHeight - margin * 2) / (imgHeight * 0.264583)
      )
      
      const scaledWidth = (imgWidth * 0.264583) * ratio
      const scaledHeight = (imgHeight * 0.264583) * ratio
      
      const x = (pdfWidth - scaledWidth) / 2
      const y = margin
      
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight)
      
      const fileName = `recibo_${datosEjemplo.empleado.apellidoNombres.replace(/[, ]+/g, '_')}_${datosEjemplo.periodoPago}_${datosEjemplo.legajo}.pdf`
      
      pdf.save(fileName)
    } catch (error) {
      console.error('Error al generar PDF:', error)
      alert('Error al generar el PDF. Por favor, intenta de nuevo.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }, [])

  const handlePrint = () => {
    window.print()
  }

  // Crear recibo y subir PDF
  const handleCrearRecibo = useCallback(async () => {
    setIsSigning(true)
    try {
      const pdfBase64 = await generarPdfBase64()
      if (!pdfBase64) {
        alert('Error al generar el PDF')
        return
      }

      const response = await fetch('/api/sicamar/recibos/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: '00000000-0000-0000-0000-000000000000', // TODO: usar org real
          datos: datosEjemplo,
          pdfBase64,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setReciboId(result.reciboId)
        setEstadoRecibo('borrador')
        alert('✅ PDF generado y guardado. Listo para firmar.')
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      console.error('Error al generar recibo:', error)
      alert('Error al generar el recibo')
    } finally {
      setIsSigning(false)
    }
  }, [generarPdfBase64])

  // Firmar recibo con certificado digital
  const handleFirmarEmpleador = useCallback(async () => {
    if (!reciboId) {
      alert('Primero debes crear el recibo')
      return
    }

    setIsSigning(true)
    try {
      const response = await fetch('/api/sicamar/recibos/firmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reciboId }),
      })

      const result = await response.json()
      
      if (result.success) {
        setEstadoRecibo('firmado_empleador')
        setFirmaEmpleadorFecha(result.firma_fecha)
        setShowSigningModal(false)
        alert('✅ Recibo firmado digitalmente por el empleador')
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      console.error('Error al firmar recibo:', error)
      alert('Error al firmar el recibo')
    } finally {
      setIsSigning(false)
    }
  }, [reciboId])

  // Confirmar por empleado
  const handleConfirmarEmpleado = useCallback(async (aceptado: boolean) => {
    if (!reciboId) {
      alert('No hay recibo para confirmar')
      return
    }

    setIsSigning(true)
    try {
      const response = await fetch('/api/sicamar/recibos/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reciboId,
          aceptado,
          comentario: aceptado ? undefined : 'Rechazado por el empleado',
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setEstadoRecibo(aceptado ? 'firmado_completo' : 'rechazado')
        alert(aceptado ? '✅ Recibo confirmado por el empleado' : '❌ Recibo rechazado por el empleado')
      } else {
        alert('Error: ' + result.error)
      }
    } catch (error) {
      console.error('Error al confirmar recibo:', error)
      alert('Error al confirmar el recibo')
    } finally {
      setIsSigning(false)
    }
  }, [reciboId])

  // Enviar OTP para firma del empleado
  const handleEnviarOtp = useCallback(async () => {
    if (!reciboId) {
      setOtpError('No hay recibo para firmar')
      return
    }

    setOtpSending(true)
    setOtpError(null)
    
    try {
      const response = await fetch('/api/sicamar/recibos/enviar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reciboId,
          empleadoTelefono: datosEjemplo.empleado.telefono || '+5491112345678', // TODO: usar teléfono real
          empleadoNombre: datosEjemplo.empleado.apellidoNombres,
          empleadoLegajo: datosEjemplo.legajo,
          empleadoDni: datosEjemplo.empleado.dni,
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setOtpSent(true)
        setOtpError(null)
      } else {
        setOtpError(result.error || 'Error al enviar código')
      }
    } catch (error) {
      console.error('Error enviando OTP:', error)
      setOtpError('Error de conexión')
    } finally {
      setOtpSending(false)
    }
  }, [reciboId, datosEjemplo])

  // Validar OTP y firmar
  const handleValidarOtp = useCallback(async () => {
    if (!reciboId || !otpCode) {
      setOtpError('Ingresá el código de verificación')
      return
    }

    if (otpCode.length !== 6) {
      setOtpError('El código debe tener 6 dígitos')
      return
    }

    setOtpValidating(true)
    setOtpError(null)
    
    try {
      const response = await fetch('/api/sicamar/recibos/validar-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reciboId, otpCode }),
      })

      const result = await response.json()
      
      if (result.success) {
        setEstadoRecibo('firmado_completo')
        setFirmaEmpleado(result.firmaEmpleado)
        setShowOtpModal(false)
        setOtpCode('')
        setOtpSent(false)
        alert('✅ Recibo firmado exitosamente por el empleado')
      } else {
        setOtpError(result.error || 'Código inválido')
      }
    } catch (error) {
      console.error('Error validando OTP:', error)
      setOtpError('Error de conexión')
    } finally {
      setOtpValidating(false)
    }
  }, [reciboId, otpCode])

  // Badge de estado
  const getEstadoBadge = () => {
    switch (estadoRecibo) {
      case 'borrador':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <FileText className="w-3.5 h-3.5" />
            Borrador
          </span>
        )
      case 'firmado_empleador':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            Firmado por Empleador
          </span>
        )
      case 'firmado_completo':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Firma Completa
          </span>
        )
      case 'rechazado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="w-3.5 h-3.5" />
            Rechazado
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Contexto Modal */}
      <ContextoModal
        isOpen={showContexto}
        onClose={() => setShowContexto(false)}
        titulo="Recibos de Sueldo"
        contenido={contextoContenido}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#C4322F]" />
              Diseño de Recibo de Sueldo
            </h2>
            <p className="text-sm text-gray-500">
              Previsualiza, firma digitalmente y personaliza el recibo
            </p>
          </div>
          <ContextoButton onClick={() => setShowContexto(true)} />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {getEstadoBadge()}
          
          {/* Selector de paleta */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              <span
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: palette.primary }}
              />
              {palette.name}
              {showColorPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showColorPicker && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-3 z-50 w-64">
                <p className="text-xs font-medium text-gray-500 mb-2">Paleta de colores</p>
                <div className="space-y-1">
                  {Object.entries(colorPalettes).map(([key, pal]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedPalette(key as PaletteKey)
                        setShowColorPicker(false)
                      }}
                      className={`w-full px-3 py-2 text-left rounded-lg flex items-center gap-3 transition-colors ${
                        selectedPalette === key
                          ? 'bg-gray-100 text-gray-900'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: pal.primary }}
                      />
                      <span className="text-sm font-medium">{pal.name}</span>
                      {selectedPalette === key && <Check className="w-4 h-4 ml-auto text-green-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="px-4 py-2 text-sm bg-[#C4322F] text-white rounded-lg hover:bg-[#a82926] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Panel de Firma Digital */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          Firma Digital del Recibo
        </h3>
        
        <div className="grid md:grid-cols-4 gap-4">
          {/* Paso 1: Crear Recibo */}
          <div className={`p-4 rounded-lg border-2 ${reciboId ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${reciboId ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                1
              </div>
              <span className="text-sm font-medium text-gray-900">Generar PDF</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Genera el PDF automáticamente</p>
            <button
              onClick={handleCrearRecibo}
              disabled={isSigning || !!reciboId}
              className={`w-full px-3 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${
                reciboId 
                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {reciboId ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Generado
                </>
              ) : isSigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generar
                </>
              )}
            </button>
          </div>

          {/* Paso 2: Firma Empleador */}
          <div className={`p-4 rounded-lg border-2 ${estadoRecibo === 'firmado_empleador' || estadoRecibo === 'firmado_completo' ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${estadoRecibo === 'firmado_empleador' || estadoRecibo === 'firmado_completo' ? 'bg-green-500 text-white' : reciboId ? 'bg-blue-500 text-white' : 'bg-gray-300 text-white'}`}>
                2
              </div>
              <span className="text-sm font-medium text-gray-900">Firma Empleador</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Firma con certificado .p12</p>
            <button
              onClick={handleFirmarEmpleador}
              disabled={!reciboId || estadoRecibo !== 'borrador' || isSigning}
              className={`w-full px-3 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${
                estadoRecibo === 'firmado_empleador' || estadoRecibo === 'firmado_completo'
                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {estadoRecibo === 'firmado_empleador' || estadoRecibo === 'firmado_completo' ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Firmado
                </>
              ) : isSigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Firmando...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Firmar
                </>
              )}
            </button>
            {firmaEmpleadorFecha && (
              <p className="text-xs text-green-600 mt-2 text-center">
                {new Date(firmaEmpleadorFecha).toLocaleString('es-AR')}
              </p>
            )}
          </div>

          {/* Paso 3: Firma Empleado con OTP */}
          <div className={`p-4 rounded-lg border-2 ${estadoRecibo === 'firmado_completo' ? 'bg-green-50 border-green-300' : estadoRecibo === 'rechazado' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                estadoRecibo === 'firmado_completo' ? 'bg-green-500 text-white' 
                : estadoRecibo === 'rechazado' ? 'bg-red-500 text-white'
                : estadoRecibo === 'firmado_empleador' ? 'bg-blue-500 text-white' 
                : 'bg-gray-300 text-white'
              }`}>
                3
              </div>
              <span className="text-sm font-medium text-gray-900">Firma Empleado</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Verificación por OTP (WhatsApp)</p>
            <button
              onClick={() => setShowOtpModal(true)}
              disabled={estadoRecibo !== 'firmado_empleador' || isSigning}
              className={`w-full px-3 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${
                estadoRecibo === 'firmado_completo'
                  ? 'bg-green-100 text-green-700 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {estadoRecibo === 'firmado_completo' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Firmado
                </>
              ) : (
                <>
                  <FileSignature className="w-4 h-4" />
                  Firmar
                </>
              )}
            </button>
            {firmaEmpleado && (
              <p className="text-xs text-green-600 mt-2 text-center truncate">
                {firmaEmpleado.nombre}
              </p>
            )}
          </div>

          {/* Paso 4: Estado Final */}
          <div className={`p-4 rounded-lg border-2 ${estadoRecibo === 'firmado_completo' ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-400' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${estadoRecibo === 'firmado_completo' ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
                ✓
              </div>
              <span className="text-sm font-medium text-gray-900">Completado</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Recibo válido legalmente</p>
            {estadoRecibo === 'firmado_completo' ? (
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1" />
                <p className="text-xs font-medium text-green-700">¡Proceso completo!</p>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-gray-400">Pendiente...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview del Recibo - A4 Portrait */}
      <div className="bg-gray-100 rounded-2xl p-4 md:p-6 flex justify-center">
        <div
          ref={reciboRef}
          data-recibo-container
          style={{ 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            width: '610px',
            aspectRatio: '210 / 297', // A4 Portrait
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            color: '#111827',
          }}
        >
          <ReciboCard 
            datos={datosEjemplo} 
            palette={palette} 
            estadoRecibo={estadoRecibo}
            firmaEmpleadorFecha={firmaEmpleadorFecha}
            firmaEmpleado={firmaEmpleado}
          />
        </div>
      </div>

      {/* Modal de Firma OTP del Empleado */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FileSignature className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Firma Electrónica</h3>
                  <p className="text-sm text-white/80">Verificación por código OTP</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {!otpSent ? (
                /* Paso 1: Enviar OTP */
                <div className="text-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Enviar código de verificación</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Se enviará un código de 6 dígitos al WhatsApp del empleado para confirmar la firma del recibo.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
                    <p className="text-xs text-gray-500 mb-1">Empleado:</p>
                    <p className="font-medium text-gray-900">{datosEjemplo.empleado.apellidoNombres}</p>
                    <p className="text-sm text-gray-600">Legajo: {datosEjemplo.legajo}</p>
                  </div>
                  {otpError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{otpError}</p>
                    </div>
                  )}
                  <button
                    onClick={handleEnviarOtp}
                    disabled={otpSending}
                    className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {otpSending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Enviar código por WhatsApp
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Paso 2: Ingresar OTP */
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Ingresá el código</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Escribí el código de 6 dígitos que recibiste por WhatsApp.
                  </p>
                  
                  {/* Input de código OTP */}
                  <div className="mb-4">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setOtpCode(value)
                        setOtpError(null)
                      }}
                      placeholder="000000"
                      className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  {otpError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{otpError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleValidarOtp}
                    disabled={otpValidating || otpCode.length !== 6}
                    className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
                  >
                    {otpValidating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Firmar Recibo
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setOtpSent(false)
                      setOtpCode('')
                      setOtpError(null)
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    ← Volver a enviar código
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={() => {
                  setShowOtpModal(false)
                  setOtpSent(false)
                  setOtpCode('')
                  setOtpError(null)
                }}
                className="w-full py-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===========================================
// COMPONENTE DEL RECIBO
// ===========================================

interface FirmaEmpleado {
  nombre: string
  fecha: string
  hash: string
}

interface ReciboCardProps {
  datos: DatosRecibo
  palette: typeof colorPalettes.sicamar
  estadoRecibo?: EstadoRecibo
  firmaEmpleadorFecha?: string | null
  firmaEmpleado?: FirmaEmpleado | null
}

// Colores hex para PDF (html2canvas no soporta oklch)
const pdfColors = {
  white: '#ffffff',
  gray900: '#111827',
  gray700: '#374151',
  gray600: '#4b5563',
  gray500: '#6b7280',
  red600: '#dc2626',
  green600: '#059669',
  whiteAlpha80: 'rgba(255, 255, 255, 0.8)',
  whiteAlpha70: 'rgba(255, 255, 255, 0.7)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.2)',
}

function ReciboCard({ datos, palette, estadoRecibo, firmaEmpleadorFecha, firmaEmpleado }: ReciboCardProps) {
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      {/* HEADER - Logo y Datos Empresa + Período */}
      <div
        style={{
          background: palette.headerBg,
          borderRadius: '8px',
          padding: '12px',
          color: pdfColors.white,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pattern decorativo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          {/* Datos empresa */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: pdfColors.whiteAlpha20, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 style={{ width: '24px', height: '24px', color: pdfColors.white }} />
            </div>
            <div>
              <h1 style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '-0.025em', margin: 0, color: pdfColors.white }}>{datos.empresa.nombre}</h1>
              <p style={{ fontSize: '12px', color: pdfColors.whiteAlpha80, marginTop: '2px', margin: 0 }}>{datos.empresa.direccion}</p>
              <p style={{ fontSize: '12px', color: pdfColors.whiteAlpha80, margin: 0 }}>C.U.I.T. N°: {datos.empresa.cuit}</p>
            </div>
          </div>

          {/* Datos del período */}
          <div style={{ textAlign: 'right', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '6px' }}>
              <Calendar style={{ width: '12px', height: '12px', color: pdfColors.whiteAlpha70, marginTop: '2px', flexShrink: 0 }} />
              <div>
                <span style={{ color: pdfColors.whiteAlpha70, display: 'block', fontSize: '10px' }}>FECHA DE PAGO</span>
                <span style={{ fontWeight: 600, fontSize: '12px', color: pdfColors.white }}>{datos.fechaPago}</span>
              </div>
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: pdfColors.whiteAlpha70, display: 'block', fontSize: '10px' }}>PERÍODO</span>
              <span style={{ fontWeight: 'bold', fontSize: '14px', color: pdfColors.white }}>{datos.periodoPago}</span>
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: pdfColors.whiteAlpha70, display: 'block', fontSize: '10px' }}>LEGAJO</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '16px', color: pdfColors.white }}>{datos.legajo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* DATOS DEL EMPLEADO */}
      <div
        style={{ borderRadius: '8px', border: `1px solid ${palette.tableBorder}`, padding: '10px', backgroundColor: palette.primaryLight + '40' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <User style={{ width: '10px', height: '10px', color: pdfColors.gray500 }} />
              APELLIDO Y NOMBRES
            </label>
            <p style={{ fontWeight: 'bold', color: pdfColors.gray900, fontSize: '12px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.apellidoNombres}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, marginBottom: '2px', display: 'block' }}>DOC. DE IDENTIDAD</label>
            <p style={{ fontFamily: 'monospace', fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.dni}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, marginBottom: '2px', display: 'block' }}>F. DE INGRESO</label>
            <p style={{ fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.fechaIngreso}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr', gap: '8px', paddingTop: '8px', borderTop: `1px solid ${palette.tableBorder}` }}>
          <div>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              <Briefcase style={{ width: '10px', height: '10px', color: pdfColors.gray500 }} />
              CATEGORÍA
            </label>
            <p style={{ fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.categoria}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, marginBottom: '2px', display: 'block' }}>BÁSICO</label>
            <p style={{ fontFamily: 'monospace', fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>
              $ {formatCurrency(datos.empleado.basico)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, marginBottom: '2px', display: 'block' }}>C.U.I.L.</label>
            <p style={{ fontFamily: 'monospace', fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.cuil}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <label style={{ fontSize: '9px', fontWeight: 500, color: pdfColors.gray500, marginBottom: '2px', display: 'block' }}>SECTOR</label>
            <p style={{ fontWeight: 600, color: pdfColors.gray900, fontSize: '11px', lineHeight: 1.2, margin: 0 }}>{datos.empleado.sector}</p>
          </div>
        </div>
      </div>

      {/* TABLA DE CONCEPTOS */}
      <div style={{ borderRadius: '8px', border: `1px solid ${palette.tableBorder}`, overflow: 'hidden', flex: 1 }}>
        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: palette.primary }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px', width: '48px' }}>CÓD.</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px' }}>CONCEPTO</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px', width: '40px' }}>UNID.</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px', width: '80px' }}>HAB. C/D.</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px', width: '80px' }}>HAB. S/D.</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: pdfColors.white, fontWeight: 600, fontSize: '10px', width: '80px' }}>DESC.</th>
            </tr>
          </thead>
          <tbody>
            {datos.conceptos.map((concepto, idx) => (
              <tr
                key={concepto.codigo}
                style={{ backgroundColor: idx % 2 === 1 ? palette.primaryLight + '30' : pdfColors.white }}
              >
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: pdfColors.gray600, fontSize: '11px' }}>{concepto.codigo}</td>
                <td style={{ padding: '4px 8px', fontWeight: 500, color: pdfColors.gray900, fontSize: '11px' }}>{concepto.concepto}</td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: pdfColors.gray600, fontSize: '11px' }}>
                  {concepto.unidades || ''}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: pdfColors.gray900, fontSize: '11px' }}>
                  {formatCurrency(concepto.haberesConDesc)}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: pdfColors.gray900, fontSize: '11px' }}>
                  {formatCurrency(concepto.haberesSinDesc)}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: pdfColors.red600, fontSize: '11px' }}>
                  {formatCurrency(concepto.descuentos)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: palette.primaryLight }}>
              <td colSpan={2} style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: pdfColors.gray900, fontSize: '11px' }}>TOTALES:</td>
              <td style={{ padding: '6px 8px' }}></td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: pdfColors.gray900, fontSize: '11px' }}>
                {formatCurrency(datos.totalHaberesConDesc)}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: pdfColors.gray900, fontSize: '11px' }}>
                {formatCurrency(datos.totalHaberesSinDesc) || '-'}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: pdfColors.red600, fontSize: '11px' }}>
                {formatCurrency(datos.totalDescuentos)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* DEPÓSITO Y NETO */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        <div style={{ borderRadius: '8px', border: `1px solid ${palette.tableBorder}`, padding: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <DollarSign style={{ width: '12px', height: '12px', color: palette.primary }} />
            <span style={{ fontSize: '10px', fontWeight: 600, color: pdfColors.gray500 }}>DEPÓSITO</span>
          </div>
          <p style={{ fontSize: '12px', color: pdfColors.gray700, margin: 0 }}>Fecha: {datos.fechaDeposito}</p>
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${palette.tableBorder}` }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: pdfColors.gray500, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar style={{ width: '10px', height: '10px', color: pdfColors.gray500 }} />
              ANTIGÜEDAD
            </span>
            <p style={{ fontWeight: 'bold', fontSize: '14px', color: palette.primary, margin: 0 }}>
              {datos.antiguedad}
            </p>
          </div>
        </div>

        <div
          style={{
            borderRadius: '8px',
            padding: '8px',
            color: pdfColors.white,
            position: 'relative',
            overflow: 'hidden',
            background: palette.headerBg,
          }}
        >
          <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
            <DollarSign style={{ width: '64px', height: '64px', position: 'absolute', right: '-8px', bottom: '-8px', color: pdfColors.white }} />
          </div>
          <div style={{ position: 'relative', zIndex: 10 }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: pdfColors.whiteAlpha80 }}>NETO A COBRAR</span>
            <p style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '18px', marginTop: '2px', color: pdfColors.white, margin: 0 }}>
              $ {formatCurrency(datos.netoACobrar)}
            </p>
          </div>
        </div>
      </div>

      {/* INFORMACIÓN BANCARIA */}
      <div
        style={{ borderRadius: '8px', border: `1px solid ${palette.tableBorder}`, padding: '8px', fontSize: '12px', backgroundColor: palette.primaryLight + '30' }}
      >
        <p style={{ color: pdfColors.gray700, lineHeight: 1.5, fontSize: '11px', margin: 0 }}>
          Los haberes se depositarán en la cuenta Nro. <strong>{datos.cbu}</strong> del{' '}
          <strong>{datos.banco}</strong>
        </p>
        <p style={{ color: pdfColors.gray700, marginTop: '2px', fontSize: '10px', margin: '2px 0 0 0' }}>{datos.montoEnLetras}</p>
        <p style={{ color: pdfColors.gray600, marginTop: '2px', fontSize: '10px', margin: '2px 0 0 0' }}>{datos.domicilio}</p>
      </div>

      {/* FIRMAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', paddingTop: '12px', marginTop: 'auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{ height: '70px', borderBottom: `2px solid ${palette.primary}`, marginBottom: '6px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '4px' }}
          >
            {/* Firma elegante del empleado */}
            {firmaEmpleado ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                {/* Nombre en tipografía firma */}
                <p style={{ 
                  fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#1e3a5f',
                  margin: 0,
                  lineHeight: 1.1,
                  letterSpacing: '0.5px',
                }}>
                  {firmaEmpleado.nombre}
                </p>
                {/* Timestamp */}
                <p style={{ 
                  fontFamily: 'monospace',
                  fontSize: '9px',
                  color: pdfColors.gray600,
                  margin: '2px 0 0 0',
                }}>
                  {firmaEmpleado.fecha}
                </p>
                {/* FIRMADO CONFORME */}
                <p style={{ 
                  fontSize: '8px',
                  fontWeight: 700,
                  color: pdfColors.gray700,
                  margin: '1px 0 0 0',
                  letterSpacing: '1px',
                }}>
                  FIRMADO CONFORME
                </p>
              </div>
            ) : (
              /* Sello de firma digital si está firmado pero sin datos de firma */
              (estadoRecibo === 'firmado_completo') && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '4px', 
                  left: '50%', 
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#059669',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontWeight: 600,
                }}>
                  <CheckCircle2 style={{ width: '10px', height: '10px' }} />
                  CONFORMADO DIGITALMENTE
                </div>
              )
            )}
          </div>
          <p style={{ fontSize: '10px', fontWeight: 500, color: pdfColors.gray600, textAlign: 'center', margin: 0 }}>
            FIRMA EMPLEADO
          </p>
          {/* Hash de verificación */}
          {firmaEmpleado && (
            <p style={{ 
              fontFamily: 'monospace',
              fontSize: '7px',
              color: pdfColors.gray500,
              margin: '2px 0 0 0',
              letterSpacing: '0.5px',
            }}>
              {firmaEmpleado.hash}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'center', position: 'relative' }}>
          {/* Imagen de firma del empleador - SUPERPUESTA flotando sobre todo */}
          <img 
            src={FIRMA_EMPLEADOR_BASE64} 
            alt="Firma Empleador" 
            style={{ 
              position: 'absolute',
              bottom: '15px',
              left: '50%',
              transform: 'translateX(-50%)',
              height: '120px',
              width: 'auto', 
              objectFit: 'contain',
              mixBlendMode: 'multiply',
              pointerEvents: 'none',
              zIndex: 5,
            }} 
          />
          <div
            style={{ height: '70px', borderBottom: `2px solid ${palette.primary}`, marginBottom: '6px', position: 'relative' }}
          >
          </div>
          <p style={{ fontSize: '10px', fontWeight: 500, color: pdfColors.gray600, textAlign: 'center', margin: 0 }}>
            FIRMA EMPLEADOR
          </p>
          {firmaEmpleadorFecha && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '2px' }}>
              <p style={{ fontSize: '8px', color: pdfColors.gray500, margin: 0 }}>
                {new Date(firmaEmpleadorFecha).toLocaleString('es-AR')}
              </p>
              {(estadoRecibo === 'firmado_empleador' || estadoRecibo === 'firmado_completo') && (
                <span style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  backgroundColor: '#1e40af',
                  color: 'white',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  fontSize: '7px',
                  fontWeight: 600,
                }}>
                  <ShieldCheck style={{ width: '7px', height: '7px' }} />
                  DIGITAL
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
