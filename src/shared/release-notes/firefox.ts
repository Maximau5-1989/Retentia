import type { ReleaseNotes } from "./types";

export const FIREFOX_RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: "2.2.2",
    date: "2026-08-16",
    title: "Cleaner dashboard header",
    changes: [
      "Removed the What's new link beside the version number in the desktop and compact dashboard headers.",
    ],
  },
  {
    version: "2.2.1",
    date: "2026-08-16",
    title: "Reliable scans and independent releases",
    changes: [
      "Made the local history classifier handle Firefox history items whose title is null.",
      "Added a Firefox-specific scan safety limit and visible feedback when a scan or category correction fails.",
      "Separated Firefox versioning and release notes from Chrome so Firefox updates no longer advance the Chrome release.",
      "Added Firefox-specific release commands and packages while retaining shared quality checks for both browser builds.",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-08-16",
    title: "Initial Firefox Desktop release",
    changes: [
      "Added a dedicated Firefox build with the same core retention, category, simulator, security, and privacy features.",
      "Used Firefox's supported background model, a stable add-on ID, and minimal permissions.",
      "Omitted the Chrome history-page shortcut because extensions cannot access Firefox's privileged History interface.",
    ],
  },
];

export const CURRENT_RELEASE_NOTES = FIREFOX_RELEASE_NOTES;
