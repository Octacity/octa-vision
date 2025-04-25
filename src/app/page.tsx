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
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome to{" "}
          <span className="text-accent">
            OctaVision
          </span>
        </h1>

        <p className="mt-3 text-xl text-gray-600">
          AI-Powered Camera Analytics
        </p>
        <p className="mt-3 text-xl text-gray-600">
          Let your cameras talk to you
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-around max-w-4xl sm:w-full">
          <Card className="w-96">
            <CardHeader>
              <CardTitle className="text-xl">Sign Up</CardTitle>
              <CardDescription>
                Create an account to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={() => router.push('/signup')}
                className="flex flex-col space-y-4"
              >
                <div>
                  Ready to get Started?
                </div>
                <Button type="submit">Sign Up</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="flex items-center justify-center w-full border-t">
      </footer>
    </div>
  );
};

export default LandingPage;
