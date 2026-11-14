import { Navigate, Route, Routes } from "react-router-dom";
import TeacherLanding from "./TeacherLanding.jsx";
import TeacherLogin from "./TeacherLogin.jsx";
import TeacherLayout from "./TeacherLayout.jsx";
import TeacherDashboard from "./TeacherDashboard.jsx";
import TeacherStudents from "./TeacherStudents.jsx";
import TeacherStudent from "./TeacherStudent.jsx";
import TeacherLibrary from "./TeacherLibrary.jsx";
import TeacherMaterial from "./TeacherMaterial.jsx";
import TeacherCourses from "./TeacherCourses.jsx";
import TeacherCourse from "./TeacherCourse.jsx";
import TeacherExams from "./TeacherExams.jsx";
import TeacherExam from "./TeacherExam.jsx";
import TeacherProfile from "./TeacherProfile.jsx";
import "../../teacher.css";

// Everything under /teacher. App.jsx mounts this once (<Route path="/teacher/*" />), so the teacher pages
// never touch the public routes. /teacher and /teacher/login are public; the rest sits behind the layout's gate.
export default function TeacherArea() {
  return (
    <Routes>
      <Route index element={<TeacherLanding />} />
      <Route path="login" element={<TeacherLogin />} />
      <Route element={<TeacherLayout />}>
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="students/:id" element={<TeacherStudent />} />
        <Route path="library" element={<TeacherLibrary />} />
        <Route path="library/:id" element={<TeacherMaterial />} />
        <Route path="courses" element={<TeacherCourses />} />
        <Route path="courses/:id" element={<TeacherCourse />} />
        <Route path="exams" element={<TeacherExams />} />
        <Route path="exams/:id" element={<TeacherExam />} />
        <Route path="profile" element={<TeacherProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/teacher" replace />} />
    </Routes>
  );
}
