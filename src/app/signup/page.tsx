
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
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationPhone, setOrganizationPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [needForOctaVision, setNeedForOctaVision] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);

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

      // Create a new organization document
      const orgRef = await addDoc(collection(db, "organizations"), {
        name: organizationName,
        phone: organizationPhone,
        billingAddress: billingAddress,
        description: organizationDescription,
        needForOctaVision: needForOctaVision, 
        approved: false, 
        createdAt: serverTimestamp(),
      });

      // Store user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        organizationId: orgRef.id,
        role: 'user-admin',
        createdAt: serverTimestamp(),
      });

      router.push("/dashboard");
    } catch (error: any)
     {
      console.error("Error signing up:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage("This email address is already in use.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage("Password should be at least 6 characters.");
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
            <CardHeader>
              {/* Removed CardTitle and CardDescription */}
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
                  />
                </div>

                <div>
                  <Label htmlFor="needForOctaVision" className="block text-left text-muted-foreground mb-1">How do you plan to use OctaVision?</Label>
                  <Textarea
                    id="needForOctaVision"
                    value={needForOctaVision}
                    onChange={(e) => setNeedForOctaVision(e.target.value)}
                    required
                    placeholder="Briefly describe your use case or the problems you're trying to solve (e.g., improve workplace safety, monitor inventory, enhance security)."
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

