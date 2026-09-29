"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wrench, HardHat, CalendarCheck, LogIn, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/lib/session";

// Verified live, freely-licensed (public domain / CC BY-SA 4.0) photos from
// Wikimedia Commons — placeholders until Mauli Industries supplies their
// own photography. Credited in the footer per their licenses. Same set the
// Flutter public site uses (lib/screens/public/mauli_home_page.dart).
const HERO_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/f/f9/Flickr_-_Official_U.S._Navy_Imagery_-_Sailor_shapes_a_valve_in_the_USS_Abraham_Lincoln_machine_shop..jpg";
const REPAIR_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/c/c4/Welding_Robot.jpg";
const MODIFICATION_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/9/97/Tsugami_CNC_Lathe.jpg";

const SERVICES = [
  {
    icon: Wrench,
    title: "Modification",
    body: "Retrofits and upgrades to existing machinery — adapting equipment to new production needs without a full replacement.",
  },
  {
    icon: HardHat,
    title: "Repair",
    body: "Fast-response breakdown repair to get a stopped line moving again, from mechanical faults to electrical failures.",
  },
  {
    icon: CalendarCheck,
    title: "Maintenance",
    body: "Scheduled preventive maintenance plans that catch wear before it becomes downtime.",
  },
];

export default function RootPage() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "loggedIn") router.replace("/dashboard");
    else if (session.status === "mustChangePassword") router.replace("/change-password");
  }, [session.status, router]);

  // The public marketing page renders immediately, every time — it's the
  // front door, so it shouldn't wait on session resolution the way the
  // authenticated app does (see the (app) layout's own loading state). An
  // already-logged-in visitor sees it for an instant before the effect
  // above redirects them onward; that's a fine trade for every anonymous
  // visitor (the overwhelming majority hitting this route) getting content
  // immediately instead of a loading spinner.
  return <MauliHomePage />;
}

function MauliHomePage() {
  const aboutRef = useRef<HTMLDivElement>(null);
  const scrollToAbout = () => aboutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen">
      <NavBar onAboutClick={scrollToAbout} />
      <Hero />
      <ServicesSection />
      <AboutSection ref={aboutRef} />
      <Footer />
    </div>
  );
}

function NavBar({ onAboutClick }: { onAboutClick: () => void }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/80 md:px-12">
      <Factory className="h-7 w-7 text-primary" />
      <span className="text-lg font-bold">Mauli Industries</span>
      <div className="flex-1" />
      <nav className="hidden items-center gap-1 sm:flex">
        <Button variant="ghost" size="sm">
          Home
        </Button>
        <Button variant="ghost" size="sm" onClick={onAboutClick}>
          About Us
        </Button>
      </nav>
      <Button size="sm" render={<Link href="/login" />}>
        <LogIn className="h-4 w-4" />
        Login
      </Button>
    </header>
  );
}

function Hero() {
  return (
    <section className="w-full bg-gradient-to-br from-primary/10 to-background px-5 py-12 md:px-12 md:py-20">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row">
        <div className="animate-fade-in-up flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold tracking-tight text-balance md:text-5xl">Keeping your plant running.</h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground md:mx-0 md:text-lg">
            Mauli Industries provides on-site machine modification, repair, and preventive maintenance for local factories and plants —
            minimizing downtime and keeping production lines moving.
          </p>
          <Button size="lg" className="mt-6" render={<Link href="/login" />}>
            <LogIn className="h-4 w-4" />
            Team Login
          </Button>
        </div>
        <div className="animate-fade-in-up flex-1" style={{ animationDelay: "100ms" }}>
          <img
            src={HERO_IMAGE}
            alt="A technician shaping a valve in a machine shop"
            className="h-64 w-full rounded-2xl object-cover shadow-lg md:h-80"
          />
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section className="w-full px-5 py-14 md:px-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="animate-fade-in-up text-center text-2xl font-bold md:text-3xl">What we do</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <Card key={s.title} className="animate-fade-in-up border-none bg-muted/40" style={{ animationDelay: `${i * 120}ms` }}>
              <CardContent className="pt-6">
                <s.icon className="h-9 w-9 text-primary" />
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <img src={REPAIR_IMAGE} alt="An industrial welding robot" className="animate-fade-in-up mt-10 h-56 w-full rounded-2xl object-cover shadow-md md:h-64" />
      </div>
    </section>
  );
}

function AboutSection({ ref }: { ref: React.RefObject<HTMLDivElement | null> }) {
  return (
    <section ref={ref} className="w-full bg-muted/20 px-5 py-14 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 md:flex-row">
        <img
          src={MODIFICATION_IMAGE}
          alt="A CNC lathe machine"
          className="animate-fade-in-up h-64 w-full flex-1 rounded-2xl object-cover shadow-md md:h-72"
        />
        <div className="animate-fade-in-up flex-1" style={{ animationDelay: "100ms" }}>
          <h2 className="text-2xl font-bold md:text-3xl">About Us</h2>
          {/* Placeholder copy — swap for Mauli Industries' real history/mission once provided. */}
          <p className="mt-4 text-base text-muted-foreground">
            Mauli Industries is a service-based engineering company supporting local factories and plants with machine modification,
            repair, and maintenance. Our technicians work directly on-site, helping production teams keep their equipment running safely
            and efficiently for the long run.
          </p>
          <p className="mt-4 text-base text-muted-foreground">
            We partner with plant managers to plan maintenance around production schedules — not the other way around — so downtime stays
            a planned event, not an emergency.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="w-full bg-foreground px-6 py-6 text-center text-background">
      <p className="text-sm">© {new Date().getFullYear()} Mauli Industries. All rights reserved.</p>
      <p className="mx-auto mt-1 max-w-2xl text-xs text-background/70">
        Photos: U.S. Navy Imagery (public domain); &quot;Welding Robot&quot; and &quot;Tsugami CNC Lathe&quot;, Wikimedia Commons, CC
        BY-SA 4.0 — placeholders pending Mauli Industries&apos; own photography.
      </p>
    </footer>
  );
}
