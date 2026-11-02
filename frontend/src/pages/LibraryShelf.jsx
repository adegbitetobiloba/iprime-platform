import { useState } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../useFetch.js";
import EmptyState from "../components/EmptyState.jsx";
import { MaterialCard, SHELF_LABEL } from "../library/parts.jsx";
import "../library/library.css";

const EMPTY = { want: "Mark a material Want to read and it waits here.", reading: "Anything you open lands here, so you can pick up where you stopped.", done: "Materials you finish, or mark Finished, appear here." };

// A private shelf like a reading log: only the student sees it.
export default function LibraryShelf() {
  const [tab, setTab] = useState("reading");
  const { data, error, loading, reload } = useFetch(`/library/shelf?status=${tab}`);
  const counts = (data && data.counts) || {};
  return (
    <section className="section">
      <div className="container">
        <p className="lib-crumbs"><Link to="/library">Library</Link> › My shelf</p>
        <div className="page-bar"><div><h1>My shelf</h1><p className="muted" style={{ margin: 0 }}>Study materials you are reading. Only you can see this.</p></div><Link to="/library/materials" className="btn btn-secondary">Find materials</Link></div>
        <div className="lib-tabs" role="tablist" aria-label="Shelf">
          {Object.entries(SHELF_LABEL).map(([k, label]) => <button key={k} type="button" role="tab" className="lib-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}{counts[k] ? ` (${counts[k]})` : ""}</button>)}
        </div>
        {loading && !data && <div className="exam-card skeleton" aria-hidden="true" />}
        {error && <div className="alert alert-error" role="alert">{error} <button type="button" className="link-btn" onClick={reload}>Try again</button></div>}
        {data && data.materials.length === 0 && <EmptyState icon="test" title={`Nothing in "${SHELF_LABEL[tab]}" yet`}>{EMPTY[tab]}</EmptyState>}
        {data && data.materials.length > 0 && <ul className="lib-grid">{data.materials.map((m) => <MaterialCard key={m.id} m={m} />)}</ul>}
      </div>
    </section>
  );
}
