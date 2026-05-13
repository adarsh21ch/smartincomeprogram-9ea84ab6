import { useEffect, useRef, useState } from "react";

interface Props {
  value: string; // YYYY-MM-DD or ""
  onChange: (val: string) => void;
  required?: boolean;
  hasError?: boolean;
  size?: "md" | "lg"; // input height
}

const isValidDate = (d: number, m: number, y: number) => {
  if (!d || !m || !y) return false;
  if (y < 1900 || y > new Date().getFullYear()) return false;
  if (m < 1 || m > 12) return false;
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d &&
    dt.getTime() <= Date.now()
  );
};

const pad = (n: string, len: number) => n.padStart(len, "0");

export const DateOfBirthInput = ({ value, onChange, required, hasError, size = "md" }: Props) => {
  // Parse incoming YYYY-MM-DD into parts
  const parseValue = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    if (!m) return { d: "", mo: "", y: "" };
    return { d: m[3], mo: m[2], y: m[1] };
  };

  const [parts, setParts] = useState(parseValue(value));
  const dRef = useRef<HTMLInputElement>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const yRef = useRef<HTMLInputElement>(null);

  // Sync external value -> parts only when external value changes meaningfully
  useEffect(() => {
    const next = parseValue(value);
    if (next.d !== parts.d || next.mo !== parts.mo || next.y !== parts.y) {
      setParts(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Per-field inline validation (only flag once user has entered something)
  const dn = parts.d ? parseInt(parts.d, 10) : NaN;
  const mn = parts.mo ? parseInt(parts.mo, 10) : NaN;
  const yn = parts.y ? parseInt(parts.y, 10) : NaN;
  const currentYear = new Date().getFullYear();

  const dayInvalid = parts.d.length > 0 && (isNaN(dn) || dn < 1 || dn > 31);
  const monthInvalid = parts.mo.length > 0 && (isNaN(mn) || mn < 1 || mn > 12);
  const yearInvalid =
    parts.y.length === 4 && (isNaN(yn) || yn < 1900 || yn > currentYear);

  // Real-calendar check (e.g. Feb 30) once all 3 fields complete
  const allComplete = parts.d.length === 2 && parts.mo.length === 2 && parts.y.length === 4;
  const calendarInvalid =
    allComplete && !dayInvalid && !monthInvalid && !yearInvalid && !isValidDate(dn, mn, yn);

  let errorMsg: string | null = null;
  if (dayInvalid) errorMsg = "Please enter a valid day (1–31).";
  else if (monthInvalid) errorMsg = "Please enter a valid month (1–12).";
  else if (yearInvalid) errorMsg = `Please enter a valid year (1900–${currentYear}).`;
  else if (calendarInvalid) errorMsg = "This date doesn't exist. Please check.";

  // Emit combined value when complete & valid; clear when incomplete
  const emit = (next: { d: string; mo: string; y: string }) => {
    const dnL = parseInt(next.d, 10);
    const mnL = parseInt(next.mo, 10);
    const ynL = parseInt(next.y, 10);
    if (next.d.length === 2 && next.mo.length === 2 && next.y.length === 4 && isValidDate(dnL, mnL, ynL)) {
      onChange(`${pad(next.y, 4)}-${pad(next.mo, 2)}-${pad(next.d, 2)}`);
    } else {
      // Clear external value while incomplete or invalid so consumers don't act on bad dates
      if (value) onChange("");
    }
  };

  const handleChange = (key: "d" | "mo" | "y", raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    const max = key === "y" ? 4 : 2;
    const trimmed = cleaned.slice(0, max);

    const next = { ...parts, [key]: trimmed };
    setParts(next);
    emit(next);

    // Auto-advance focus when a field is filled AND its value is in valid range
    if (trimmed.length === max) {
      const num = parseInt(trimmed, 10);
      const inRange =
        key === "d" ? num >= 1 && num <= 31 :
        key === "mo" ? num >= 1 && num <= 12 :
        num >= 1900 && num <= currentYear;
      if (inRange) {
        if (key === "d") mRef.current?.focus();
        else if (key === "mo") yRef.current?.focus();
      }
    }
  };

  const handleBlur = (key: "d" | "mo") => {
    const val = parts[key];
    if (val.length === 1) {
      const padded = `0${val}`;
      const next = { ...parts, [key]: padded };
      setParts(next);
      emit(next);
    }
  };

  const handleKeyDown = (key: "d" | "mo" | "y", e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && (e.target as HTMLInputElement).value === "") {
      if (key === "mo") dRef.current?.focus();
      else if (key === "y") mRef.current?.focus();
    }
  };

  const heightCls = size === "lg" ? "h-12" : "h-10";
  const showError = hasError || !!errorMsg;
  const borderBase = showError ? "border-red-500" : "border-[rgba(197,147,14,0.2)]";
  const baseCls = `bg-[#181818] text-white placeholder:text-[#555] text-center ${heightCls} border rounded-md focus:outline-none focus:ring-2 focus:ring-[#E8B830]/40 focus:border-[#E8B830]/60 transition`;

  const dayBorder = dayInvalid || calendarInvalid ? "border-red-500" : borderBase;
  const monthBorder = monthInvalid || calendarInvalid ? "border-red-500" : borderBase;
  const yearBorder = yearInvalid || calendarInvalid ? "border-red-500" : borderBase;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 w-full">
        <input
          ref={dRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="bday-day"
          placeholder="DD"
          aria-label="Day"
          aria-invalid={dayInvalid || calendarInvalid}
          maxLength={2}
          value={parts.d}
          onChange={(e) => handleChange("d", e.target.value)}
          onKeyDown={(e) => handleKeyDown("d", e)}
          required={required}
          className={`${baseCls} ${dayBorder} flex-1 min-w-0`}
        />
        <span className="text-white/40 select-none">/</span>
        <input
          ref={mRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="bday-month"
          placeholder="MM"
          aria-label="Month"
          aria-invalid={monthInvalid || calendarInvalid}
          maxLength={2}
          value={parts.mo}
          onChange={(e) => handleChange("mo", e.target.value)}
          onKeyDown={(e) => handleKeyDown("mo", e)}
          required={required}
          className={`${baseCls} ${monthBorder} flex-1 min-w-0`}
        />
        <span className="text-white/40 select-none">/</span>
        <input
          ref={yRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="bday-year"
          placeholder="YYYY"
          aria-label="Year"
          aria-invalid={yearInvalid || calendarInvalid}
          maxLength={4}
          value={parts.y}
          onChange={(e) => handleChange("y", e.target.value)}
          onKeyDown={(e) => handleKeyDown("y", e)}
          required={required}
          className={`${baseCls} ${yearBorder} flex-[1.4] min-w-0`}
        />
      </div>
      {errorMsg && (
        <p className="mt-1.5 text-xs text-red-400" role="alert">{errorMsg}</p>
      )}
    </div>
  );
};
