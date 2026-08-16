import { CURRENT_RELEASE_NOTES } from "@retentia/release-notes";
import type { ReleaseNotes } from "./release-notes/types";

export type { ReleaseNotes } from "./release-notes/types";

export const RELEASE_NOTES: readonly ReleaseNotes[] = CURRENT_RELEASE_NOTES;

export function getReleaseNotes(version: string | null | undefined): ReleaseNotes | undefined {
  return RELEASE_NOTES.find((release) => release.version === version);
}
