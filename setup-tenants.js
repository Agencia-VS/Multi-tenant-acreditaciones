const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupTenants() {
  try {
    console.log('Setting up tenants...');

    // Insertar tenants de ejemplo
    const tenants = [
      { nombre: 'Universidad Católica', slug: 'cruzados' },
      { nombre: 'Colo-Colo', slug: 'colocolo' },
      { nombre: 'Audax Italiano', slug: 'audax' },
      { nombre: 'Universidad de Chile', slug: 'uchile' },
      { nombre: 'Unión Española', slug: 'union' }
    ];

    for (const tenant of tenants) {
      const { error } = await supabase
        .from('tenants')
        .upsert(tenant, { onConflict: 'slug' });

      if (error) {
        console.error(`Error inserting ${tenant.name}:`, error.message);
      } else {
        console.log(`✓ ${tenant.name} (${tenant.slug})`);
      }
    }

    // Actualizar tenants existentes con nombre si falta
    const updates = [
      { slug: 'cruzados', nombre: 'Universidad Católica' },
      { slug: 'colocolo', nombre: 'Colo-Colo' },
      { slug: 'audax', nombre: 'Audax Italiano' },
      { slug: 'uchile', nombre: 'Universidad de Chile' },
      { slug: 'union', nombre: 'Unión Española' }
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('tenants')
        .update({ nombre: update.nombre })
        .eq('slug', update.slug);

      if (error) {
        console.error(`Error updating ${update.slug}:`, error.message);
      }
    }

    // Verificar tenants existentes
    const { data, error } = await supabase
      .from('tenants')
      .select('nombre, slug')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenants:', error);
    } else {
      console.log('\nTenants in database:');
      data.forEach(tenant => {
        console.log(`- ${tenant.nombre || 'undefined'} (${tenant.slug})`);
      });
    }

    console.log('\nSetup completed!');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupTenants();