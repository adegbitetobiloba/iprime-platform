export default function FormStatus({ error, slow, notice }) {
  return (
    <>
      {notice && <p className="alert alert-info" role="status">{notice}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {slow && (
        <p className="alert alert-info" role="status">
          Still working. The server may be waking up after being idle, which can take up to a minute. Please wait.
        </p>
      )}
    </>
  );
}
