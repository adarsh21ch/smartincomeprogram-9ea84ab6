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
        borderBottom: "1px solid rgba(197,147,14,0.15)",
      }}
    >
      <div className="container flex items-center justify-between h-16">
        <Link to="/">
          <Logo />
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/auth">
            <button
              className="px-5 py-2 text-sm font-semibold rounded-lg transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #E8B830, #C99A18)",
                color: "#000",
                boxShadow: "0 0 16px rgba(232,184,48,0.3)",
              }}
            >
              Login
            </button>
          </Link>
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
            borderTop: "1px solid rgba(197,147,14,0.1)",
          }}
        >
          <Link to="/auth" onClick={() => setOpen(false)}>
            <button
              className="w-full py-2.5 text-sm font-semibold rounded-lg"
              style={{
                background: "linear-gradient(135deg, #E8B830, #C99A18)",
                color: "#000",
              }}
            >
              Login
            </button>
          </Link>
        </div>
      )}
    </nav>
  );
};
