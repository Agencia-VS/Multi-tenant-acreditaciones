export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Bienvenido a la Plataforma de Acreditaciones</h1>

      <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', alignItems: 'center' }}>
        <a
          href="/admin"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontWeight: '500'
          }}
        >
          🛠️ Administración de Tenants
        </a>

        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '1rem' }}>
          Para acceder a un tenant específico, usa: <code style={{ backgroundColor: '#f3f4f6', padding: '0.125rem 0.25rem', borderRadius: '0.25rem' }}>/[tenant-slug]</code>
        </p>
      </div>
    </main>
  );
}

