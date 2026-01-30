import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST() {
  try {
    // Crear tabla si no existe
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS mt_tenants (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createError) {
      console.log('Table creation error:', createError);
    }

    // Insertar tenants de ejemplo
    const tenants = [
      { name: 'Universidad Católica', slug: 'cruzados' },
      { name: 'Colo-Colo', slug: 'colocolo' },
      { name: 'Audax Italiano', slug: 'audax' },
      { name: 'Universidad de Chile', slug: 'uchile' },
      { name: 'Unión Española', slug: 'union' }
    ];

    const results = [];
    for (const tenant of tenants) {
      const { data, error } = await supabase
        .from('mt_tenants')
        .upsert(tenant, { onConflict: 'slug' })
        .select();

      if (error) {
        results.push({ tenant, error: error.message });
      } else {
        results.push({ tenant, success: true, data });
      }
    }

    return NextResponse.json({
      message: 'Setup completed',
      results
    });

  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: error.message },
      { status: 500 }
    );
  }
}