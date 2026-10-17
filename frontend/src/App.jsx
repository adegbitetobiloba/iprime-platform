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
import ExamCentre from "./pages/ExamCentre.jsx";
import ExamIntro from "./pages/ExamIntro.jsx";
import ExamRunner from "./pages/ExamRunner.jsx";
import Results from "./pages/Results.jsx";
import ResultDetail from "./pages/ResultDetail.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminHome from "./pages/admin/AdminHome.jsx";
import AdminExams from "./pages/admin/AdminExams.jsx";
import AdminExamEdit from "./pages/admin/AdminExamEdit.jsx";
import AdminProgrammes from "./pages/admin/AdminProgrammes.jsx";
import AdminStudents from "./pages/admin/AdminStudents.jsx";
import NotFound from "./pages/NotFound.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import AdminDenied from "./pages/admin/AdminDenied.jsx";
import Toast from "./components/Toast.jsx";
import { useAuth } from "./auth.jsx";

function Protected({ children }) {
  const { token, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <p className="page-note" role="status">Loading your account...</p>;
  if (!token) return <Navigate to="/login" replace state={{ from: pathname }} />; // after logging in they come back here
  return children;
}

// Frontend convenience only: hides admin pages from non-admins. The server enforces the real check on every request.
function AdminOnly({ children }) {
  const { token, user, loading } = useAuth();
  if (loading || (token && !user)) return <p className="page-note" role="status">Loading your account...</p>;
  if (!token) return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  if (user.role !== "admin") return <AdminDenied />;
  return children;
}

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
  "/onboarding": "Welcome | iPrime",
  "/dashboard": "Dashboard | iPrime",
  "/exams": "Examination centre | iPrime",
  "/results": "My results | iPrime",
};

function PageEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const base = pathname.startsWith("/admin") ? "Administration | iPrime" : pathname.startsWith("/attempts/") ? "Examination | iPrime" : null;
    document.title = base || TITLES[pathname] || "iPrime | Prime Excelerate Tutelage";
  }, [pathname]);
  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const focusMode = pathname.startsWith("/attempts/"); // during an examination: no site header or footer, nothing to distract

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PageEffects />
      <Toast />
      {!focusMode && <Header />}
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
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/exams" element={<Protected><ExamCentre /></Protected>} />
          <Route path="/exams/:id" element={<Protected><ExamIntro /></Protected>} />
          <Route path="/attempts/:id" element={<Protected><ExamRunner /></Protected>} />
          <Route path="/results" element={<Protected><Results /></Protected>} />
          <Route path="/results/:id" element={<Protected><ResultDetail /></Protected>} />
          <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
            <Route index element={<AdminHome />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="exams/:id" element={<AdminExamEdit />} />
            <Route path="programmes" element={<AdminProgrammes />} />
            <Route path="students" element={<AdminStudents />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!focusMode && <Footer />}
    </>
  );
}
