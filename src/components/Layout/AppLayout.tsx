import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import RefreshButton from "../RefreshButton";
import BackButton from "../BackButton";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Show back button on all pages except home (/)
  const showBackButton = location.pathname !== '/';

  const handleSignOut = () => {
    logout();
    navigate("/login");
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleClickOutside = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="app-layout" onClick={handleClickOutside}>
      <div className="burger-menu-container">
        {showBackButton && <BackButton />}
        <RefreshButton />
        <button
          className="burger-button"
          onClick={(e) => {
            e.stopPropagation();
            toggleMenu();
          }}
          aria-label="Menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12H21M3 6H21M3 18H21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isMenuOpen && (
          <div className="burger-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="burger-user-info">
              <div className="burger-user-name">
                {user?.name}#{user?.tag}
              </div>
              <div className="burger-user-region">{user?.region}</div>
            </div>
            <div className="burger-divider"></div>
            <button className="burger-menu-item" onClick={handleSignOut}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 17L21 12L16 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 12H9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>

      <main className="app-content">{children}</main>
    </div>
  );
};

export default AppLayout;
