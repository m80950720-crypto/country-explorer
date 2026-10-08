const app = require("./lib/app");

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Country Explorer running -> http://localhost:${PORT}\n`);
  });
}

module.exports = app;
