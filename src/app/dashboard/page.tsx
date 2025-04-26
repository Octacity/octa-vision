"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const DashboardPage = () => {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const organizationId = userData?.organizationId;
          const role = userData?.role; // Get the user's role

          // Check if the user is an admin
          if (role === 'system-admin') {
            setIsAdmin(true);
          }

          // Fetch organization data to check approval status
          const orgDoc = await getDoc(doc(db, "organizations", organizationId));

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
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold text-gray-800">
          Welcome to your Dashboard!
        </h1>

        {isLoading ? (
          <p className="mt-3 text-xl text-gray-600">Loading...</p>
        ) : isApproved === true ? (
          <p className="mt-3 text-xl text-gray-600">
            Your account is active and approved.
          </p>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>Account Pending Approval</AlertTitle>
            <AlertDescription>
              Your account is pending admin approval. Please wait for approval to
              access all features.
            </AlertDescription>
          </Alert>
        )}

        {/* Conditionally render admin button */}
        {isAdmin && (
          <Button onClick={() => alert('Admin functionality here!')}>
            Go to Admin Panel
          </Button>
        )}
      </main>

      <footer className="flex items-center justify-center w-full border-t"></footer>
    </div>
  );
};

export default DashboardPage;
