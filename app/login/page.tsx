"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  // WebAuthn Registration
  async function handleRegister() {
    setError("");
    const trimmed = username.trim();
    if (!trimmed) { setError("Please enter a username."); return; }

    setLoading(true);
    try {
      // Get registration options
      const optRes = await fetch("/api/auth/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        setError(data.error ?? "Failed to start registration");
        return;
      }
      const options = await optRes.json();

      // Start WebAuthn registration with browser
      const credential = await startRegistration({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch("/api/auth/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error ?? "Registration failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Registration was cancelled.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // WebAuthn Login
  async function handleWebAuthnLogin() {
    setError("");
    const trimmed = username.trim();
    if (!trimmed) { setError("Please enter a username."); return; }

    setLoading(true);
    try {
      // Get login options
      const optRes = await fetch("/api/auth/login-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!optRes.ok) {
        const data = await optRes.json();
        setError(data.error ?? "Failed to start login");
        return;
      }
      const options = await optRes.json();

      // Start WebAuthn authentication with browser
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const verifyRes = await fetch("/api/auth/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        setError(data.error ?? "Login failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Authentication was cancelled.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Simple username login (dev fallback)
  async function handleSimpleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = username.trim();
    if (!trimmed) { setError("Please enter a username."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            ✅ Todo App
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {mode === "login" ? "Sign in with your passkey" : "Register a new passkey"}
          </p>
        </div>

        <form onSubmit={handleSimpleLogin} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice"
              autoFocus
              autoComplete="username webauthn"
              maxLength={50}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {mode === "login" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleWebAuthnLogin}
                disabled={loading || !username.trim()}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                           text-white font-semibold rounded-lg transition-colors
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading ? "Authenticating…" : "🔐 Sign In with Passkey"}
              </button>
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="w-full py-2.5 px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600
                           text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
              >
                {loading ? "Signing in…" : "Quick Sign In (Dev)"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRegister}
              disabled={loading || !username.trim()}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400
                         text-white font-semibold rounded-lg transition-colors
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {loading ? "Registering…" : "🔐 Register Passkey"}
            </button>
          )}
        </form>

        <div className="mt-4 text-center">
          {mode === "login" ? (
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Don&apos;t have an account? Register
            </button>
          ) : (
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Already have an account? Sign In
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          All times use <strong>Singapore Standard Time (SGT, UTC+8)</strong>
        </p>
      </div>
    </div>
  );
}
