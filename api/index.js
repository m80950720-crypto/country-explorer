// Vercel serverless entry point.
// Reuses the exact same Express app as server.js, so local dev and
// production behave identically.
module.exports = require("../lib/app");
