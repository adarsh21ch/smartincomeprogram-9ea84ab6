// Loads Razorpay checkout.js once. Returns the global on resolve.
declare global {
  interface Window {
    Razorpay?: any;
  }
}

let loadingPromise: Promise<any> | null = null;

export function loadRazorpay(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay failed to initialize"));
    };
    s.onerror = () => {
      loadingPromise = null;
      reject(new Error("Failed to load Razorpay"));
    };
    document.body.appendChild(s);
  });
  return loadingPromise;
}
