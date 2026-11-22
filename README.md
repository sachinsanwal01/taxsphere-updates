# TaxSphere live updates

The TaxSphere app (Android and Windows) checks `version.json` here each time it opens with internet,
downloads only the changed files from `files/`, checks each one's SHA-256, and starts the new version.

Don't edit these files by hand. They are generated from the app's assets for each release.
