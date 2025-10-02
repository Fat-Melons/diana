import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import MatchPage from "./pages/MatchPage";
import "./App.css";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
      </Routes>
    </Router>
  );
}
