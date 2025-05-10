"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const JoinOrganizationPage = () => {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const orgId = params.orgId as string;
  const prefilledEmail = searchParams.get("email");

  const [email, setEmail] = useState(prefilledEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(true);


  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (orgId) {
      const fetchOrgDetails = async () => {
        setIsOrgLoading(true);
        const orgDocRef = doc(db, "organizations", orgId);
        const orgDocSnap = await getDoc(orgDocRef);
        if (orgDocSnap.exists()) {
          setOrganizationName(orgDocSnap.data().name);
        } else {
          setErrorMessage("Invalid organization link. Please check the URL or contact support.");
          setOrganizationName(null); // Ensure orgName is null if org not found
        }
        setIsOrgLoading(false);
      };
      fetchOrgDetails();
    } else {
        setErrorMessage("Organization ID is missing from the link.");
        setIsOrgLoading(false);
    }
  }, [orgId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (!orgId || !organizationName) {
        setErrorMessage("Organization details are missing or invalid. Cannot proceed.");
        return;
    }

    setIsLoading(true);

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: email,
        organizationId: orgId,
        role: 'user', // Default role for users joining an organization
        createdAt: serverTimestamp(),
        // Name can be added later via profile update
      });

      router.push("/signin"); // Redirect to sign-in after successful simplified sign-up
    } catch (error: any) {
      console.error("Error joining organization:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage("This email address is already in use.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage("Password should be at least 6 characters.");
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isOrgLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-octaview-secondary">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground mt-2">Loading organization details...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-octaview-secondary">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--octaview-primary))' }}>
          Join {organizationName ? <span style={{ color: 'rgb(var(--octaview-accent))' }}>{organizationName}</span> : "Organization"} on OctaVision
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-around max-w-4xl sm:w-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardDescription className="text-muted-foreground">
                Create your account to join {organizationName || "this organization"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="email" className="block text-left text-muted-foreground mb-1">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={!!prefilledEmail} 
                  />
                   {prefilledEmail && <p className="text-xs text-muted-foreground mt-1">This email is pre-filled from your invitation.</p>}
                </div>

                <div>
                  <Label htmlFor="password" className="block text-left text-muted-foreground mb-1">Password</Label>
                  <Input
                    type="password"
                    id="password"
                    placeholder="Create a strong password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="block text-left text-muted-foreground mb-1">Confirm Password</Label>
                  <Input
                    type="password"
                    id="confirmPassword"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" disabled={isLoading || !organizationName} className="bg-primary text-primary-foreground hover:bg-primary/80">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Joining..." : "Join Organization"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="flex items-center justify-center w-full h-20 border-t border-border mt-8">
         <p className="text-muted-foreground text-sm">
            Already have an account?{" "}
            <Link href="/signin" className="font-medium hover:text-accent">
              Sign In
            </Link>
          </p>
      </footer>
    </div>
  );
};

export default JoinOrganizationPage;
