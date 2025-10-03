import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import RefreshButton from "../components/RefreshButton";

const REGIONS = [
  { code: "EUW", name: "EUW" },
  { code: "EUNE", name: "EUNE" },
  { code: "NA", name: "NA" },
  { code: "KR", name: "KR" },
  { code: "JP", name: "JP" },
  { code: "BR", name: "BR" },
  { code: "LAN", name: "LAN" },
  { code: "LAS", name: "LAS" },
  { code: "OCE", name: "OCE" },
  { code: "TR", name: "TR" },
  { code: "RU", name: "RU" },
];

const LoginPage: React.FC = () => {
  const [summoner, setSummoner] = useState("");
  const [tag, setTag] = useState("");
  const [region, setRegion] = useState("EUW");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorToast, setShowErrorToast] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const showError = (message: string) => {
    setError(message);
    setShowErrorToast(true);

    setTimeout(() => {
      setShowErrorToast(false);
      setTimeout(() => setError(null), 300);
    }, 5000);
  };

  const hideError = () => {
    setShowErrorToast(false);
    setTimeout(() => setError(null), 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowErrorToast(false);

    if (!summoner.trim() || !tag.trim()) {
      showError("Summoner name and tag are required");
      return;
    }

    setIsLoading(true);
    try {
      await login({
        name: summoner.trim(),
        tag: tag.trim(),
        region: region,
      });
      navigate("/");
    } catch (error: any) {
      console.error("Login failed:", error);
      const errorMessage =
        error?.message ||
        "Failed to find summoner. Please check your details and try again.";

      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        showError(
          "Summoner not found. Please check your summoner name and tag.",
        );
      } else if (
        errorMessage.includes("403") ||
        errorMessage.includes("Forbidden")
      ) {
        showError("API access denied. Please try again later.");
      } else if (
        errorMessage.includes("429") ||
        errorMessage.includes("rate limit")
      ) {
        showError("Too many requests. Please wait a moment and try again.");
      } else if (
        errorMessage.includes("500") ||
        errorMessage.includes("Internal Server Error")
      ) {
        showError("Server error. Please try again in a few minutes.");
      } else {
        showError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="login-card">
          <h1 className="login-title">Diana</h1>
          <p className="login-subtitle">League of Legends Stats Tracker</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-inputs">
              <div className="summoner-inputs">
                <input
                  type="text"
                  placeholder="Summoner Name"
                  value={summoner}
                  onChange={(e) => setSummoner(e.target.value)}
                  className="login-input login-input-left"
                  required
                />
                <input
                  type="text"
                  placeholder="#"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="login-input login-input-right"
                  required
                />
              </div>

              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="login-select"
              >
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? "Loading..." : "Select Player"}
            </button>
          </form>
        </div>
      </div>

      <div className="login-refresh">
        <RefreshButton />
      </div>

      {error && (
        <div className={`error-toast ${showErrorToast ? "show" : ""}`}>
          <div className="error-toast-content">
            <div className="error-toast-icon">⚠</div>
            <div className="error-toast-message">{error}</div>
            <button className="error-toast-close" onClick={hideError}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
