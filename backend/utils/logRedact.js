// Makes a request URL safe to write to the logs. Two things must never reach them:
//  - the secret part of an exam share link (/api/share/<token>...), which works like a password
//  - query strings, which carry search terms (student names or emails) on admin pages
const SHARE_TOKEN = /^(\/api\/share\/)(?!seb-check(?:\/|$)|exams\/)[^/]+/;

function safeLogPath(url) {
  const path = String(url || "").split("?")[0].split("#")[0];
  return path.replace(SHARE_TOKEN, "$1:token");
}

module.exports = { safeLogPath };
