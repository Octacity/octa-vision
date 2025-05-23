
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import {
  Settings,
  Activity,
  Film,
  Home,
  Camera as CameraIcon,
  CircleUserRound,
  Bell,
  Menu,
  ArrowLeft,
  Loader2,
  Shield,
  Users as UsersIcon,
  LogOut,
  ShieldAlert,
  Briefcase,
  Server,
  Folder,
  DollarSign,
  MoreVertical, 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NotificationDrawerProvider, useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import NotificationDrawer from '@/components/NotificationDrawer';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { PageLoadingProvider, usePageLoading } from '@/contexts/LoadingContext';


interface MainLayoutProps {
  children: ReactNode;
}

const MainLayoutContent = ({ children }: MainLayoutProps) => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isPageLoading, setIsPageLoading] = useState(false); // Removed local state
  const { isPageLoading, setIsPageLoading } = usePageLoading(); // Use context state
  const [canAccessSystemAdminMenu, setCanAccessSystemAdminMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { state: sidebarState, isMobile, toggleSidebar, setOpenMobile } = useSidebar();
  const { openNotificationDrawer } = useNotificationDrawer();
  const { translate, language } = useLanguage();

  const getPageTitle = (pathname: string): string => {
    const routeToTranslationKey: Record<string, string> = {
      '/dashboard': 'dashboard',
      '/cameras': 'cameras',
      '/groups': 'groups',
      '/monitor': 'monitor',
      '/videos': 'videos',
      '/settings': 'settings',
      '/account': 'account',
      '/organization-users': 'users',
      '/system-admin': 'systemAdministration',
      '/system-admin/organizations': 'organizations',
      '/system-admin/servers': 'servers',
    };
     if (pathname.startsWith('/system-admin/organizations/') && pathname.endsWith('/ips')) {
        return translate('manageCameraIPs');
    }
    if (pathname.startsWith('/system-admin/organizations/') && pathname.endsWith('/users')) {
        return translate('manageOrganizationUsers');
    }
    if (pathname.startsWith('/system-admin/organizations/') && pathname.endsWith('/cameras')) {
        return translate('manageOrganizationCameras');
    }
     if (pathname.startsWith('/system-admin/organizations/') && pathname.endsWith('/billing')) {
        return translate('manageBilling.pageTitle');
    }
    const key = routeToTranslationKey[pathname] || 'octaVision';
    return translate(key);
  };

  const currentPageTitle = getPageTitle(pathname);


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentRole = userData?.role || 'user';
          setUserRole(currentRole);
          
          let orgHasAdminPrivileges = false;
          const organizationId = userData?.organizationId;

          if (organizationId) {
            const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
            if (orgDoc.exists()) {
              const orgData = orgDoc.data();
              if (orgData?.admin === true) {
                orgHasAdminPrivileges = true;
              }
            } else {
              console.error('Organization not found.');
            }
          } else {
             if (currentRole !== 'system-admin') {
                console.error('Organization ID not found for non-system-admin user.');
             }
          }

          if (currentRole === 'system-admin' || orgHasAdminPrivileges) {
            setCanAccessSystemAdminMenu(true);
          } else {
            setCanAccessSystemAdminMenu(false);
          }

        } else {
          console.error('User data not found.');
          setUserRole(null);
          setCanAccessSystemAdminMenu(false);
          await signOut(auth); 
          router.push('/signin'); 
        }
      } else {
        setUserRole(null);
        setCanAccessSystemAdminMenu(false);
        if (pathname !== '/signin' && pathname !== '/signup' && !pathname.startsWith('/join/') && pathname !== '/') {
          router.push('/signin');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);
  
  useEffect(() => {
    setIsPageLoading(false); 
  }, [pathname, setIsPageLoading]);


  const handleSignOut = async () => {
    setIsPageLoading(true);
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({ title: translate('signOut'), description: translate('signOutSuccessMessage') });
      router.push('/'); 
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ variant: 'destructive', title: translate('signOutFailedTitle'), description: translate('signOutFailedMessage') });
      setIsPageLoading(false);
    }
  };

  const handleMenuItemClick = (href?: string) => {
    if (href && href !== pathname) {
      setIsPageLoading(true);
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading === false && !getAuth().currentUser && pathname !== '/signin' && pathname !== '/signup' && !pathname.startsWith('/join/') && pathname !== '/') {
    return (
      <div className="flex h-screen items-center justify-center w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-16 border-b border-border flex items-center justify-center px-4 py-5">
          <Link
            href="/dashboard"
            className="text-lg font-semibold"
            style={{ color: "rgb(var(--octaview-primary))" }}
            onClick={() => handleMenuItemClick("/dashboard")}
          >
            {sidebarState === 'collapsed' && !isMobile ? 'OV' : translate('octaVision')}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="pt-1">
            <SidebarMenuItem>
              <Link href="/dashboard" passHref legacyBehavior>
                <SidebarMenuButton isActive={pathname === '/dashboard'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/dashboard")}>
                  <Home className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>{translate('dashboard')}</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

            <>
              <SidebarMenuItem>
                <Link href="/cameras" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/cameras'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/cameras")}>
                    <CameraIcon className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('cameras')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/groups" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/groups'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/groups")}>
                    <Folder className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('groups')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/monitor" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/monitor'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/monitor")}>
                    <Activity className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('monitor')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/videos" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/videos'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/videos")}>
                    <Film className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('videos')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/settings" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/settings'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/settings")}>
                    <Settings className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('settings')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/account" passHref legacyBehavior>
                  <SidebarMenuButton isActive={pathname === '/account'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/account")}>
                    <CircleUserRound className="h-4 w-4" />
                    {sidebarState === 'expanded' && <span>{translate('account')}</span>}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>

              {userRole === 'user-admin' && (
                <SidebarMenuItem>
                  <Link href="/organization-users" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/organization-users'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/organization-users")}>
                      <UsersIcon className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>{translate('users')}</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
            </>


            {canAccessSystemAdminMenu && (
              <SidebarGroup>
                <SidebarGroupLabel>{translate('systemAdministration')}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenuItem>
                    <Link href="/system-admin/organizations" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname.startsWith('/system-admin/organizations')} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/system-admin/organizations")}>
                        <Briefcase className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>{translate('organizations')}</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                    <Link href="/system-admin/servers" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname.startsWith('/system-admin/servers')} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'} onClick={() => handleMenuItemClick("/system-admin/servers")}>
                        <Server className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>{translate('servers')}</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-center text-xs">Version 3.0.0</div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col overflow-x-hidden">
        <div className="bg-background border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10 h-16">
          <div className="flex items-center">
            <Button variant="outline" className="h-8 w-8 p-1.5 border" onClick={toggleSidebar}>
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <h1
              className="text-lg ml-2 font-normal text-foreground"
            >
              {currentPageTitle}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" className="h-8 w-8 p-0" onClick={() => openNotificationDrawer()}>
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                   <span className="sr-only">Open user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleMenuItemClick("/account")} asChild>
                  <Link href="/account">
                    <CircleUserRound className="mr-2 h-4 w-4" />
                    {translate('account')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleMenuItemClick("/settings")} asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {translate('settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  {translate('signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        
        <main className="p-4 md:p-8 flex-1 overflow-y-auto relative">
         {isPageLoading && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-50">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
         {children}
        </main>
         <NotificationDrawer />
      </div>
    </>
  );
};

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <NotificationDrawerProvider>
      <SidebarProvider>
        <PageLoadingProvider>
          <div className="flex h-screen">
            <MainLayoutContent>{children}</MainLayoutContent>
          </div>
        </PageLoadingProvider>
      </SidebarProvider>
    </NotificationDrawerProvider>
  );
};

export default MainLayout;
