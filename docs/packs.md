# Packs

`ts-packwerk docs --out` writes this page from every `pack.yml`, and `ts-packwerk docs --check` fails when it is stale.

```mermaid
flowchart TD
  subgraph p_layer_app["app"]
    p_apps_api_src["apps/api/src"]
    p_apps_web_src["apps/web/src"]
  end
  subgraph p_layer_shell["shell"]
    p_apps_web_src_features_app_shell["apps/web/src/features/app-shell"]
  end
  subgraph p_layer_feature["feature"]
    p_apps_api_src_account["apps/api/src/account"]
    p_apps_api_src_chat["apps/api/src/chat"]
    p_apps_api_src_coach["apps/api/src/coach"]
    p_apps_api_src_connections["apps/api/src/connections"]
    p_apps_api_src_inbox["apps/api/src/inbox"]
    p_apps_api_src_job["apps/api/src/job"]
    p_apps_api_src_paper["apps/api/src/paper"]
    p_apps_web_src_features_apply["apps/web/src/features/apply"]
    p_apps_web_src_features_auth["apps/web/src/features/auth"]
    p_apps_web_src_features_coach["apps/web/src/features/coach"]
    p_apps_web_src_features_coming_soon["apps/web/src/features/coming-soon"]
    p_apps_web_src_features_command_palette["apps/web/src/features/command-palette"]
    p_apps_web_src_features_connections["apps/web/src/features/connections"]
    p_apps_web_src_features_inbox["apps/web/src/features/inbox"]
    p_apps_web_src_features_landing["apps/web/src/features/landing"]
    p_apps_web_src_features_paper["apps/web/src/features/paper"]
    p_apps_web_src_features_paper_page["apps/web/src/features/paper-page"]
    p_apps_web_src_features_seed["apps/web/src/features/seed"]
    p_apps_web_src_features_settings["apps/web/src/features/settings"]
  end
  subgraph p_layer_kernel["kernel"]
    p_apps_api_src_registry["apps/api/src/registry"]
  end
  subgraph p_layer_platform["platform"]
    p_apps_api_src_db["apps/api/src/db"]
    p_apps_api_src_limits["apps/api/src/limits"]
    p_apps_api_src_mail["apps/api/src/mail"]
    p_apps_web_src_components["apps/web/src/components"]
    p_apps_web_src_lib["apps/web/src/lib"]
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
  p_apps_web_src --> p_apps_web_src_features_app_shell
  p_apps_web_src --> p_apps_web_src_features_apply
  p_apps_web_src --> p_apps_web_src_features_auth
  p_apps_web_src --> p_apps_web_src_features_coach
  p_apps_web_src --> p_apps_web_src_features_coming_soon
  p_apps_web_src --> p_apps_web_src_features_command_palette
  p_apps_web_src --> p_apps_web_src_features_connections
  p_apps_web_src --> p_apps_web_src_features_inbox
  p_apps_web_src --> p_apps_web_src_features_landing
  p_apps_web_src --> p_apps_web_src_features_paper
  p_apps_web_src --> p_apps_web_src_features_paper_page
  p_apps_web_src --> p_apps_web_src_features_seed
  p_apps_web_src --> p_apps_web_src_features_settings
  p_apps_web_src --> p_apps_web_src_lib
  p_apps_web_src --> p_apps_web_src_components
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_apply
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_auth
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_coach
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_command_palette
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_inbox
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_paper
  p_apps_web_src_features_app_shell --> p_apps_web_src_features_seed
  p_apps_web_src_features_app_shell --> p_apps_web_src_lib
  p_apps_web_src_features_app_shell --> p_apps_web_src_components
  p_apps_web_src_features_apply --> p_apps_web_src_lib
  p_apps_web_src_features_apply --> p_apps_web_src_components
  p_apps_web_src_features_auth --> p_apps_web_src_lib
  p_apps_web_src_features_auth --> p_apps_web_src_components
  p_apps_web_src_features_coach --> p_apps_web_src_lib
  p_apps_web_src_features_coach --> p_apps_web_src_components
  p_apps_web_src_features_coming_soon --> p_apps_web_src_lib
  p_apps_web_src_features_coming_soon --> p_apps_web_src_components
  p_apps_web_src_features_command_palette --> p_apps_web_src_lib
  p_apps_web_src_features_command_palette --> p_apps_web_src_components
  p_apps_web_src_features_connections --> p_apps_web_src_lib
  p_apps_web_src_features_connections --> p_apps_web_src_components
  p_apps_web_src_features_inbox --> p_apps_web_src_features_apply
  p_apps_web_src_features_inbox --> p_apps_web_src_lib
  p_apps_web_src_features_inbox --> p_apps_web_src_components
  p_apps_web_src_features_landing --> p_apps_web_src_lib
  p_apps_web_src_features_landing --> p_apps_web_src_components
  p_apps_web_src_features_paper --> p_apps_web_src_features_apply
  p_apps_web_src_features_paper --> p_apps_web_src_features_coach
  p_apps_web_src_features_paper --> p_apps_web_src_features_paper_page
  p_apps_web_src_features_paper --> p_apps_web_src_features_seed
  p_apps_web_src_features_paper --> p_apps_web_src_lib
  p_apps_web_src_features_paper --> p_apps_web_src_components
  p_apps_web_src_features_paper_page --> p_apps_web_src_lib
  p_apps_web_src_features_paper_page --> p_apps_web_src_components
  p_apps_web_src_features_seed --> p_apps_web_src_lib
  p_apps_web_src_features_seed --> p_apps_web_src_components
  p_apps_web_src_features_settings --> p_apps_web_src_features_auth
  p_apps_web_src_features_settings --> p_apps_web_src_features_connections
  p_apps_web_src_features_settings --> p_apps_web_src_lib
  p_apps_web_src_features_settings --> p_apps_web_src_components
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
| `apps/web/src` | app | none | apps/web/src/features/app-shell, apps/web/src/features/apply, apps/web/src/features/auth, apps/web/src/features/coach, apps/web/src/features/coming-soon, apps/web/src/features/command-palette, apps/web/src/features/connections, apps/web/src/features/inbox, apps/web/src/features/landing, apps/web/src/features/paper, apps/web/src/features/paper-page, apps/web/src/features/seed, apps/web/src/features/settings, apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/components` | platform | none | none | none |
| `apps/web/src/features/app-shell` | shell | none | apps/web/src/features/apply, apps/web/src/features/auth, apps/web/src/features/coach, apps/web/src/features/command-palette, apps/web/src/features/inbox, apps/web/src/features/paper, apps/web/src/features/seed, apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/apply` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/auth` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/coach` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/coming-soon` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/command-palette` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/connections` | feature | index.ts | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/inbox` | feature | none | apps/web/src/features/apply, apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/landing` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/paper` | feature | none | apps/web/src/features/apply, apps/web/src/features/coach, apps/web/src/features/paper-page, apps/web/src/features/seed, apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/paper-page` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/seed` | feature | none | apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/features/settings` | feature | none | apps/web/src/features/auth, apps/web/src/features/connections, apps/web/src/lib, apps/web/src/components | none |
| `apps/web/src/lib` | platform | none | none | none |
