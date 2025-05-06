'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import bannerImage from '@/assets/banner.jpg';

const LandingPage = () => {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If user is logged in, redirect to dashboard
        router.push('/dashboard');
      }
      // If no user, they stay on the landing page
    });
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-octaview-secondary text-octaview-primary">
      {/* Navbar */}
      <nav className="bg-octaview-secondary py-4 px-8 flex items-center justify-between shadow-md">
        <Link
          href="/"
          className="text-2xl font-bold"
          style={{ color: 'rgb(var(--octaview-primary))' }}
        >
          OctaVision
        </Link>
        <div className="flex items-center space-x-6">
          <Link href="/signin">
            <Button variant="ghost" className="hover:bg-primary/10">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Sign Up
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto py-24 px-8 flex flex-col md:flex-row items-center">
        <div className="md:w-1/2 text-center md:text-left mb-12 md:mb-0">
          <h1
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{ color: 'rgb(var(--octaview-primary))' }}
          >
            Let Your{' '}
            <span style={{ color: 'rgb(var(--octaview-accent))' }}>
              Cameras
            </span>{' '}
            Talk to You!
          </h1>
          <p
            className="text-lg md:text-xl mb-8"
            style={{ color: 'rgb(var(--octaview-primary))' }}
          >
            Unleash the power of AI to get alerts on what you need! Build,
            customize, and deploy intelligent alerts for your existing cameras.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              Get Started Free
            </Button>
          </Link>
        </div>
        <div className="md:w-1/2 flex justify-center">
          <Image
            src={bannerImage}
            alt="AI Camera Analytics"
            className="rounded-lg shadow-2xl w-full max-w-md md:max-w-lg"
            priority
            data-ai-hint="surveillance system"
          />
        </div>
      </div>

      {/* Features Section (Optional) */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-8 text-center">
          <h2 className="text-3xl font-bold mb-12" style={{ color: "rgb(var(--octaview-primary))" }}>
            Why OctaVision?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-lg shadow-lg bg-card">
              <h3 className="text-xl font-semibold mb-3" style={{ color: "rgb(var(--octaview-accent))" }}>Intelligent Alerts</h3>
              <p className="text-muted-foreground">Receive real-time notifications for specific events and objects you define.</p>
            </div>
            <div className="p-6 rounded-lg shadow-lg bg-card">
              <h3 className="text-xl font-semibold mb-3" style={{ color: "rgb(var(--octaview-accent))" }}>Easy Integration</h3>
              <p className="text-muted-foreground">Connect your existing camera infrastructure seamlessly.</p>
            </div>
            <div className="p-6 rounded-lg shadow-lg bg-card">
              <h3 className="text-xl font-semibold mb-3" style={{ color: "rgb(var(--octaview-accent))" }}>Customizable AI</h3>
              <p className="text-muted-foreground">Tailor the AI to detect exactly what matters to your enterprise.</p>
            </div>
          </div>
        </div>
      </section>

       {/* Footer */}
      <footer className="py-8 text-center border-t border-border">
        <p className="text-muted-foreground">&copy; {new Date().getFullYear()} OctaVision. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
