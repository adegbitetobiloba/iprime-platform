import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Programmes from "./pages/Programmes.jsx";
import Events from "./pages/Events.jsx";
import News from "./pages/News.jsx";
import Contact from "./pages/Contact.jsx";
import Faq from "./pages/Faq.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Verify from "./pages/Verify.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NotFound from "./pages/NotFound.jsx";
import { useAuth } from "./auth.jsx";

function Protected({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <p className="page-note" role="status">Loading your account...</p>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

// Each page starts at the top, and the browser tab title follows the page.
const TITLES = {
  "/": "iPrime | Prime Excelerate Tutelage",
  "/about": "About | iPrime",
  "/programmes": "Programmes | iPrime",
  "/events": "Events | iPrime",
  "/news": "News and announcements | iPrime",
  "/contact": "Contact | iPrime",
  "/faq": "FAQ | iPrime",
  "/login": "Log in | iPrime",
  "/register": "Create an account | iPrime",
  "/verify": "Verify your email | iPrime",
  "/dashboard": "Dashboard | iPrime",
};

function PageEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = TITLES[pathname] || "iPrime | Prime Excelerate Tutelage";
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PageEffects />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/programmes" element={<Programmes />} />
          <Route path="/events" element={<Events />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
