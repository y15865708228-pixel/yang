import { readFileSync, writeFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));

const [,, increment] = process.argv;
let [major, minor, patch] = manifest.version.split(".").map(Number);

if (increment === "major") major++;
else if (increment === "minor") minor++;
else patch++;

const newVersion = `${major}.${minor}.${patch}`;
manifest.version = newVersion;
versions[newVersion] = manifest.minAppVersion;

writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Version bumped to ${newVersion}`);
