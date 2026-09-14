// ⚠️ IMPORTANT SECURITY NOTE ⚠️
// This key is used directly from the browser, which means anyone who views
// this page's source code (or your browser's network tab) can see it and
// use your Gemini quota. This is fine for local testing or a private/internal
// site, but do NOT use this approach for a public production website.
// For a public site, move this key to a small backend server instead.

const GEMINI_API_KEY = "AQ.Ab8RN6Ij2vGTXxhaVuqRttGNPntVj9PmEeDJZjMBHzQKA_TeLA";

// Model to use. "gemini-2.0-flash" was retired by Google; "gemini-3.6-flash"
// is the current fast, free-tier-friendly model as of this key's testing.
const GEMINI_MODEL = "gemini-3.6-flash";
