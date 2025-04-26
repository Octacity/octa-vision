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
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-secondary border-r border-border flex flex-col py-4">
        <div className="px-6 py-2">
          <Link
            href="/"
            className="text-lg font-semibold text-foreground block mb-6"
          >
            OctaVision - OV3
          </Link>
        </div>
        <nav className="flex-1">
          <ul>
            <li className="px-6 py-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-sm"
              >
                <PanelLeft className="h-4 w-4" />
                <span>Cameras</span>
              </Link>
            </li>
            <li className="px-6 py-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
              <Link
                href="#"
                className="flex items-center space-x-2 text-sm"
              >
                <BarChart4 className="h-4 w-4" />
                <span>Report</span>
              </Link>
            </li>
            <li className="px-6 py-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors relative">
              <Link
                href="#"
                className="flex items-center space-x-2 text-sm"
              >
                <InboxIcon className="h-4 w-4" />
                <span>Inbox</span>
                <span className="absolute top-1 right-2 bg-destructive text-destructive-foreground text-xs px-1 rounded-full">
                  9
                </span>
              </Link>
            </li>
            <li className="px-6 py-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
              <Link
                href="#"
                className="flex items-center space-x-2 text-sm"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </li>
          </ul>
        </nav>
        <div className="px-6 py-2 mt-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">
            Label
          </h3>
          <ul className="mt-2">
            <li className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors px-2 py-1">
              <CheckCircle className="h-3 w-3" />
              <span>Published</span>
            </li>
            <li className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors px-2 py-1">
              <Clock className="h-3 w-3" />
              <span>Today's Scheduled</span>
            </li>
            <li className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors px-2 py-1">
              <Bookmark className="h-3 w-3" />
              <span>Bookmarks</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Cameras</h1>
          <div className="flex items-center space-x-4">
            <Input type="search" placeholder="Search" className="max-w-xs" />
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Camera
            </Button>
            <Button variant="ghost" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Group
            </Button>
            <Button variant="ghost" size="sm">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="ghost" size="sm">
              <ArrowDownToLine className="h-4 w-4 mr-2" />
              Sort
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
            <Settings className="h-5 w-5 text-muted-foreground" />
            <Button variant="ghost" size="icon">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
            </Button>
          </div>
        </header>

        {/* Camera Grid */}
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

        {/* Next Button */}
        <div className="flex justify-end mt-8">
          <Button>Next</Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
