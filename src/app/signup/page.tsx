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

  // Use a single state object to manage focus states
  const [focus, setFocus] = useState({
    email: false,
    password: false,
    organizationName: false,
    organizationEmail: false,
    organizationPhone: false,
    billingAddress: false,
    organizationDescription: false,
  });

  const router = useRouter();

  const handleFocusChange = (field: string, isFocused: boolean) => {
    setFocus((prev) => ({ ...prev, [field]: isFocused }));
  };

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
        <h1 className="text-2xl font-bold text-gray-800">
          Sign Up for <span className="text-accent">OctaVision</span>
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-around max-w-4xl sm:w-full">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-xl">Create Your Account</CardTitle>
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

                {/* Email */}
                <div className="relative">
                  <Input
                    type="email"
                    id="email"
                    value={email}
										placeholder={focus.email || email ? "" : "Email"}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => handleFocusChange("email", true)}
                    onBlur={() => handleFocusChange("email", false)}
                    required
                  />
                  <Label
                    htmlFor="email"
                    className={`form-item-floating-label ${
                      focus.email || email ? "form-item-floating-label-focused" : ""
                    }`}
                  >
                    Email
                  </Label>
                </div>

                {/* Password */}
                <div className="relative">
                  <Input
                    type="password"
                    id="password"
                    value={password}
										placeholder={focus.password || password ? "" : "Password"}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => handleFocusChange("password", true)}
                    onBlur={() => handleFocusChange("password", false)}
                    required
                  />
                  <Label
                    htmlFor="password"
                    className={`form-item-floating-label ${
                      focus.password || password ? "form-item-floating-label-focused" : ""
                    }`}
                  >
                    Password
                  </Label>
                </div>

                {/* Organization Name */}
                <div className="relative">
                  <Input
                    type="text"
                    id="organizationName"
                    value={organizationName}
										placeholder={focus.organizationName || organizationName ? "" : "Organization Name"}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    onFocus={() => handleFocusChange("organizationName", true)}
                    onBlur={() => handleFocusChange("organizationName", false)}
                    required
                  />
                  <Label
                    htmlFor="organizationName"
                    className={`form-item-floating-label ${
                      focus.organizationName || organizationName
                        ? "form-item-floating-label-focused"
                        : ""
                    }`}
                  >
                    Organization Name
                  </Label>
                </div>

                {/* Organization Email */}
                <div className="relative">
                  <Input
                    type="email"
                    id="organizationEmail"
                    value={organizationEmail}
										placeholder={focus.organizationEmail || organizationEmail ? "" : "Organization Email"}
                    onChange={(e) => setOrganizationEmail(e.target.value)}
                    onFocus={() => handleFocusChange("organizationEmail", true)}
                    onBlur={() => handleFocusChange("organizationEmail", false)}
                    required
                  />
                  <Label
                    htmlFor="organizationEmail"
                    className={`form-item-floating-label ${
                      focus.organizationEmail || organizationEmail
                        ? "form-item-floating-label-focused"
                        : ""
                    }`}
                  >
                    Organization Email
                  </Label>
                </div>

                {/* Organization Phone */}
                <div className="relative">
                  <Input
                    type="tel"
                    id="organizationPhone"
                    value={organizationPhone}
										placeholder={focus.organizationPhone || organizationPhone ? "" : "Organization Phone"}
                    onChange={(e) => setOrganizationPhone(e.target.value)}
                    onFocus={() => handleFocusChange("organizationPhone", true)}
                    onBlur={() => handleFocusChange("organizationPhone", false)}
                    required
                  />
                  <Label
                    htmlFor="organizationPhone"
                    className={`form-item-floating-label ${
                      focus.organizationPhone || organizationPhone
                        ? "form-item-floating-label-focused"
                        : ""
                    }`}
                  >
                    Organization Phone
                  </Label>
                </div>

                {/* Billing Address */}
                <div className="relative">
                  <Textarea
                    id="billingAddress"
                    value={billingAddress}
										placeholder={focus.billingAddress || billingAddress ? "" : "Billing Address"}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    onFocus={() => handleFocusChange("billingAddress", true)}
                    onBlur={() => handleFocusChange("billingAddress", false)}
                    required
                  />
                  <Label
                    htmlFor="billingAddress"
                    className={`form-item-floating-label ${
                      focus.billingAddress || billingAddress
                        ? "form-item-floating-label-focused"
                        : ""
                    }`}
                  >
                    Billing Address
                  </Label>
                </div>

                {/* Organization Description */}
                <div className="relative">
                  <Textarea
                    id="organizationDescription"
                    value={organizationDescription}
										placeholder={focus.organizationDescription || organizationDescription ? "" : "Organization Description"}
                    onChange={(e) => setOrganizationDescription(e.target.value)}
                    onFocus={() => handleFocusChange("organizationDescription", true)}
                    onBlur={() => handleFocusChange("organizationDescription", false)}
                    required
                  />
                  <Label
                    htmlFor="organizationDescription"
                    className={`form-item-floating-label ${
                      focus.organizationDescription || organizationDescription
                        ? "form-item-floating-label-focused"
                        : ""
                    }`}
                  >
                    Organization Description
                  </Label>
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
