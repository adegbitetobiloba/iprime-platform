import { Component, Suspense, lazy, useEffect } from "react";
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
import ExamCentre from "./pages/ExamCentre.jsx";
import ExamIntro from "./pages/ExamIntro.jsx";
import ExamRunner from "./pages/ExamRunner.jsx";
import NotFound from "./pages/NotFound.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import PendingApproval from "./pages/PendingApproval.jsx";
import AdminDenied from "./pages/admin/AdminDenied.jsx";
import ShareLanding from "./pages/ShareLanding.jsx";
import SebCheck from "./pages/SebCheck.jsx";
import Toast from "./components/Toast.jsx";
import WelcomeFlyer from "./components/WelcomeFlyer.jsx";
import { useAuth } from "./auth.jsx";

function lazyPage(load) {
  return lazy(async () => {
    try {
      const page = await load();
      try { sessionStorage.removeItem("iprime-chunk-reload"); } catch { /* storage unavailable */ }
      return page;
    } catch (err) {
      // After a new release the old file names are gone: reload once to pick up the new version.
      let first = false;
      try {
        first = !sessionStorage.getItem("iprime-chunk-reload");
        if (first) sessionStorage.setItem("iprime-chunk-reload", "1");
      } catch { /* ignore */ }
      if (first) { window.location.reload(); return new Promise(() => {}); }
      throw err;
    }
  });
}

class RouteBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <p className="page-note" role="alert">
        This page could not load. Check your connection, then{" "}
        <button type="button" onClick={() => window.location.reload()}>try again</button>.
      </p>
    );
  }
}

const Performance = lazyPage(() => import("./pages/Performance.jsx"));
const ProgressReport = lazyPage(() => import("./pages/ProgressReport.jsx"));
const Results = lazyPage(() => import("./pages/Results.jsx"));
const ResultDetail = lazyPage(() => import("./pages/ResultDetail.jsx"));
const Enrolment = lazyPage(() => import("./pages/Enrolment.jsx"));
const Messages = lazyPage(() => import("./pages/Messages.jsx"));
const Library = lazyPage(() => import("./pages/Library.jsx"));
const LibraryMaterials = lazyPage(() => import("./pages/LibraryMaterials.jsx"));
const LibraryMaterial = lazyPage(() => import("./pages/LibraryMaterial.jsx"));
const LibraryUtme = lazyPage(() => import("./pages/LibraryUtme.jsx"));
const LibraryShelf = lazyPage(() => import("./pages/LibraryShelf.jsx"));
const LibraryCourse = lazyPage(() => import("./pages/LibraryCourse.jsx"));
const LibraryLesson = lazyPage(() => import("./pages/LibraryLesson.jsx"));
const LibrarySaved = lazyPage(() => import("./pages/LibrarySaved.jsx"));
const AdminLayout = lazyPage(() => import("./pages/admin/AdminLayout.jsx"));
const AdminHome = lazyPage(() => import("./pages/admin/AdminHome.jsx"));
const AdminExams = lazyPage(() => import("./pages/admin/AdminExams.jsx"));
const AdminExamEdit = lazyPage(() => import("./pages/admin/AdminExamEdit.jsx"));
const AdminAttempts = lazyPage(() => import("./pages/admin/AdminAttempts.jsx"));
const AdminAttemptReview = lazyPage(() => import("./pages/admin/AdminAttemptReview.jsx"));
const AdminProgrammes = lazyPage(() => import("./pages/admin/AdminProgrammes.jsx"));
const AdminStudents = lazyPage(() => import("./pages/admin/AdminStudents.jsx"));
const AdminExamAnalytics = lazyPage(() => import("./pages/admin/AdminExamAnalytics.jsx"));
const AdminAnalytics = lazyPage(() => import("./pages/admin/AdminAnalytics.jsx"));
const AdminLibraryStudy = lazyPage(() => import("./pages/admin/AdminLibraryStudy.jsx"));
const AdminImport = lazyPage(() => import("./pages/admin/AdminImport.jsx"));
const AdminBank = lazyPage(() => import("./pages/admin/AdminBank.jsx"));
const AdminApplications = lazyPage(() => import("./pages/admin/AdminApplications.jsx"));
const AdminPeople = lazyPage(() => import("./pages/admin/AdminPeople.jsx"));
const AdminCheckin = lazyPage(() => import("./pages/admin/AdminCheckin.jsx"));
const AdminEnrolmentSettings = lazyPage(() => import("./pages/admin/AdminEnrolmentSettings.jsx"));
const AdminMessages = lazyPage(() => import("./pages/admin/AdminMessages.jsx"));
const AdminLibrary = lazyPage(() => import("./pages/admin/AdminLibrary.jsx"));
const AdminLibraryCourse = lazyPage(() => import("./pages/admin/AdminLibraryCourse.jsx"));
const AdminLibraryAnalytics = lazyPage(() => import("./pages/admin/AdminLibraryAnalytics.jsx"));
const AdminExamBuilder = lazyPage(() => import("./pages/admin/AdminExamBuilder.jsx"));

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
  "/performance/report": "Progress report | iPrime",
  "/results": "My results | iPrime",
  "/results/:id": "Result details | iPrime",
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
        <RouteBoundary resetKey={pathname}><Suspense fallback={<p className="page-note" role="status">Loading...</p>}><Routes>
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
          <Route path="/x/:token" element={<ShareLanding />} />
          <Route path="/seb-check" element={<SebCheck />} />
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
          <Route path="/performance/report" element={<Protected><ProgressReport /></Protected>} />
          <Route path="/results" element={<Protected><Results /></Protected>} />
          <Route path="/results/:id" element={<Protected><ResultDetail /></Protected>} />
          <Route path="/messages" element={<Protected><Messages /></Protected>} />
          <Route path="/enrolment" element={<Protected><Enrolment /></Protected>} />
          <Route path="/library" element={<Protected><Library /></Protected>} />
          <Route path="/library/utme" element={<Protected><LibraryUtme /></Protected>} />
          <Route path="/library/materials" element={<Protected><LibraryMaterials /></Protected>} />
          <Route path="/library/materials/:id" element={<Protected><LibraryMaterial /></Protected>} />
          <Route path="/library/shelf" element={<Protected><LibraryShelf /></Protected>} />
          <Route path="/library/saved" element={<Protected><LibrarySaved /></Protected>} />
          <Route path="/library/courses/:slug" element={<Protected><LibraryCourse /></Protected>} />
          <Route path="/library/lessons/:id" element={<Protected><LibraryLesson /></Protected>} />
          <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
            <Route index element={<AdminHome />} />
            <Route path="exams" element={<AdminExams />} />
            <Route path="exams/:id" element={<AdminExamEdit />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="analytics/library-study" element={<AdminLibraryStudy />} />
            <Route path="exams/:id/analytics" element={<AdminExamAnalytics />} />
            <Route path="exams/new" element={<AdminExamBuilder />} />
            <Route path="attempts" element={<AdminAttempts />} />
            <Route path="attempts/:id" element={<AdminAttemptReview />} />
            <Route path="import" element={<AdminImport />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="bank" element={<AdminBank />} />
            <Route path="programmes" element={<AdminProgrammes />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="people" element={<AdminPeople />} />
            <Route path="checkin" element={<AdminCheckin />} />
            <Route path="enrolment-settings" element={<AdminEnrolmentSettings />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="library" element={<AdminLibrary />} />
            <Route path="library/courses/:id" element={<AdminLibraryCourse />} />
            <Route path="library/analytics" element={<AdminLibraryAnalytics />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes></Suspense></RouteBoundary>
      </main>
      {!focusMode && <Footer />}
    </>
  );
}
