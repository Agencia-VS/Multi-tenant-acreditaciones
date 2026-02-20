/**
 * API: Stripe Checkout Callback
 * Redirige al dashboard del admin después del checkout
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Redirigir al dashboard con parámetro de billing result
  if (status === 'success') {
    return NextResponse.redirect(`${appUrl}/acreditado?billing=success`);
  }

  return NextResponse.redirect(`${appUrl}/acreditado?billing=cancel`);
}
