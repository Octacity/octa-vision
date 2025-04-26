"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-octaview-secondary text-octaview-primary">
      {/* Navbar */}
      <nav className="bg-octaview-secondary py-4 px-8 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          OctaVision
        </Link>
        <div className="flex items-center space-x-6">
          <Link href="#" className="hover:text-octaview-accent">
            Home
          </Link>
          <Link href="#" className="hover:text-octaview-accent">
            Features
          </Link>
          <Link href="#" className="hover:text-octaview-accent">
            Pricing
          </Link>
          <Link href="#" className="hover:text-octaview-accent">
            Integrations
          </Link>
          <Link href="#" className="hover:text-octaview-accent">
            About Us
          </Link>
        </div>
        <div>
          <Link href="/signin" className="mr-4 hover:text-octaview-accent">
            Log in
          </Link>
          <Link href="/signup">
            <Button className="bg-octaview-primary text-octaview-secondary hover:bg-gray-800">
              Sign up
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto py-24 px-8 flex items-center">
        <div className="w-1/2">
          <h1 className="text-5xl font-bold mb-4">
            Let your <span className="text-octaview-accent">cameras</span> talk to you!
          </h1>
          <p className="text-lg mb-8">
            Unleash the power of AI to get alerts on what you need! Build,
            customize, and deploy alerts for your security cameras.
          </p>
          <div className="flex items-center">
            <Input
              type="email"
              placeholder="Enter your email"
              className="mr-4"
            />
            <Button className="bg-octaview-accent text-octaview-secondary hover:bg-teal-700">
              Get Started
            </Button>
          </div>
        </div>
        <div className="w-1/2">
          <img
            src="https://picsum.photos/600/400" // Replace with your actual image
            alt="AI Camera Analytics"
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
