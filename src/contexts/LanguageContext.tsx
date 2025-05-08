
'use client';

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Language = 'en' | 'es' | 'pt'; // Add more languages as needed

interface Translations {
  [key: string]: string | Translations;
}

// Basic translations - in a real app, these would come from JSON files
const translationsData: Record<Language, Translations> = {
  en: {
    dashboard: 'Dashboard',
    cameras: 'Cameras',
    groups: 'Groups',
    monitor: 'Monitor',
    videos: 'Videos',
    settings: 'Settings',
    account: 'My Account',
    organizationUsers: 'Organization Users',
    systemAdministration: 'System Administration',
    organizations: 'Organizations', // Changed from Manage Organizations
    servers: 'Servers', // Changed from Manage Servers
    manageCameraIPs: 'Manage Camera IPs',
    manageOrganizationUsers: 'Manage Organization Users',
    octaVision: 'OctaVision',
    signOut: 'Sign Out',
    signOutSuccessMessage: 'You have been successfully signed out.',
    signOutFailedTitle: 'Sign Out Failed',
    signOutFailedMessage: 'An error occurred while signing out. Please try again.',
    orgApprovalPending: {
        title: 'Organization Approval Pending',
        description: 'Your organization\'s account is currently awaiting approval. You can add cameras and set up configurations. However, camera processing will only begin after your organization\'s account is approved by an administrator and based on server space availability.',
    },
    languages: {
        en: 'English',
        es: 'Spanish',
        pt: 'Portuguese',
    },
    settingsPage: {
        notifications: {
            title: 'Notification Settings',
            email: 'Email Notifications',
            push: 'Push Notifications',
            sound: 'Alert Sound',
        },
        theme: {
            title: 'Theme Settings',
            darkMode: 'Dark Mode',
            language: 'Language',
            selectLanguage: 'Select Language',
        },
        data: {
            title: 'Data Management',
            export: 'Export My Data',
            deleteAccount: 'Delete My Account',
        },
    },
    cameraAccessDenied: {
      title: 'Camera Access Denied',
      description: 'Please enable camera permissions in your browser settings to use this app.',
    },
    cameraNotSupported: {
      title: 'Camera Not Supported',
      description: 'Your browser does not support camera access or no camera is connected.',
    },
    chat: {
      initialMessage: 'Hello! How can I help you with {{cameraName}} today?',
    }
    // Add more keys as needed
  },
  es: {
    dashboard: 'Tablero',
    cameras: 'Cámaras',
    groups: 'Grupos',
    monitor: 'Monitor',
    videos: 'Videos',
    settings: 'Configuración',
    account: 'Mi Cuenta',
    organizationUsers: 'Usuarios de la Organización',
    systemAdministration: 'Administración del Sistema',
    organizations: 'Organizaciones', // Changed from Gestionar Organizaciones
    servers: 'Servidores', // Changed from Gestionar Servidores
    manageCameraIPs: 'Gestionar IPs de Cámaras',
    manageOrganizationUsers: 'Gestionar Usuarios de la Organización',
    octaVision: 'OctaVision',
    signOut: 'Cerrar Sesión',
    signOutSuccessMessage: 'Has cerrado sesión correctamente.',
    signOutFailedTitle: 'Error al Cerrar Sesión',
    signOutFailedMessage: 'Ocurrió un error al cerrar sesión. Por favor, inténtalo de nuevo.',
    orgApprovalPending: {
        title: 'Aprobación de Organización Pendiente',
        description: 'La cuenta de su organización está actualmente pendiente de aprobación. Puede agregar cámaras y configurar los ajustes. Sin embargo, el procesamiento de la cámara solo comenzará después de que un administrador apruebe la cuenta de su organización y según la disponibilidad de espacio en el servidor.',
    },
    languages: {
        en: 'Inglés',
        es: 'Español',
        pt: 'Portugués',
    },
    settingsPage: { 
        notifications: {
            title: 'Configuración de Notificaciones',
            email: 'Notificaciones por Correo',
            push: 'Notificaciones Push',
            sound: 'Sonido de Alerta',
        },
        theme: {
            title: 'Configuración de Tema',
            darkMode: 'Modo Oscuro',
            language: 'Idioma',
            selectLanguage: 'Seleccionar Idioma',
        },
        data: {
            title: 'Gestión de Datos',
            export: 'Exportar Mis Datos',
            deleteAccount: 'Eliminar Mi Cuenta',
        },
    },
    cameraAccessDenied: {
      title: 'Acceso a la Cámara Denegado',
      description: 'Por favor, habilita los permisos de la cámara en la configuración de tu navegador para usar esta aplicación.',
    },
    cameraNotSupported: {
      title: 'Cámara no Soportada',
      description: 'Tu navegador no soporta el acceso a la cámara o no hay ninguna cámara conectada.',
    },
    chat: {
      initialMessage: '¡Hola! ¿Cómo puedo ayudarte con {{cameraName}} hoy?',
    }
    // Add more keys as needed
  },
  pt: {
    dashboard: 'Painel',
    cameras: 'Câmeras',
    groups: 'Grupos',
    monitor: 'Monitorar',
    videos: 'Vídeos',
    settings: 'Configurações',
    account: 'Minha Conta',
    organizationUsers: 'Usuários da Organização',
    systemAdministration: 'Administração do Sistema',
    organizations: 'Organizações', // Changed from Gerenciar Organizações
    servers: 'Servidores', // Changed from Gerenciar Servidores
    manageCameraIPs: 'Gerenciar IPs de Câmera',
    manageOrganizationUsers: 'Gerenciar Usuários da Organização',
    octaVision: 'OctaVision',
    signOut: 'Sair',
    signOutSuccessMessage: 'Você saiu com sucesso.',
    signOutFailedTitle: 'Falha ao Sair',
    signOutFailedMessage: 'Ocorreu um erro ao sair. Por favor, tente novamente.',
    orgApprovalPending: {
        title: 'Aprovação da Organização Pendente',
        description: 'A conta da sua organização está atualmente aguardando aprovação. Você pode adicionar câmeras e definir configurações. No entanto, o processamento da câmera só começará após a aprovação da conta da sua organização por um administrador e com base na disponibilidade de espaço no servidor.',
    },
    languages: {
        en: 'Inglês',
        es: 'Espanhol',
        pt: 'Português',
    },
    settingsPage: { 
        notifications: {
            title: 'Configurações de Notificação',
            email: 'Notificações por Email',
            push: 'Notificações Push',
            sound: 'Som de Alerta',
        },
        theme: {
            title: 'Configurações de Tema',
            darkMode: 'Modo Escuro',
            language: 'Idioma',
            selectLanguage: 'Selecionar Idioma',
        },
        data: {
            title: 'Gerenciamento de Dados',
            export: 'Exportar Meus Dados',
            deleteAccount: 'Excluir Minha Conta',
        },
    },
    cameraAccessDenied: {
      title: 'Acesso à Câmera Negado',
      description: 'Por favor, habilite as permissões da câmera nas configurações do seu navegador para usar este aplicativo.',
    },
    cameraNotSupported: {
      title: 'Câmera não Suportada',
      description: 'Seu navegador não suporta acesso à câmera ou nenhuma câmera está conectada.',
    },
    chat: {
      initialMessage: 'Olá! Como posso te ajudar com {{cameraName}} hoje?',
    }
    // Add more keys as needed
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  translate: (key: string, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const storedLanguage = localStorage.getItem('language') as Language | null;
    if (storedLanguage && translationsData[storedLanguage]) {
      setLanguageState(storedLanguage);
    } else {
      // navigator.language can give 'en-US', so we take the first part
      const browserLanguage = navigator.language.split('-')[0] as Language;
      if (translationsData[browserLanguage]) {
        setLanguageState(browserLanguage);
      } else {
        setLanguageState('en'); // Default to English if browser language not supported
      }
    }
  }, []);

  const setLanguage = useCallback((newLanguage: Language) => {
    if (translationsData[newLanguage]) {
      setLanguageState(newLanguage);
      localStorage.setItem('language', newLanguage);
      // Optionally, you might want to set the lang attribute on the HTML element
      // document.documentElement.lang = newLanguage;
    }
  }, []);

  const translate = useCallback(
    (key: string, replacements: Record<string, string> = {}): string => {
      const keys = key.split('.');
      let current: string | Translations | undefined = translationsData[language];
      for (const k of keys) {
        if (typeof current === 'object' && current !== null && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }

      let result = typeof current === 'string' ? current : key; // Fallback to key if not found

      // Apply replacements
      Object.keys(replacements).forEach(placeholder => {
        result = result.replace(new RegExp(`{{${placeholder}}}`, 'g'), replacements[placeholder]);
      });
      
      return result;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  );
};
