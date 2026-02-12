const fs = require("fs");

try {
  const content = fs.readFileSync(
    "d:\\xampp\\htdocs\\staging\\application\\views\\add_candidate.php",
    "utf16le",
  );

  // Find "manager" related code
  // Look for select with name="manager"
  const regex = /<select[^>]*name=["']manager["'][^>]*>[\s\S]*?<\/select>/i;
  const match = content.match(regex);

  if (match) {
    console.log("Found Manager Select content:");
    const cleanContent = match[0].replace(/\s+/g, " ").trim();
    console.log(cleanContent.substring(0, 1000)); // Print first 1000 chars
  } else {
    console.log("Manager select not found via regex.");
    // Try simple search
    const idx = content.toLowerCase().indexOf('name="manager"');
    if (idx !== -1) {
      console.log("Found name='manager' at index " + idx);
      // Print surrounding context
      console.log(content.substring(idx - 200, idx + 500));
    } else {
      console.log("String 'name=\"manager\"' not found.");
    }
  }

  // Also look for "Last served"
  const idx2 = content.indexOf("Last served");
  if (idx2 !== -1) {
    console.log("Found 'Last served':");
    console.log(content.substring(idx2 - 100, idx2 + 200));
  }
} catch (err) {
  console.error("Error reading file:", err.message);
}
