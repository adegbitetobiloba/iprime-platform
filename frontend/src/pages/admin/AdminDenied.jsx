import { Link } from "react-router-dom";
import { useFetch } from "../../useFetch.js";
import { TYPE_LABEL } from "../../accountTypes.js";
import EmptyState from "../../components/EmptyState.jsx";

// What a signed-in person who is not an administrator sees at /admin. It explains the situation in plain words.
// The server is what actually keeps them out; this page only helps a legitimate owner work out what is missing.
export default function AdminDenied() {
  const { data, loading } = useFetch("/auth/admin-status");
  return (
    <section className="section">
      <div className="container narrow-wide">
        <EmptyState icon="shield" title="Administrator access is needed here"
          action={<Link to="/dashboard" className="btn btn-primary">Back to my dashboard</Link>}>
          This area is only for administrators of Prime Excelerate Tutelage. Your account is a <strong>{TYPE_LABEL[data?.role] || "regular"}</strong> account.
        </EmptyState>
        {!loading && data && (
          <div className="panel" style={{ marginTop: "var(--s5)" }}>
            <h2 className="panel-title">Are you the site owner?</h2>
            <ul className="plain-list">
              <li>Your email is {data.emailVerified ? "verified" : <strong>not verified yet (check the code email first)</strong>}.</li>
              <li>The server's administrator list is {data.adminListConfigured ? "set up" : <strong>empty or not set up</strong>}.</li>
              <li>Your email address is {data.emailOnAdminList ? "on that list. Log out and log in again to refresh your access." : <strong>not on that list.</strong>}</li>
            </ul>
            {!data.emailOnAdminList && <p className="note">To become an administrator, add your email address to <code>ADMIN_EMAILS</code> in the iprime-api settings on Render (see the setup notes), then log out and log in again.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
