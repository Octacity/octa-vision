
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
  Users as UsersIcon, // Renamed to avoid conflict
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
  UserPlus,
  LogOut,
  ShieldAlert,
  Briefcase, 
  Server, // Added for Our Servers
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
  SidebarProvider,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { NotificationDrawerProvider, useNotificationDrawer } from '@/contexts/NotificationDrawerContext';
import NotificationDrawer from '@/components/NotificationDrawer';
import { useToast } from '@/hooks/use-toast';


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
  '/system-admin/organizations': 'Manage Organizations',
  '/system-admin/users': 'Manage System Users',
  '/system-admin/servers': 'Manage Servers', // Added title for servers
};
// Add a more generic way to handle dynamic routes for titles or handle it within the page component
const getPageTitle = (pathname: string): string => {
  if (pathname.startsWith('/system-admin/organizations/') && pathname.endsWith('/ips')) {
    return 'Manage Camera IPs';
  }
  return pageTitles[pathname] || 'OctaVision';
};


const MainLayoutContent = ({ children }: MainLayoutProps) => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const { state: sidebarState, isMobile, toggleSidebar } = useSidebar();
  const currentPageTitle = getPageTitle(pathname);
  const { openNotificationDrawer } = useNotificationDrawer();


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData?.role || 'user'); 
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
             // If user is system-admin, they might not have an organizationId
             if (userData?.role !== 'system-admin') {
                console.error('Organization ID not found for user.');
                setIsApproved(false);
             } else {
                setIsApproved(true); // System admins are implicitly "approved" for access
             }
          }
        } else {
          console.error('User data not found.');
          setIsApproved(false);
          setUserRole(null);
        }
      } else {
        // User is not logged in, or session expired
        setIsApproved(false); 
        setUserRole(null);   
        if (pathname !== '/signin' && pathname !== '/signup' && pathname !== '/') {
          router.push('/signin'); 
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const handleSignOut = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({ title: 'Signed Out', description: 'You have been successfully signed out.' });
      router.push('/signin');
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ variant: 'destructive', title: 'Sign Out Failed', description: 'Could not sign you out. Please try again.' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (isLoading === false && !getAuth().currentUser && pathname !== '/signin' && pathname !== '/signup' && pathname !== '/') {
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
            { (isApproved || userRole === 'system-admin') && (
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
                      <UsersIcon className="h-4 w-4" />
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
                {userRole === 'user-admin' && (
                  <SidebarMenuItem>
                    <Link href="/organization-users" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname === '/organization-users'} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <UserPlus className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>Org Users</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                )}
              </>
            )}
            {userRole === 'system-admin' && (
              <SidebarGroup>
                <SidebarGroupLabel>System Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenuItem>
                    <Link href="/system-admin/organizations" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname.startsWith('/system-admin/organizations')} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <Briefcase className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>Organizations</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/system-admin/users" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname.startsWith('/system-admin/users')} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <UsersIcon className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>System Users</span>}
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                   <SidebarMenuItem>
                    <Link href="/system-admin/servers" passHref legacyBehavior>
                      <SidebarMenuButton isActive={pathname.startsWith('/system-admin/servers')} size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                        <Server className="h-4 w-4" />
                        {sidebarState === 'expanded' && <span>Our Servers</span>}
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
      <div className="flex-1 flex flex-col">
        <div className="bg-background border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10 h-16">
          <div className="flex items-center">
            <Button variant="outline" className="h-8 w-8 p-1.5 border" onClick={toggleSidebar}>
              {sidebarState === 'expanded' && !isMobile ? <ArrowLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
                <DropdownMenuItem asChild>
                  <Link href="/account">
                    <CircleUserRound className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isApproved === false && getAuth().currentUser && userRole !== 'system-admin' && (
          <div className="p-4">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Organization Approval Pending</AlertTitle>
              <AlertDescription>
                Your organization's account is currently awaiting approval. You can add cameras and set up configurations. However, camera processing will only begin after your organization's account is approved by an administrator and based on server space availability.
              </AlertDescription>
            </Alert>
          </div>
        )}
        <main className="p-8 flex-1 overflow-y-auto">
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
        <div className="flex h-screen">
          <MainLayoutContent>{children}</MainLayoutContent>
        </div>
      </SidebarProvider>
    </NotificationDrawerProvider>
  );
};

export default MainLayout;
