# Packs

`ts-packwerk docs --out` writes this page from every `pack.yml`, and `ts-packwerk docs --check` fails when it is stale.

```mermaid
flowchart TD
  subgraph p_layer_app["app"]
    p_apps_api_src["apps/api/src"]
  end
  subgraph p_layer_feature["feature"]
    p_apps_api_src_account["apps/api/src/account"]
    p_apps_api_src_chat["apps/api/src/chat"]
    p_apps_api_src_coach["apps/api/src/coach"]
    p_apps_api_src_connections["apps/api/src/connections"]
    p_apps_api_src_inbox["apps/api/src/inbox"]
    p_apps_api_src_job["apps/api/src/job"]
    p_apps_api_src_paper["apps/api/src/paper"]
  end
  subgraph p_layer_kernel["kernel"]
    p_apps_api_src_registry["apps/api/src/registry"]
  end
  subgraph p_layer_platform["platform"]
    p_apps_api_src_db["apps/api/src/db"]
    p_apps_api_src_limits["apps/api/src/limits"]
    p_apps_api_src_mail["apps/api/src/mail"]
  end
  p_apps_api_src --> p_apps_api_src_account
  p_apps_api_src --> p_apps_api_src_chat
  p_apps_api_src --> p_apps_api_src_coach
  p_apps_api_src --> p_apps_api_src_connections
  p_apps_api_src --> p_apps_api_src_inbox
  p_apps_api_src --> p_apps_api_src_job
  p_apps_api_src --> p_apps_api_src_paper
  p_apps_api_src --> p_apps_api_src_registry
  p_apps_api_src --> p_apps_api_src_db
  p_apps_api_src --> p_apps_api_src_mail
  p_apps_api_src --> p_apps_api_src_limits
  p_apps_api_src_account --> p_apps_api_src_chat
  p_apps_api_src_account --> p_apps_api_src_paper
  p_apps_api_src_account --> p_apps_api_src_connections
  p_apps_api_src_account --> p_apps_api_src_registry
  p_apps_api_src_account --> p_apps_api_src_db
  p_apps_api_src_account --> p_apps_api_src_limits
  p_apps_api_src_account --> p_apps_api_src_mail
  p_apps_api_src_chat --> p_apps_api_src_job
  p_apps_api_src_chat --> p_apps_api_src_registry
  p_apps_api_src_chat --> p_apps_api_src_db
  p_apps_api_src_chat --> p_apps_api_src_limits
  p_apps_api_src_coach --> p_apps_api_src_chat
  p_apps_api_src_coach --> p_apps_api_src_account
  p_apps_api_src_coach --> p_apps_api_src_registry
  p_apps_api_src_coach --> p_apps_api_src_db
  p_apps_api_src_coach --> p_apps_api_src_limits
  p_apps_api_src_connections --> p_apps_api_src_registry
  p_apps_api_src_connections --> p_apps_api_src_db
  p_apps_api_src_connections --> p_apps_api_src_limits
  p_apps_api_src_inbox --> p_apps_api_src_account
  p_apps_api_src_inbox --> p_apps_api_src_coach
  p_apps_api_src_inbox --> p_apps_api_src_registry
  p_apps_api_src_inbox --> p_apps_api_src_db
  p_apps_api_src_inbox --> p_apps_api_src_limits
  p_apps_api_src_inbox --> p_apps_api_src_mail
  p_apps_api_src_job --> p_apps_api_src_registry
  p_apps_api_src_job --> p_apps_api_src_db
  p_apps_api_src_job --> p_apps_api_src_limits
  p_apps_api_src_paper --> p_apps_api_src_registry
  p_apps_api_src_paper --> p_apps_api_src_db
  p_apps_api_src_paper --> p_apps_api_src_limits
  p_apps_api_src_registry --> p_apps_api_src_db
  p_apps_api_src_registry --> p_apps_api_src_limits
```

| Pack | Layer | Public | Dependencies | Tables |
| --- | --- | --- | --- | --- |
| `apps/api/src` | app | index.ts | apps/api/src/account, apps/api/src/chat, apps/api/src/coach, apps/api/src/connections, apps/api/src/inbox, apps/api/src/job, apps/api/src/paper, apps/api/src/registry, apps/api/src/db, apps/api/src/mail, apps/api/src/limits | none |
| `apps/api/src/account` | feature | index.ts | apps/api/src/chat, apps/api/src/paper, apps/api/src/connections, apps/api/src/registry, apps/api/src/db, apps/api/src/limits, apps/api/src/mail | none |
| `apps/api/src/chat` | feature | index.ts | apps/api/src/job, apps/api/src/registry, apps/api/src/db, apps/api/src/limits | none |
| `apps/api/src/coach` | feature | index.ts | apps/api/src/chat, apps/api/src/account, apps/api/src/registry, apps/api/src/db, apps/api/src/limits | none |
| `apps/api/src/connections` | feature | index.ts | apps/api/src/registry, apps/api/src/db, apps/api/src/limits | none |
| `apps/api/src/db` | platform | none | none | none |
| `apps/api/src/inbox` | feature | index.ts | apps/api/src/account, apps/api/src/coach, apps/api/src/registry, apps/api/src/db, apps/api/src/limits, apps/api/src/mail | none |
| `apps/api/src/job` | feature | index.ts | apps/api/src/registry, apps/api/src/db, apps/api/src/limits | none |
| `apps/api/src/limits` | platform | index.ts | none | none |
| `apps/api/src/mail` | platform | none | none | none |
| `apps/api/src/paper` | feature | index.ts | apps/api/src/registry, apps/api/src/db, apps/api/src/limits | none |
| `apps/api/src/registry` | kernel | none | apps/api/src/db, apps/api/src/limits | none |
