import { useState } from "react";
import { useAuth } from "../../auth.jsx";
import { downloadFile } from "../../lib/downloadFile.js";

// Download the results as a spreadsheet, or print / save the page as a PDF.
export default function ExportBar({ examId, disabled }) {
  const { token } = useAuth();
  const [state, setState] = useState({ busy: false, message: "", error: "" });

  const download = async () => {
    setState({ busy: true, message: "", error: "" });
    try {
      await downloadFile(`/admin/analytics/exams/${examId}/export.csv`, token, "results.csv");
      setState({ busy: false, message: "Download started. Open it in Excel or Google Sheets.", error: "" });
    } catch (e) {
      setState({ busy: false, message: "", error: e.message });
    }
  };

  return (
    <div className="aa-actions">
      <div className="aa-buttons">
        <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={disabled || state.busy} aria-busy={state.busy}>
          {state.busy ? "Preparing..." : "Download results (CSV)"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={disabled}>Print or save as PDF</button>
      </div>
      <p className="aa-status muted" role="status" aria-live="polite">
        {state.error ? <span className="aa-error">{state.error}</span> : state.message}
      </p>
    </div>
  );
}
