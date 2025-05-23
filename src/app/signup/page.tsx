
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
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import { doc, setDoc, collection, addDoc, serverTimestamp, getDoc, query, where, getDocs, limit } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationPhone, setOrganizationPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [primaryUseCases, setPrimaryUseCases] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      let orgDefaultServerIdToSet: string | null = null;
      try {
        const serversQuery = query(collection(db, "servers"), where("isSystemDefault", "==", true), limit(1));
        const serversSnapshot = await getDocs(serversQuery);
        if (!serversSnapshot.empty) {
          orgDefaultServerIdToSet = serversSnapshot.docs[0].id;
        }
      } catch (serverError) {
        console.warn("Could not fetch system default server during signup:", serverError);
        // Continue without setting orgDefaultServerId if it fails
      }

      const orgRef = await addDoc(collection(db, "organizations"), {
        name: organizationName,
        phone: organizationPhone,
        billingAddress: billingAddress,
        description: organizationDescription,
        primaryUseCases: primaryUseCases,
        approved: false,
        admin: false,
        orgDefaultServerId: orgDefaultServerIdToSet, // Set org's default server ID
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "users", user.uid), {
        email: email,
        name: null,
        organizationId: orgRef.id,
        role: 'user-admin',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const newUserDoc = await getDoc(doc(db, "users", user.uid));
      if (newUserDoc.exists()) {
        toast({
          title: "Signup Successful",
          description: "Your account and organization have been created. Welcome!",
        });
        router.push("/dashboard");
      } else {
        console.error("Signup: User document not found immediately after creation for UID:", user.uid);
        setErrorMessage("Signup completed, but there was an issue preparing your account. Please try signing in or contact support.");
        await signOut(auth);
      }

    } catch (error: any)
     {
      console.error("Error signing up:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage("This email address is already in use.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage("Password should be at least 6 characters.");
      } else if (error.code === 'permission-denied' || error.code === 'firestore/permission-denied') {
        setErrorMessage("Permission denied. Please ensure your data is correct or contact support if this issue persists.");
      }
      else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-octaview-secondary">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        <h1 className="text-3xl font-bold" style={{ color: 'rgb(var(--octaview-primary))' }}>
          Sign Up for <span style={{ color: 'rgb(var(--octaview-accent))' }}>OctaVision</span>
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-around max-w-4xl sm:w-full">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
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
                  />
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
                  <Label htmlFor="organizationName" className="block text-left text-muted-foreground mb-1">Organization Name</Label>
                  <Input
                    type="text"
                    id="organizationName"
                    placeholder="Enter your organization's name"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    autoComplete="organization"
                  />
                </div>

                <div>
                  <Label htmlFor="organizationPhone" className="block text-left text-muted-foreground mb-1">Organization Phone</Label>
                  <Input
                    type="tel"
                    id="organizationPhone"
                    placeholder="Enter organization's phone number"
                    value={organizationPhone}
                    onChange={(e) => setOrganizationPhone(e.target.value)}
                    required
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <Label htmlFor="billingAddress" className="block text-left text-muted-foreground mb-1">Billing Address</Label>
                  <Textarea
                    id="billingAddress"
                    placeholder="Enter the complete billing address"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    required
                    autoComplete="street-address"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="organizationDescription" className="block text-left text-muted-foreground mb-1">Organization Description</Label>
                  <Textarea
                    id="organizationDescription"
                    placeholder="Describe your organization and its primary activities"
                    value={organizationDescription}
                    onChange={(e) => setOrganizationDescription(e.target.value)}
                    required
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="primaryUseCases" className="block text-left text-muted-foreground mb-1">How do you plan to use our platform?</Label>
                  <Textarea
                    id="primaryUseCases"
                    value={primaryUseCases}
                    onChange={(e) => setPrimaryUseCases(e.target.value)}
                    required
                    placeholder="Briefly describe your use case or the problems you're trying to solve (e.g., improve workplace safety, monitor inventory, enhance security)."
                    rows={3}
                  />
                </div>


                <Button type="submit" disabled={isLoading} className="bg-primary text-primary-foreground hover:bg-primary/80">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Signing Up..." : "Sign Up"}
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

export default SignUpPage;

