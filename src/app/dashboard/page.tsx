"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings,
  PanelLeft,
  Plus,
  Users,
  SlidersHorizontal,
  ArrowDownToLine,
  MoreVertical,
  BarChart4,
  Inbox as InboxIcon,
  Bookmark,
  CheckCircle,
  Clock,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const cameras = [
  {
    name: "Camera 1",
    imageUrl: "https://picsum.photos/id/237/200/150",
  },
  {
    name: "Camera 2",
    imageUrl: "https://picsum.photos/id/238/200/150",
  },
  {
    name: "Camera 3",
    imageUrl: "https://picsum.photos/id/239/200/150",
  },
  {
    name: "Camera 4",
    imageUrl: "https://picsum.photos/id/240/200/150",
  },
  {
    name: "Camera 5",
    imageUrl: "https://picsum.photos/id/241/200/150",
  },
  {
    name: "Camera 6",
    imageUrl: "https://picsum.photos/id/242/200/150",
  },
  {
    name: "Camera 7",
    imageUrl: "https://picsum.photos/id/243/200/150",
  },
  {
    name: "Camera 8",
    imageUrl: "https://picsum.photos/id/244/200/150",
  },
  {
    name: "Camera 9",
    imageUrl: "https://picsum.photos/id/245/200/150",
  },
];

const DashboardPage = () => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email); // Set the user's email
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const organizationId = userData?.organizationId;
          const role = userData?.role; // Get the user's role

          // Check if the user is an admin
          if (role === "system_admin") {
            setIsAdmin(true);
          }

          // Fetch organization data to check approval status
          const orgDoc = await getDoc(
            doc(db, "organizations", organizationId)
          );

          if (orgDoc.exists()) {
            const orgData = orgDoc.data();
            setIsApproved(orgData?.approved || false);
          } else {
            console.error("Organization not found.");
            setIsApproved(false); // Treat as not approved
          }
        } else {
          console.error("User data not found.");
          setIsApproved(false); // Treat as not approved
        }
      } else {
        setIsApproved(false); // No user, treat as not approved
      }
      setIsLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription
  }, []);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            href="/"
            className="text-lg font-semibold text-foreground block mb-6"
            style={{ color: "rgb(var(--octaview-primary))" }}
          >
            OctaVision
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <PanelLeft className="h-4 w-4" />
                <span>Cameras</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <BarChart4 className="h-4 w-4" />
                <span>Report</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <InboxIcon className="h-4 w-4" />
                <span>Inbox</span>
                <SidebarMenuBadge>9</SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="text-center text-xs">Version 3.0.0</div>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1">
        {/* App Bar */}
        <div className="bg-background border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold ml-2" style={{ color: "rgb(var(--octaview-primary))" }}>Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                  <span className="sr-only">Open user menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

        {/* Main Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cameras.map((camera, index) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="relative">
                    <Image
                      src={camera.imageUrl}
                      alt={camera.name}
                      width={200}
                      height={150}
                      className="rounded-md aspect-video w-full"
                    />
                    <CheckCircle className="absolute top-2 right-2 h-5 w-5 text-green-500" />
                  </div>
                  <h3 className="text-sm font-semibold mt-2">{camera.name}</h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                    <span>15 min</span>
                    <div className="flex items-center space-x-2">
                      <span>5</span>
                      <Button variant="ghost" size="icon">
                        <InboxIcon className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Bookmark className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardPage;
