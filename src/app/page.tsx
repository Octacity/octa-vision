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
            src="https://raw.githubusercontent.com/git-yusuf-ilhan/nextjs/09808a1fd58113855dff827ca4d2dd6239114bc9/image.png" // Replace with your actual image
            alt="AI Camera Analytics"
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
