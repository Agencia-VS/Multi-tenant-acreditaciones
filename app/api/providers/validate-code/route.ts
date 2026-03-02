/**
 * API: Validate Provider Invite Code
 * GET — Validar código de invitación (público, no requiere auth)
 *
 * Uso: GET /api/providers/validate-code?slug=cruzados&code=X7k9mZ
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInviteCode } from '@/lib/services';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const code = searchParams.get('code');

    if (!slug || !code) {
      return NextResponse.json(
        { error: 'slug y code son requeridos' },
        { status: 400 }
      );
    }

    const result = await validateInviteCode(slug, code);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, error: 'Código de invitación inválido o expirado' },
        { status: 404 }
      );
    }

    // No exponer tenantId en respuesta pública
    return NextResponse.json({
      valid: true,
      tenant_nombre: result.tenantNombre,
      tenant_logo: result.tenantLogo,
      tenant_description: result.tenantDescription,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
