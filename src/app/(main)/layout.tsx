'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import {
  Settings,
  PanelLeft,
  Users,
  Activity,
  Film,
  Home,
  Camera as CameraIcon, // Renamed to avoid conflict
  CircleUserRound,
  Bell,
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Keep for unapproved message

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayoutContent = ({ children }: MainLayoutProps) => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isAdmin, setIsAdmin] = useState(false); // Keep if admin-specific UI is needed later
  // const [userEmail, setUserEmail] = useState<string | null>(null); // Keep if needed later

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // setUserEmail(user.email);
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const organizationId = userData?.organizationId;
          // const role = userData?.role;
          // if (role === 'system_admin') {
          //   setIsAdmin(true);
          // }

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
        }
      } else {
        setIsApproved(false); // No user, treat as not approved
        // Optionally redirect to sign-in page
        // router.push('/signin');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const { state: sidebarState, isMobile } = useSidebar();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading...</p>
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
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Home className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Dashboard</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/cameras" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <CameraIcon className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Cameras</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/groups" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Users className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Groups</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <Link href="/monitor" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Activity className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Monitor</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/videos" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Film className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Videos</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
             <SidebarMenuItem>
              <Link href="/settings" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <Settings className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Settings</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
               <Link href="/account" passHref legacyBehavior>
                <SidebarMenuButton size={sidebarState === 'collapsed' && !isMobile ? 'icon' : 'default'}>
                  <CircleUserRound className="h-4 w-4" />
                  {sidebarState === 'expanded' && <span>Account</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-center text-xs">Version 3.0.0</div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col">
        <div className="bg-background border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10 h-16">
          <div className="flex items-center">
            <SidebarTrigger variant="outline" className="h-8 w-8 p-1.5" />
            <h1
              className="text-lg font-semibold ml-2"
              style={{ color: 'rgb(var(--octaview-primary))' }}
            >
              {/* This title can be dynamic based on the current page */}
              OctaVision
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="icon" className="h-8 w-8 p-0">
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
                  <Link href="/logout">Logout</Link> {/* Implement logout functionality */}
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
        {isApproved === true && <main className="p-8 flex-1 overflow-y-auto">{children}</main>}
        {isApproved === null && <main className="p-8 flex-1 overflow-y-auto">{children}</main>}
      </div>
    </>
  );
};

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <MainLayoutContent>{children}</MainLayoutContent>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
