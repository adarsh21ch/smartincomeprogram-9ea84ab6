import { Link } from "react-router-dom";
import { Logo } from "@/components/landing/Logo";
import { Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

export const SipNavbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(5,5,5,0.98)" : "rgba(5,5,5,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(212,160,23,0.15)",
      }}
    >
      <div className="container flex items-center justify-between h-16">
        <Link to="/">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/auth">
            <button className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors">
              Login
            </button>
          </Link>
          <a href="https://smartincomeprogram.in/l/smart-income-program">
            <button
              className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #D4A017, #A07810)",
                color: "#000",
              }}
            >
              Join Program →
            </button>
          </a>
        </div>

        <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div
          className="md:hidden p-4 flex flex-col gap-3"
          style={{
            background: "rgba(5,5,5,0.98)",
            borderTop: "1px solid rgba(212,160,23,0.1)",
          }}
        >
          <Link to="/auth" onClick={() => setOpen(false)}>
            <button className="w-full py-2.5 text-sm text-white/80 border border-white/10 rounded-lg">
              Login
            </button>
          </Link>
          <a href="https://smartincomeprogram.in/l/smart-income-program" onClick={() => setOpen(false)}>
            <button
              className="w-full py-2.5 text-sm font-semibold rounded-lg"
              style={{ background: "linear-gradient(135deg, #D4A017, #A07810)", color: "#000" }}
            >
              Join Program →
            </button>
          </a>
        </div>
      )}
    </nav>
  );
};
