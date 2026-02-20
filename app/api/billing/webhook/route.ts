/**
 * API: Stripe Webhook Handler
 * POST — Procesa eventos de Stripe (invoice.paid, subscription.updated, etc.)
 * 
 * Idempotente: usa stripe_event_id UNIQUE para evitar duplicados.
 * Runtime: Node.js (necesita crypto para verificar firma).
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { processStripeWebhook } from '@/lib/services/billing';

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe no configurado' },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
  });

  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { error: 'Falta firma de Stripe' },
        { status: 400 }
      );
    }

    // Verificar firma del webhook (previene spoofing)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Firma inválida';
      console.error(`[Billing Webhook] Firma inválida: ${message}`);
      return NextResponse.json({ error: `Firma inválida: ${message}` }, { status: 400 });
    }

    // Procesar el evento
    await processStripeWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Billing Webhook] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error procesando webhook' },
      { status: 500 }
    );
  }
}
