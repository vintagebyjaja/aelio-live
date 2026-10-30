# AELIO v1.0.3 — resolve Cloudflare error10143 and connect the real Brain

The Cloudflare log for commit9262158 confirms that all70 changed static assets uploaded successfully. Publishing the Worker version then failed:

> Service binding 'AELIO_ENGINE' references Worker 'aelio-engine' which was not found. [code:10143]

The frontend deployment configuration declared a service that had not been created. v1.0.3 removes only this premature declaration from default `wrangler.jsonc`. It preserves the existing native `AELIO_STORAGE` binding, private bucket, assets, variables, cron and routing. The public site can deploy before the Brain exists. Existing API handlers report an unavailable/unconfigured engine; no substitute model or fake health status is introduced. Successful website deployment is not evidence that inference, Auth or database migration is operational.

## Website deployment

The user has authorized pushing this fix to main to trigger the existing Cloudflare integration. Existing committed public assets include the Dream Box; the current Cloudflare Build command of None was not this failure. Future frontend source changes still need `npm run build` before committing/updating those assets, or an owner-configured Cloudflare build command.

This fix does not create cloud resources, execute SQL, alter dashboard secrets or deploy the engine. The Cloudflare publishing result must be checked on the new build; the prior main version failed to publish.

## Connect the real private Brain afterward

1. Follow `config/SETUP.md`: stage/verify the existing shared Supabase migrations and identity mappings, preserve backups and existing users, and configure runtime credentials securely. Do not create another Supabase project or assume production SQL has already run.
2. Deploy the existing backend source in `cloudflare/aelio-engine-worker/` as the missing `aelio-engine` Worker using container-capable Cloudflare tooling and the existing `Dockerfile.engine`. The account must support the configured Containers/Durable Objects resources. Review its Wrangler configuration, required secrets and the local test evidence first. This is the existing AELIO engine and gateway, not a new basic chatbot. Docker/container deployment and real credentials are not available through this environment's GitHub-only access.
3. Set engine runtime credentials: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OPENAI_API_KEY`, `AELIO_PROXY_SECRET`, `AELIO_MESSAGING_SECRET`, plus securely verified existing-user role mappings as documented. Keep `workers_dev:false` and `preview_urls:false`; the engine authenticates private requests. Do not expose it publicly to bypass missing service bindings.
4. Confirm the Worker named `aelio-engine` exists in the same Cloudflare account. Then add this top-level entry to the existing root `wrangler.jsonc`, merging it with other service bindings if any:

```json
"services": [{"binding":"AELIO_ENGINE","service":"aelio-engine"}]
```

5. The frontend needs matching server-side proxy/messaging secrets, the existing service-role credential, session secret and public Supabase configuration. Use `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as Worker **runtime** variables. The screenshot's `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_ANON_KEY` build-variable names do not automatically populate those runtime names; AELIO is not Next.js. Build variables alone do not establish deployed Worker secrets. Never move the service-role key into client configuration.
6. Publish the binding change through the owner-approved Git/Cloudflare workflow. Test real sign-in, account/dashboard access, private file ownership and an actual streamed Brain response. A successful R2 upload or database connection alone does not verify the Brain. Do not mark backend deployment or migration complete until these are verified.

No external R2 Access Key ID, Secret Access Key or endpoint is needed. Use the existing native binding. No production database/secret changes were made by this patch.
