const { execSync } = require("child_process");

function runStep(name, command) {
  console.log("\n===============================");
  console.log(name);
  console.log("===============================");

  execSync(command, { stdio: "inherit" });
}

try {

  runStep(
    "1️⃣ Generating city input list",
    "node scripts/generate-city-input.js"
  );

  runStep(
    "2️⃣ Building entire site",
    "node scripts/build-site.js"
  );

  console.log("\n✅ FULL BUILD COMPLETE\n");

} catch (err) {

  console.error("\n❌ BUILD FAILED\n");
  console.error(err.message);
  process.exit(1);

}