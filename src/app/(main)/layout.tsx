
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Users,
  Activity,
  Film,
  Home,
  Camera as CameraIcon,
  CircleUserRound,
  Bell,
  Menu,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Shield,
  UserPlus,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NotificationDrawerProvider, useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import NotificationDrawer from '@/components/NotificationDrawer';


interface MainLayoutProps {
  children: ReactNode;
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/cameras': 'Cameras',
  '/groups': 'Groups',
  '/monitor': 'Monitor',
  '/videos': 'Videos',
  '/settings': 'Settings',
  '/account': 'My Account',
  '/organization-users': 'Organization Users',
  '/system-admin': 'System Administration',
};


const MainLayoutContent = ({ children }: MainLayoutProps) => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const { state: sidebarState, isMobile, toggleSidebar } = useSidebar();
  const currentPageTitle = pageTitles[pathname] || 'OctaVision';
  const { openNotificationDrawer } = useNotificationDrawer();


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData?.role || 'user'); // Default to 'user' if no role
          const organizationId = userData?.organizationId;

          if (organizationId) {
            const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
            if (orgDoc.exists()) {
              const orgData = orgDoc.data();
              setIsApproved(orgData?.approved || false);
            } else {
              console.error('Organization not found.');
              setIsApproved(false);
            }
          } else {
             console.error('Organization ID not found for user.');
             setIsApproved(false);
          }
        } else {
          console.error('User data not found.');
          setIsApproved(false);
          setUserRole(null);
        }
      } else {
        setIsApproved(false);
        setUserRole(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
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
            style={{ color: 'rgb(var(--octaview-primary))' }}
          >
            {sidebarState === 'collapsed' && !isMobile ? 'OV' : 'OctaVision'}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/dashboard" passHref legacyBehavior>
                <SidebarMenuButton isActive={pathname === '/dashboard'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Home className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Dashboard</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            {isApproved === true && (
              <>
                <SidebarMenuItem>
                  <Link href="/cameras" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/cameras'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <CameraIcon className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Cameras</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/groups" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/groups'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <Users className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Groups</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/monitor" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/monitor'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <Activity className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Monitor</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/videos" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/videos'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <Film className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Videos</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/settings" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/settings'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <Settings className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Settings</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/account" passHref legacyBehavior>
                    <SidebarMenuButton isActive={pathname === '/account'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                      <CircleUserRound className="h-4 w-4" />
                      {sidebarState === 'expanded' && <span>Account</span>}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                {userRole === 'user_admin' && (
                  <SidebarMenuItem>
                    <Link href="/organization-users" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname === '/organization-users'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <UserPlus className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>Org Users</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                )}
                {userRole === 'system_admin' && (
                  <SidebarMenuItem>
                    <Link href="/system-admin" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname === '/system-admin'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <Shield className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>System Admin</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                )}
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-center text-xs">Version 3.0.0</div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col">
        <div className="bg-background border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10 h-16">
          <div className="flex items-center">
            <Button variant="outline" className="h-8 w-8 p-1.5 border" onClick={toggleSidebar}>
              {sidebarState === 'expanded' && !isMobile ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <h1
              className="text-lg font-semibold ml-2"
              style={{ color: 'rgb(var(--octaview-primary))' }}
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
                <Button variant="ghost" className="h-8 w-8 p-0 rounded-md">
                  <Avatar className="h-8 w-8 rounded-md">
                    <AvatarImage
                      src="https://picsum.photos/id/1005/50/50"
                      alt="User Avatar"
                      className="rounded-md"
                      data-ai-hint="user avatar"
                    />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Link href="/account">Account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/logout">Logout</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isApproved === false && (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertTitle>Account Not Approved</AlertTitle>
              <AlertDescription>
                Your organization's account is awaiting approval from the
                administrator. Please check back later or contact support.
              </AlertDescription>
            </Alert>
          </div>
        )}
        <main className="p-8 flex-1 overflow-y-auto">
          { (isLoading === false && isApproved === null && userRole === null) ? <div className="flex h-full items-center justify-center w-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> : children }
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
        <div className="flex h-screen">
          <MainLayoutContent>{children}</MainLayoutContent>
        </div>
      </SidebarProvider>
    </NotificationDrawerProvider>
  );
};

export default MainLayout;
