import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout.jsx";

export default function NotFound() {
  return (
    <AuthLayout title="Page not found" subtitle="That page does not exist.">
      <p><Link to="/">Go to the homepage</Link></p>
    </AuthLayout>
  );
}
