import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
  type PgSchema,
} from "drizzle-orm/pg-core"

export function createOAuthTables(
  opencvApp: PgSchema<"opencv_app">,
  user: { id: AnyPgColumn },
  session: { id: AnyPgColumn }
) {
  const timestamptz = (name: string) =>
    timestamp(name, { withTimezone: true, mode: "date" })

  const oauthClient = opencvApp.table("oauth_client", {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled"),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: jsonb("scopes").$type<string[]>(),
    clientCredentialsScopes: jsonb("client_credentials_scopes").$type<
      string[]
    >(),
    userId: text("user_id").references((): AnyPgColumn => user.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamptz("created_at"),
    updatedAt: timestamptz("updated_at"),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: jsonb("contacts").$type<string[]>(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: jsonb("redirect_uris").$type<string[]>().notNull(),
    postLogoutRedirectUris: jsonb("post_logout_redirect_uris").$type<
      string[]
    >(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required"
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: jsonb("grant_types").$type<string[]>(),
    responseTypes: jsonb("response_types").$type<string[]>(),
    requirePKCE: boolean("require_p_k_c_e"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens"),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  })

  const oauthResource = opencvApp.table("oauth_resource", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull().unique(),
    name: text("name").notNull(),
    accessTokenTtl: integer("access_token_ttl"),
    refreshTokenTtl: integer("refresh_token_ttl"),
    signingAlgorithm: text("signing_algorithm"),
    signingKeyId: text("signing_key_id"),
    allowedScopes: jsonb("allowed_scopes").$type<string[]>(),
    customClaims: jsonb("custom_claims"),
    dpopBoundAccessTokensRequired: boolean("dpop_bound_access_tokens_required"),
    disabled: boolean("disabled"),
    createdAt: timestamptz("created_at"),
    updatedAt: timestamptz("updated_at"),
    policyVersion: integer("policy_version"),
    metadata: jsonb("metadata"),
  })

  const oauthClientResource = opencvApp.table(
    "oauth_client_resource",
    {
      id: text("id").primaryKey(),
      clientId: text("client_id")
        .notNull()
        .references((): AnyPgColumn => oauthClient.clientId, {
          onDelete: "cascade",
        }),
      resourceId: text("resource_id")
        .notNull()
        .references((): AnyPgColumn => oauthResource.identifier, {
          onDelete: "cascade",
        }),
      metadata: jsonb("metadata"),
      createdAt: timestamptz("created_at"),
    },
    (table) => [
      uniqueIndex("oauth_client_resource_client_resource_unique").on(
        table.clientId,
        table.resourceId
      ),
    ]
  )

  const oauthRefreshToken = opencvApp.table("oauth_refresh_token", {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references((): AnyPgColumn => oauthClient.clientId, {
        onDelete: "cascade",
      }),
    sessionId: text("session_id").references((): AnyPgColumn => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: jsonb("resources").$type<string[]>(),
    requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
      string[]
    >(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull(),
    revoked: timestamptz("revoked"),
    rotatedAt: timestamptz("rotated_at"),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: timestamptz("rotation_replay_expires_at"),
    authTime: timestamptz("auth_time"),
    confirmation: jsonb("confirmation"),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
  })

  const oauthAccessToken = opencvApp.table("oauth_access_token", {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references((): AnyPgColumn => oauthClient.clientId, {
        onDelete: "cascade",
      }),
    sessionId: text("session_id").references((): AnyPgColumn => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references((): AnyPgColumn => user.id, {
      onDelete: "cascade",
    }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: jsonb("resources").$type<string[]>(),
    requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
      string[]
    >(),
    refreshId: text("refresh_id").references(
      (): AnyPgColumn => oauthRefreshToken.id,
      { onDelete: "cascade" }
    ),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull(),
    revoked: timestamptz("revoked"),
    confirmation: jsonb("confirmation"),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
  })

  const oauthConsent = opencvApp.table("oauth_consent", {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references((): AnyPgColumn => oauthClient.clientId, {
        onDelete: "cascade",
      }),
    userId: text("user_id").references((): AnyPgColumn => user.id, {
      onDelete: "cascade",
    }),
    referenceId: text("reference_id"),
    resources: jsonb("resources").$type<string[]>(),
    requestedUserInfoClaims: jsonb("requested_user_info_claims").$type<
      string[]
    >(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  })

  const oauthClientAssertion = opencvApp.table("oauth_client_assertion", {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
  })

  const agentConnections = opencvApp.table("agent_connections", {
    id: uuid("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId),
    authorizationCodeId: text("authorization_code_id").notNull().unique(),
    name: text("name").notNull(),
    audience: text("audience").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    resources: jsonb("resources").$type<{ kind: "none" | "jobs" }>().notNull(),
    policy: jsonb("policy")
      .$type<{ reads: "allow"; writes: "approval" }>()
      .notNull(),
    version: integer("version").notNull().default(1),
    consentVersion: integer("consent_version").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastUsedAt: timestamptz("last_used_at"),
    expiresAt: timestamptz("expires_at").notNull(),
    revokedAt: timestamptz("revoked_at"),
  })

  const agentToolCalls = opencvApp.table(
    "agent_tool_calls",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      userId: text("user_id")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),
      connectionId: uuid("connection_id")
        .notNull()
        .references(() => agentConnections.id, { onDelete: "cascade" }),
      createdAt: timestamptz("created_at")
        .notNull()
        .default(sql`clock_timestamp()`),
      tool: text("tool").notNull(),
      inputHash: text("input_hash").notNull(),
      outcome: text("outcome", {
        enum: ["success", "pending", "error", "limited"],
      }).notNull(),
      proposalId: uuid("proposal_id"),
      charged: boolean("charged").notNull(),
    },
    (table) => [
      index("agent_tool_calls_owner_window").on(table.userId, table.createdAt),
      index("agent_tool_calls_connection_window").on(
        table.connectionId,
        table.createdAt
      ),
    ]
  )

  return {
    oauthClient,
    oauthResource,
    oauthClientResource,
    oauthRefreshToken,
    oauthAccessToken,
    oauthConsent,
    oauthClientAssertion,
    agentConnections,
    agentToolCalls,
  }
}
