
'use client';

import type { ReactNode} from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Language = 'en' | 'es'; // Add more languages as needed

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
    manageOrganizations: 'Manage Organizations',
    manageServers: 'Manage Servers',
    manageCameraIPs: 'Manage Camera IPs',
    manageOrganizationUsers: 'Manage Organization Users',
    octaVision: 'OctaVision',
    signOut: 'Sign Out',
    languages: {
        en: 'English',
        es: 'Spanish',
    },
    settings: {
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
    manageOrganizations: 'Gestionar Organizaciones',
    manageServers: 'Gestionar Servidores',
    manageCameraIPs: 'Gestionar IPs de Cámaras',
    manageOrganizationUsers: 'Gestionar Usuarios de la Organización',
    octaVision: 'OctaVision',
    signOut: 'Cerrar Sesión',
     languages: {
        en: 'Inglés',
        es: 'Español',
    },
    settings: {
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
    // Add more keys as needed
  },
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
