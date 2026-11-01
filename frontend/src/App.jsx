import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Programmes from "./pages/Programmes.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import Achievements from "./pages/Achievements.jsx";
import IPrime from "./pages/IPrime.jsx";
import Events from "./pages/Events.jsx";
import News from "./pages/News.jsx";
import Contact from "./pages/Contact.jsx";
import Faq from "./pages/Faq.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Verify from "./pages/Verify.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import Performance from "./pages/Performance.jsx";
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
import AdminExamAnalytics from "./pages/admin/AdminExamAnalytics.jsx";
import AdminImport from "./pages/admin/AdminImport.jsx";
import AdminBank from "./pages/admin/AdminBank.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import NotFound from "./pages/NotFound.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import PendingApproval from "./pages/PendingApproval.jsx";
import AdminDenied from "./pages/admin/AdminDenied.jsx";
import Library from "./pages/Library.jsx";
import LibraryCourse from "./pages/LibraryCourse.jsx";
import LibraryLesson from "./pages/LibraryLesson.jsx";
import LibrarySaved from "./pages/LibrarySaved.jsx";
import AdminLibrary from "./pages/admin/AdminLibrary.jsx";
import AdminLibraryCourse from "./pages/admin/AdminLibraryCourse.jsx";
import AdminLibraryAnalytics from "./pages/admin/AdminLibraryAnalytics.jsx";
import AdminExamBuilder from "./pages/admin/AdminExamBuilder.jsx";
import Toast from "./components/Toast.jsx";
import WelcomeFlyer from "./components/WelcomeFlyer.jsx";
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

// Students (and administrators previewing the student view) get the learning dashboard; every other role keeps the
// existing account page. The server still checks the role on every API call.
function DashboardHome() {
  const { user } = useAuth();
  return user?.role === "student" || user?.role === "admin" ? <StudentDashboard /> : <Dashboard />;
}

const TITLES = {
  "/": "iPrime | Prime Excelerate Tutelage",
  "/about": "About | iPrime",
  "/programmes": "Programmes | iPrime",
  "/how-it-works": "How it works | iPrime",
  "/achievements": "Achievements | iPrime",
  "/iprime": "iPrime platform | Prime Excelerate Tutelage",
  "/events": "Events | iPrime",
  "/news": "News and announcements | iPrime",
  "/contact": "Contact | iPrime",
  "/faq": "FAQ | iPrime",
  "/login": "Log in | iPrime",
  "/register": "Create an account | iPrime",
  "/verify": "Verify your email | iPrime",
  "/onboarding": "Welcome | iPrime",
  "/pending-approval": "Waiting for approval | iPrime",
  "/dashboard": "Dashboard | iPrime",
  "/account": "My profile | iPrime",
  "/exams": "Examination centre | iPrime",
  "/performance": "Performance | iPrime",
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
      <WelcomeFlyer />
      {!focusMode && <Header />}
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/programmes" element={<Programmes />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/iprime" element={<IPrime />} />
          <Route path="/events" element={<Events />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/dashboard" element={<Protected><DashboardHome /></Protected>} />
          <Route path="/account" element={<Protected><Dashboard /></Protected>} />
          <Route path="/exams" element={<Protected><ExamCentre /></Protected>} />
          <Route path="/exams/:id" element={<Protected><ExamIntro /></Protected>} />
          <Route path="/attempts/:id" element={<Protected><ExamRunner /></Protected>} />
          <Route path="/performance" element={<Protected><Performance /></Protected>} />
          <Route path="/results" element={<Protected><Results /></Protected>} />
          <Route path="/results/:id" element={<Protected><ResultDetail /></Protected>} />
          <Route path="/library" element={<Protected><Library /></Protected>} />
          <Route path="/library/saved" element={<Protected><LibrarySaved /></Protected>} />
          <Route path="/library/courses/:slug" element={<Protected><LibraryCourse /></Protected>} />
          <Route path="/library/lessons/:id" element={<Protected><LibraryLesson /></Protected>} />
          <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
            <Route index element={<AdminHome />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="exams/:id" element={<AdminExamEdit />} />
            <Route path="exams/:id/analytics" element={<AdminExamAnalytics />} />
            <Route path="exams/new" element={<AdminExamBuilder />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="bank" element={<AdminBank />} />
            <Route path="programmes" element={<AdminProgrammes />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="library" element={<AdminLibrary />} />
            <Route path="library/courses/:id" element={<AdminLibraryCourse />} />
            <Route path="library/analytics" element={<AdminLibraryAnalytics />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!focusMode && <Footer />}
    </>
  );
}
