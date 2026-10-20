
import { useState } from "react";
import { Recycle, Leaf, Eye, EyeOff } from "lucide-react";
import "./Auth.css";

export default function Auth({ onLogin }) {
    const [mode, setMode] = useState("login");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");

    async function submitForm(event) {
        event.preventDefault();
        setError("");

        if (mode === "signup") {
            if (password.length < 8) {
                setError("Password must contain at least 8 characters.");
                return;
            }

            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }

            if (!name.trim()) {
                setError("Please enter your name.");
                return;
            }
        }

        try {
            const endpoint =
                mode === "signup"
                    ? "http://localhost:5000/api/auth/signup"
                    : "http://localhost:5000/api/auth/login";

            const payload =
                mode === "signup"
                    ? { name: name.trim(), email: email.trim(), password }
                    : { email: email.trim(), password };

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || "Authentication failed.");
                return;
            }

            localStorage.setItem("ecoscan_token", data.token);

            onLogin(data.user);
        } catch (err) {
            console.error("Authentication error:", err);
            setError(
                "Cannot connect to the server. Make sure the backend is running."
            );
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="auth-brand-icon">
                    <Recycle size={32} />
                </div>

                <h1 className="auth-brand-title">
                    EcoScan <span>AI</span>
                </h1>
                <p className="auth-subtitle">Smart Waste Management</p>

                <h2>{mode === "login" ? "Welcome Back!" : "Create Your Account"}</h2>
                <p className="auth-description">
                    {mode === "login"
                        ? "Login to continue to your dashboard."
                        : "Join us to help build a cleaner environment."}
                </p>

                <div className="auth-tabs">
                    <button
                        type="button"
                        className={mode === "login" ? "selected" : ""}
                        onClick={() => {
                            setMode("login");
                            setError("");
                        }}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        className={mode === "signup" ? "selected" : ""}
                        onClick={() => {
                            setMode("signup");
                            setError("");
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={submitForm}>
                    {mode === "signup" && (
                        <div className="auth-field">
                            <label htmlFor="auth-name">Full Name</label>
                            <input
                                id="auth-name"
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <label htmlFor="auth-email">Email Address</label>
                        <input
                            id="auth-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="auth-password">Password</label>
                        <div className="auth-password-wrap">
                            <input
                                id="auth-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className="auth-eye"
                                aria-label="Show or hide password"
                                onClick={() => setShowPassword((visible) => !visible)}
                            >
                                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                            </button>
                        </div>
                    </div>

                    {mode === "signup" && (
                        <div className="auth-field">
                            <label htmlFor="auth-confirm">Confirm Password</label>
                            <input
                                id="auth-confirm"
                                type="password"
                                placeholder="Enter password again"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    {error && <p className="auth-error">{error}</p>}

                    <button className="auth-submit" type="submit">
                        {mode === "login" ? "Login to Dashboard" : "Create Account"}
                    </button>
                </form>

                <p className="auth-switch">
                    {mode === "login"
                        ? "New to EcoScan AI?"
                        : "Already have an account?"}{" "}
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === "login" ? "signup" : "login");
                            setError("");
                        }}
                    >
                        {mode === "login" ? "Sign up" : "Login"}
                    </button>
                </p>

                <div className="auth-footer">
                    <Leaf size={17} />
                    <span>Small actions. Greener future.</span>
                </div>
            </section>
        </main>
    );
}
