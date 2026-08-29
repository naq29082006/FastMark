/**
 * Thay tên trường cũ → mới trong backend, src, web (không đụng node_modules).
 */
const fs = require("fs");
const path = require("path");
const { FIELD_RENAME_MAP } = require("../constants/modelFields");

const ROOT = path.join(__dirname, "..", "..");
const TARGET_DIRS = [
  path.join(ROOT, "backend"),
  path.join(ROOT, "src"),
  path.join(ROOT, "web", "src"),
];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);
const SKIP_FILES = new Set([
  path.normalize("backend/constants/modelFields.js"),
  path.normalize("backend/scripts/migrateModelFieldsVn.js"),
  path.normalize("backend/scripts/replaceModelFieldNames.js"),
]);

const EXT = new Set([".js", ".jsx", ".ts", ".tsx", ".md", ".dbml"]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (EXT.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function replaceInFile(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  if (SKIP_FILES.has(rel)) {
    return 0;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let changes = 0;

  for (const [oldName, newName] of FIELD_RENAME_MAP) {
    if (!content.includes(oldName)) {
      continue;
    }
    const next = content.split(oldName).join(newName);
    if (next !== content) {
      const count = (content.length - next.length + newName.length * (
        content.split(oldName).length - 1
      ));
      changes += content.split(oldName).length - 1;
      content = next;
    }
  }

  if (changes > 0) {
    fs.writeFileSync(filePath, content, "utf8");
  }
  return changes;
}

function main() {
  const files = TARGET_DIRS.flatMap((dir) => walk(dir));
  let total = 0;
  let fileCount = 0;

  for (const file of files) {
    const n = replaceInFile(file);
    if (n > 0) {
      fileCount += 1;
      total += n;
      console.log(`${path.relative(ROOT, file)} (${n})`);
    }
  }

  console.log(`\nUpdated ${fileCount} files, ${total} replacements.`);
}

main();
