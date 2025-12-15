import { NextRequest, NextResponse } from 'next/server'
import { supabaseSicamar, supabaseServer } from '@/lib/supabase-server'
import sharp from 'sharp'

const BUCKET = 'employee-photos'
const FOLDER = 'sicamar/'
const THUMB_SIZE = 64

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const empleadoId = parseInt(id)

    // Obtener datos del empleado
    const { data: empleado, error: empError } = await supabaseSicamar
      .from('empleados')
      .select('legajo, nombre, apellido')
      .eq('id', empleadoId)
      .single()

    if (empError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }

    // Leer el archivo del form data
    const formData = await request.formData()
    const file = formData.get('foto') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
    }

    // Leer el archivo como buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Procesar imagen con sharp
    const processedImage = await sharp(buffer)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 85 })
      .toBuffer()

    // Crear thumbnail
    const thumbnail = await sharp(buffer)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80 })
      .toBuffer()

    // Generar nombre de archivo basado en legajo con padding
    const legajoPadded = empleado.legajo.toString().padStart(6, '0')
    const fileName = `${legajoPadded}.jpg`
    const thumbFileName = `thumb_${legajoPadded}.jpg`
    const filePath = `${FOLDER}${fileName}`
    const thumbPath = `${FOLDER}${thumbFileName}`

    // Subir imagen principal
    const { error: uploadError } = await supabaseServer.storage
      .from(BUCKET)
      .upload(filePath, processedImage, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading image:', uploadError)
      return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
    }

    // Subir thumbnail
    const { error: thumbError } = await supabaseServer.storage
      .from(BUCKET)
      .upload(thumbPath, thumbnail, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (thumbError) {
      console.error('Error uploading thumbnail:', thumbError)
      // Continuar aunque falle el thumb
    }

    // Obtener URL pública
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const fotoUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${filePath}`
    const thumbUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${thumbPath}`

    // Actualizar empleado con URLs
    const { error: updateError } = await supabaseSicamar
      .from('empleados')
      .update({
        foto_url: fotoUrl,
        foto_thumb_url: thumbUrl,
        foto_sync_at: new Date().toISOString()
      })
      .eq('id', empleadoId)

    if (updateError) {
      console.error('Error updating empleado:', updateError)
      return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      foto_url: fotoUrl,
      foto_thumb_url: thumbUrl,
      message: `Foto actualizada para ${empleado.apellido}, ${empleado.nombre}`
    })

  } catch (error) {
    console.error('Error in foto upload:', error)
    return NextResponse.json(
      { error: 'Error al procesar la imagen' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar foto de empleado
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const empleadoId = parseInt(id)

    // Obtener datos del empleado
    const { data: empleado, error: empError } = await supabaseSicamar
      .from('empleados')
      .select('legajo, foto_url')
      .eq('id', empleadoId)
      .single()

    if (empError || !empleado) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }

    if (!empleado.foto_url) {
      return NextResponse.json({ error: 'Empleado no tiene foto' }, { status: 400 })
    }

    // Eliminar archivos de storage
    const legajoPadded = empleado.legajo.toString().padStart(6, '0')
    const filesToDelete = [
      `${FOLDER}${legajoPadded}.jpg`,
      `${FOLDER}thumb_${legajoPadded}.jpg`
    ]

    await supabaseServer.storage.from(BUCKET).remove(filesToDelete)

    // Actualizar empleado
    const { error: updateError } = await supabaseSicamar
      .from('empleados')
      .update({
        foto_url: null,
        foto_thumb_url: null,
        foto_sync_at: null
      })
      .eq('id', empleadoId)

    if (updateError) {
      return NextResponse.json({ error: 'Error al actualizar empleado' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Foto eliminada' })

  } catch (error) {
    console.error('Error deleting foto:', error)
    return NextResponse.json({ error: 'Error al eliminar foto' }, { status: 500 })
  }
}





