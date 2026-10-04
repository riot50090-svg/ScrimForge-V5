# ScrimForge V5 — Dynamic Direct/Last Chance Fix

This update fixes the Direct Finalists pool linkage in the qualification-pool → split → Last Chance workflow.

- Direct finalist count is taken from the admin setting; it is not hardcoded to 6.
- Remaining teams are calculated as qualification-pool size minus direct finalists.
- The Last Chance stage references the remaining pool separately from the Direct Finalists pool.
- Direct Finalists display now reads from the actual direct-finalist pool.
- Grand Final merge uses the actual direct-finalist pool.
- Stage deletion removes both the Last Chance pool and its linked Direct Finalists pool.
- UI notices no longer assume 30 → 6 → 24; they display the configured numbers dynamically.
