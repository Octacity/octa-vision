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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db } from "@/firebase/firebase";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc, collection, addDoc, Timestamp } from "firebase/firestore";

const SignUpPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationEmail, setOrganizationEmail] = useState("");
  const [organizationPhone, setOrganizationPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

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
        email: organizationEmail,
        phone: organizationPhone,
        billingAddress: billingAddress,
        description: organizationDescription,
        approved: false,
        createdAt: Timestamp.now(),
      });

      // Store user info in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        organizationId: orgRef.id, // Reference to the organization
        createdAt: Timestamp.now(),
      });

      console.log("User created:", user);
      router.push("/");
    } catch (error: any) {
      console.error("Error signing up:", error);
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-3xl font-bold text-gray-800">
          Sign Up for <span className="text-accent">OctaVision</span>
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-around max-w-4xl sm:w-full">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-2xl">Create Your Account</CardTitle>
              <CardDescription>Enter your details to get started.</CardDescription>
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
                  <Label htmlFor="email">Email</Label>
                  <Input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    type="text"
                    id="organizationName"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organizationEmail">Organization Email</Label>
                  <Input
                    type="email"
                    id="organizationEmail"
                    value={organizationEmail}
                    onChange={(e) => setOrganizationEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organizationPhone">Organization Phone</Label>
                  <Input
                    type="tel"
                    id="organizationPhone"
                    value={organizationPhone}
                    onChange={(e) => setOrganizationPhone(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="billingAddress">Billing Address</Label>
                  <Textarea
                    id="billingAddress"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="organizationDescription">Organization Description</Label>
                  <Textarea
                    id="organizationDescription"
                    value={organizationDescription}
                    onChange={(e) => setOrganizationDescription(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit">Sign Up</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="flex items-center justify-center w-full border-t"></footer>
    </div>
  );
};

export default SignUpPage;
