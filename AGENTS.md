<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Signed-in pages live under src/routes/_authenticated/ (client-only gate); they read data with the browser client so database access rules enforce business membership.
- Drawing uploads and PDF inspection use authenticated server functions with the user-scoped client and existing private documents bucket/records; this preserves organization policies without privileged access or new schema.
- Deterministic PDF inspection lives in a server-only unpdf helper; versioned evidence, checksums and attempt history live in document JSON fields, separate from verified measurements.
- Project form inserts use a validated schema transform to map organization IDs and numeric amounts to database fields; this prevents excess fields and string amounts in writes.
