import React from "react";
import { useNavigate } from "react-router-dom";

const BackButton: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <button
      onClick={handleBack}
      className="back-button"
      title="Go Back"
      aria-label="Go Back"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="back-icon"
      >
        <path d="m12 19-7-7 7-7"></path>
        <path d="m19 12H5"></path>
      </svg>
    </button>
  );
};

export default BackButton;
