// Temporary Task 1 compatibility bridge. Task 2 moves remaining imports to
// indexedDbSnapshotStorage and removes this module.
export {
  clearPersistedCoordinatorState,
  createBrowserCoordinatorStorage,
  type BrowserCoordinatorStorage,
  type CoordinatorStorageFailureKind,
} from "./indexedDbSnapshotStorage";
