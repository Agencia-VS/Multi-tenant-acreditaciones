export interface TenantConfig {
  nombre: string;
  slug: string;
  colors: {
    primary: string;
    secondary: string;
    light: string;
    dark: string;
  };
  images: {
    background: string;
    logo: string;
    shield1: string;
    shield2: string;
    arenaLogo: string;
  };
  social: {
    facebook: string;
    twitter: string;
    instagram: string;
    youtube: string;
  };
}

export const tenantConfigs: Record<string, TenantConfig> = {
  cruzados: {
    nombre: 'Universidad Católica',
    slug: 'cruzados',
    colors: {
      primary: '#1e5799',
      secondary: '#207cca',
      light: '#7db9e8',
      dark: '#2989d8'
    },
    images: {
      background: '/UCimg/Claro.jpg',
      logo: '/UCimg/LogoUC.png',
      shield1: '/UCimg/EscudoUC.png',
      shield2: '/UCimg/EscudoConce.png',
      arenaLogo: '/UCimg/ClaroArenaL.png'
    },
    social: {
      facebook: 'https://www.facebook.com/cruzados.cl/?locale=es_LA',
      twitter: 'https://x.com/Cruzados',
      instagram: 'https://www.instagram.com/cruzados_oficial/?hl=es-la',
      youtube: 'https://www.youtube.com/user/OficialCruzados'
    }
  },
  colocolo: {
    nombre: 'Colo-Colo',
    slug: 'colocolo',
    colors: {
      primary: '#ffffff',
      secondary: '#000000',
      light: '#cccccc',
      dark: '#333333'
    },
    images: {
      background: '/colocolo/background.jpg', // Placeholder, necesitas subir imágenes
      logo: '/colocolo/logo.png',
      shield1: '/colocolo/shield.png',
      shield2: '/colocolo/opponent.png',
      arenaLogo: '/colocolo/arena.png'
    },
    social: {
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: ''
    }
  },
  audax: {
    nombre: 'Audax Italiano',
    slug: 'audax',
    colors: {
      primary: '#0066cc',
      secondary: '#ffffff',
      light: '#99ccff',
      dark: '#004499'
    },
    images: {
      background: '/audax/background.jpg',
      logo: '/audax/logo.png',
      shield1: '/audax/shield.png',
      shield2: '/audax/opponent.png',
      arenaLogo: '/audax/arena.png'
    },
    social: {
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: ''
    }
  },
  uchile: {
    nombre: 'Universidad de Chile',
    slug: 'uchile',
    colors: {
      primary: '#0033a0',
      secondary: '#ffffff',
      light: '#6699ff',
      dark: '#001a66'
    },
    images: {
      background: '/uchile/background.jpg',
      logo: '/uchile/logo.png',
      shield1: '/uchile/shield.png',
      shield2: '/uchile/opponent.png',
      arenaLogo: '/uchile/arena.png'
    },
    social: {
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: ''
    }
  },
  union: {
    nombre: 'Unión Española',
    slug: 'union',
    colors: {
      primary: '#ff0000',
      secondary: '#ffffff',
      light: '#ff6666',
      dark: '#990000'
    },
    images: {
      background: '/union/background.jpg',
      logo: '/union/logo.png',
      shield1: '/union/shield.png',
      shield2: '/union/opponent.png',
      arenaLogo: '/union/arena.png'
    },
    social: {
      facebook: '',
      twitter: '',
      instagram: '',
      youtube: ''
    }
  }
};