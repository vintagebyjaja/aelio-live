# SQL15 — complete runnable migration

This is the complete canonical SQL15 file, not a replacement function-body fragment. It contains 146 lines, starts with a comment followed by BEGIN; and ends with COMMIT;. Rechecked locally: all migrations apply twice and image accounting/access tests pass. No production SQL was executed by Codex.

1. Extract this ZIP and open RUN_FULL_SQL15.sql as plain text.
2. In Supabase SQL Editor, open a NEW query.
3. Select all of the file contents and copy them. In the editor, replace its contents with the entire file.
4. Leave no text selected in the editor, then click Run. Supabase can run only highlighted text when a selection exists.
5. Do not execute the IF statements or function bodies separately. Do not rerun earlier migrations for this syntax error.

The reported LINE 1 starting with IF is consistent with a selected/truncated function-body fragment rather than the complete migration. If running the whole file produces a different error, retain that complete error for diagnosis. Image pricing stays disabled unless separately approved/configured; this script does not activate provider keys or charge subscriptions.
