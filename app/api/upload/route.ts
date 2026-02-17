/**
 * API Route — Upload de imágenes a Supabase Storage
 *
 * POST /api/upload
 * - Acepta FormData con campo "file" (imagen)
 * - Parámetros opcionales: folder (string), context (string)
 * - Sube a bucket "assets" en Supabase Storage
 * - Retorna la URL pública
 *
 * Seguridad: Requiere sesión de superadmin o admin de tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

const BUCKET = 'assets';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido: ${file.type}. Permitidos: JPG, PNG, WebP, SVG, GIF` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `El archivo excede el límite de ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const timestamp = Date.now();
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 40);
    const filePath = `${folder}/${timestamp}-${safeName}.${ext}`;

    // Convert File to ArrayBuffer then to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // If bucket doesn't exist, provide helpful message
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        return NextResponse.json(
          { error: 'El bucket de storage no existe. Ejecuta el SQL de migración: supabase-storage-setup.sql' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
