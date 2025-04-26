"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-octaview-secondary text-octaview-primary">
      {/* Navbar */}
      <nav className="bg-octaview-secondary py-4 px-8 flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-bold text-octaview-primary"
          style={{ color: "rgb(var(--octaview-primary))" }}
        >
          OctaVision
        </Link>
        <div className="flex items-center space-x-6">
        </div>
        <div>
          <Link
            href="/signin"
            className="mr-4 hover:text-octaview-accent"
            style={{ color: "rgb(var(--octaview-accent))" }}
          >
            Log in
          </Link>
          <Link href="/signup">
            <Button className="bg-octaview-primary text-octaview-secondary hover:bg-accent hover:text-octaview-primary">
              Sign up
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto py-24 px-8 flex items-center">
        <div className="w-1/2">
          <h1
            className="text-5xl font-bold mb-4"
            style={{ color: "rgb(var(--octaview-primary))" }}
          >
            Let your{" "}
            <span
              className="text-octaview-accent"
              style={{ color: "rgb(var(--octaview-accent))" }}
            >
              cameras
            </span>{" "}
            talk to you!
          </h1>
          <p
            className="text-lg mb-8"
            style={{ color: "rgb(var(--octaview-primary))" }}
          >
            Unleash the power of AI to get alerts on what you need! Build,
            customize, and deploy alerts for your cameras.
          </p>
        </div>
        <div className="w-1/2">
          <img
            src="https://images.unsplash.com/photo-1661961112951-f2bfd17053f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" // Replace with your actual image
            alt="AI Camera Analytics"
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

