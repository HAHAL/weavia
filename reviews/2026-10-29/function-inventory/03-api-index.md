# 后端注册接口逐项索引

日期：2026-10-29。直接从当前 server.go 路由注册提取。接口存在表示有路由与 handler，不等于部署可用、真实验收通过或权限审计通过。权限列记录外层路由门禁；handler 内还有归属、令牌与参数校验。未注册的服务方法不计作公开接口。

共 143 条注册接口。

## 公开入口/认证/文件令牌

| 方法 | 路径 | Handler | 外层门禁 | 源码行 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | `health` | 无统一登录中间件；详见 handler | [L84](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:84) |
| GET | `/api/readiness` | `readiness` | 无统一登录中间件；详见 handler | [L85](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:85) |
| GET | `/api/plans` | `plans` | 无统一登录中间件；详见 handler | [L86](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:86) |
| GET | `/api/ai/models` | `listPlatformModels` | 无统一登录中间件；详见 handler | [L87](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:87) |
| GET | `/api/showcase` | `listShowcase` | 无统一登录中间件；详见 handler | [L88](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:88) |
| GET | `/api/showcase/images/{showcaseID}` | `showcaseImage` | 无统一登录中间件；详见 handler | [L89](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:89) |
| GET | `/api/reference/{token}` | `referenceImage` | 无统一登录中间件；详见 handler | [L90](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:90) |
| GET | `/api/reference/{token}/image.png` | `referenceImage` | 无统一登录中间件；详见 handler | [L91](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:91) |
| GET | `/api/skills` | `listSkills` | 无统一登录中间件；详见 handler | [L92](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:92) |
| GET | `/api/apps` | `listApps` | 无统一登录中间件；详见 handler | [L93](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:93) |
| POST | `/api/auth/register` | `register` | 无统一登录中间件；详见 handler | [L94](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:94) |
| POST | `/api/auth/registration-requests` | `registrationRequest` | 无统一登录中间件；详见 handler | [L95](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:95) |
| POST | `/api/auth/email-verifications/verify` | `verifyRegistration` | 无统一登录中间件；详见 handler | [L96](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:96) |
| POST | `/api/auth/email-verifications/resend` | `registrationResend` | 无统一登录中间件；详见 handler | [L97](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:97) |
| POST | `/api/auth/password-reset/request` | `passwordResetRequest` | 无统一登录中间件；详见 handler | [L98](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:98) |
| POST | `/api/auth/password-reset/confirm` | `passwordResetConfirm` | 无统一登录中间件；详见 handler | [L99](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:99) |
| POST | `/api/auth/login` | `login` | 无统一登录中间件；详见 handler | [L100](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:100) |
| POST | `/api/auth/desktop/session` | `desktopSession` | 无统一登录中间件；详见 handler | [L101](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:101) |
| POST | `/api/auth/desktop/authorize` | `authorize` | 无统一登录中间件；详见 handler | [L102](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:102) |
| POST | `/api/auth/desktop/exchange` | `exchange` | 无统一登录中间件；详见 handler | [L103](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:103) |
| POST | `/api/auth/refresh` | `refresh` | 无统一登录中间件；详见 handler | [L104](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:104) |
| POST | `/api/auth/logout` | `logout` | 无统一登录中间件；详见 handler | [L105](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:105) |
| GET | `/api/auth/me` | `me` | 无统一登录中间件；详见 handler | [L106](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:106) |
| PUT | `/api/assets/upload/{token}` | `upload` | 无统一登录中间件；详见 handler | [L151](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:151) |

## 用户业务

| 方法 | 路径 | Handler | 外层门禁 | 源码行 |
| --- | --- | --- | --- | --- |
| GET | `/api/ai/catalog` | `catalog` | 登录用户 | [L110](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:110) |
| GET | `/api/auth/devices` | `listDevices` | 登录用户 | [L111](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:111) |
| DELETE | `/api/auth/devices/{deviceID}` | `revokeDevice` | 登录用户 | [L112](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:112) |
| GET | `/api/auth/sessions` | `listSessions` | 登录用户 | [L113](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:113) |
| GET | `/api/features` | `features` | 登录用户 | [L114](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:114) |
| DELETE | `/api/auth/sessions/{sessionID}` | `revokeSession` | 登录用户 | [L115](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:115) |
| POST | `/api/auth/sessions/revoke-all` | `revokeAllSessions` | 登录用户 | [L116](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:116) |
| POST | `/api/me/deletion-requests` | `requestDeletion` | 登录用户 | [L117](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:117) |
| GET | `/api/me/deletion-requests/current` | `currentDeletion` | 登录用户 | [L118](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:118) |
| GET | `/api/membership` | `membership` | 登录用户 | [L119](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:119) |
| GET | `/api/credits` | `credits` | 登录用户 | [L120](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:120) |
| GET | `/api/credits/transactions` | `creditTransactions` | 登录用户 | [L121](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:121) |
| POST | `/api/workspaces` | `createWorkspace` | 登录用户 | [L122](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:122) |
| GET | `/api/workspaces` | `listWorkspaces` | 登录用户 | [L123](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:123) |
| GET | `/api/projects` | `listProjects` | 登录用户 | [L124](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:124) |
| GET | `/api/assets` | `listAssets` | 登录用户 | [L125](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:125) |
| GET | `/api/assets/{assetID}/preview` | `assetPreview` | 登录用户 | [L126](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:126) |
| GET | `/api/sync/manifest` | `syncManifest` | 登录用户 | [L127](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:127) |
| GET | `/api/my/skills` | `listMySkills` | 登录用户 | [L128](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:128) |
| POST | `/api/skills` | `createSkill` | 登录用户 | [L129](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:129) |
| POST | `/api/skills/{skillID}/runs` | `runSkill` | 登录用户 | [L130](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:130) |
| POST | `/api/apps/{appID}/runs` | `runApp` | 登录用户 | [L131](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:131) |
| POST | `/api/workspaces/{workspaceID}/projects` | `createProject` | 登录用户 | [L132](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:132) |
| POST | `/api/projects/{projectID}/products` | `createProduct` | 登录用户 | [L133](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:133) |
| POST | `/api/products/{productID}/skus` | `createSKU` | 登录用户 | [L134](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:134) |
| POST | `/api/skus/{skuID}/assets` | `createProductAsset` | 登录用户 | [L135](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:135) |
| GET | `/api/skus/{skuID}/assets` | `listProductAssets` | 登录用户 | [L136](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:136) |
| POST | `/api/ai/estimate` | `estimate` | 登录用户 | [L137](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:137) |
| POST | `/api/ai/quotes` | `createQuote` | 登录用户 | [L138](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:138) |
| GET | `/api/ai/templates` | `templates` | 登录用户 | [L139](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:139) |
| POST | `/api/ai/tasks` | `createTask` | 登录用户 | [L140](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:140) |
| GET | `/api/ai/tasks` | `listTasks` | 登录用户 | [L141](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:141) |
| GET | `/api/ai/tasks/{taskID}` | `getTask` | 登录用户 | [L142](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:142) |
| GET | `/api/ai/tasks/{taskID}/outputs/{index}` | `getTaskOutput` | 登录用户 | [L143](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:143) |
| POST | `/api/assets/presign` | `presign` | 登录用户 | [L144](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:144) |
| POST | `/api/conversations` | `createConversation` | 登录用户 | [L145](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:145) |
| GET | `/api/conversations` | `listConversations` | 登录用户 | [L146](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:146) |
| GET | `/api/conversations/{conversationID}` | `getConversation` | 登录用户 | [L147](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:147) |
| POST | `/api/conversations/{conversationID}/messages` | `appendConversationMessage` | 登录用户 | [L148](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:148) |

## 工作流

| 方法 | 路径 | Handler | 外层门禁 | 源码行 |
| --- | --- | --- | --- | --- |
| GET | `/api/workflows` | `listWorkflows` | 登录用户 | [L154](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:154) |
| POST | `/api/workflows` | `saveWorkflow` | 登录用户 | [L155](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:155) |
| GET | `/api/workflows/{workflowID}` | `getWorkflow` | 登录用户 | [L156](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:156) |
| PUT | `/api/workflows/{workflowID}` | `saveWorkflow` | 登录用户 | [L157](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:157) |
| DELETE | `/api/workflows/{workflowID}` | `deleteWorkflow` | 登录用户 | [L158](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:158) |
| GET | `/api/workflows/{workflowID}/runs` | `listWorkflowRuns` | 登录用户 | [L159](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:159) |
| POST | `/api/workflows/{workflowID}/runs` | `startWorkflowRun` | 登录用户 | [L160](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:160) |
| PUT | `/api/workflows/{workflowID}/runs/{runID}` | `finishWorkflowRun` | 登录用户 | [L161](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:161) |

## 运营管理

| 方法 | 路径 | Handler | 外层门禁 | 源码行 |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/ai/catalog` | `adminCatalog` | admin.read | [L167](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:167) |
| GET | `/api/admin/ai/providers` | `adminProviders` | admin.read | [L168](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:168) |
| GET | `/api/admin/ai/models` | `adminModels` | admin.read | [L169](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:169) |
| GET | `/api/admin/ai/routing` | `adminRouting` | admin.read | [L170](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:170) |
| GET | `/api/admin/ai/usage` | `adminUsage` | admin.read | [L171](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:171) |
| GET | `/api/admin/skills` | `adminSkills` | admin.read | [L172](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:172) |
| GET | `/api/admin/apps` | `adminApps` | admin.read | [L173](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:173) |
| GET | `/api/admin/users` | `adminUsers` | admin.read | [L174](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:174) |
| GET | `/api/admin/users/{userID}/activity` | `adminUserActivity` | admin.read | [L175](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:175) |
| GET | `/api/admin/users/deletion-requests` | `adminDeletionRequests` | admin.read | [L176](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:176) |
| GET | `/api/admin/overview` | `adminOverview` | admin.read | [L177](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:177) |
| GET | `/api/admin/plans` | `adminPlans` | admin.read | [L178](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:178) |
| GET | `/api/admin/orders` | `adminOrders` | admin.read | [L179](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:179) |
| GET | `/api/admin/payments` | `adminPayments` | admin.read | [L180](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:180) |
| GET | `/api/admin/devices` | `adminDevices` | admin.read | [L181](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:181) |
| GET | `/api/admin/credits/transactions` | `adminCreditTransactions` | admin.read | [L182](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:182) |
| GET | `/api/admin/tasks` | `adminTasks` | admin.read | [L183](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:183) |
| GET | `/api/admin/task-runs` | `adminTaskRuns` | admin.read | [L184](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:184) |
| GET | `/api/admin/showcase` | `adminListShowcase` | admin.read | [L185](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:185) |
| GET | `/api/admin/ai/channels` | `adminChannels` | admin.read | [L186](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:186) |
| GET | `/api/admin/pricing` | `adminPricing` | admin.read | [L187](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:187) |
| GET | `/api/admin/invites` | `adminInvites` | admin.read | [L188](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:188) |
| GET | `/api/admin/storage` | `adminStorage` | admin.read | [L189](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:189) |
| GET | `/api/admin/audit-logs` | `adminAuditLogs` | admin.read | [L190](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:190) |
| GET | `/api/admin/roles` | `adminRoles` | admin.read | [L191](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:191) |
| GET | `/api/admin/users/{userID}/roles` | `adminUserRoles` | admin.read | [L192](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:192) |
| GET | `/api/admin/accounts/{accountNo}` | `adminAccountLookup` | admin.read | [L193](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:193) |
| GET | `/api/admin/route-groups` | `adminRouteGroups` | admin.read | [L194](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:194) |
| GET | `/api/admin/ai/provider-summary` | `adminProviderSummary` | admin.read | [L195](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:195) |
| GET | `/api/admin/accounts/{accountNo}/groups` | `adminAccountGroups` | admin.read | [L196](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:196) |
| PATCH | `/api/admin/ai/providers/{providerID}` | `patchProvider` | provider.write | [L198](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:198) |
| PUT | `/api/admin/ai/providers/{providerCode}/credential` | `adminSetProviderCredential` | provider.write | [L199](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:199) |
| POST | `/api/admin/ai/channels` | `adminCreateChannel` | provider.write | [L200](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:200) |
| POST | `/api/admin/ai/models/sync` | `adminSyncModels` | provider.write | [L201](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:201) |
| POST | `/api/admin/ai/tasks/cleanup` | `adminCleanupTasks` | provider.write | [L202](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:202) |
| PATCH | `/api/admin/skills/{skillID}` | `adminReviewSkill` | provider.write | [L203](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:203) |
| PATCH | `/api/admin/apps/{appID}` | `adminSetAppStatus` | provider.write | [L204](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:204) |
| PATCH | `/api/admin/ai/channels/{channelID}` | `adminUpdateChannel` | provider.write | [L205](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:205) |
| PATCH | `/api/admin/ai/channels/{channelID}/meta` | `adminUpdateChannelMeta` | provider.write | [L206](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:206) |
| DELETE | `/api/admin/ai/channels/{channelID}` | `adminDeleteChannel` | provider.write | [L207](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:207) |
| PUT | `/api/admin/ai/channels/{channelID}/key` | `adminSetChannelKey` | provider.write | [L208](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:208) |
| GET | `/api/admin/ai/channels/{channelID}/keys` | `adminListChannelKeys` | provider.write | [L209](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:209) |
| GET | `/api/admin/ai/channels/{channelID}/keys-health` | `adminChannelKeyHealth` | provider.write | [L210](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:210) |
| PATCH | `/api/admin/ai/routing/{bindingID}` | `adminUpdateRouting` | provider.write | [L211](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:211) |
| PATCH | `/api/admin/ai/channel-keys/{keyID}` | `adminUpdateChannelKey` | provider.write | [L212](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:212) |
| DELETE | `/api/admin/ai/channel-keys/{keyID}` | `adminDeleteChannelKey` | provider.write | [L213](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:213) |
| PUT | `/api/admin/pricing/settings` | `adminUpdatePricingSettings` | provider.write | [L214](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:214) |
| PUT | `/api/admin/pricing/cost/{channelModelID}` | `adminUpdateChannelCost` | provider.write | [L215](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:215) |
| PUT | `/api/admin/pricing/model/{logicalModelID}` | `adminUpdateModelPrice` | provider.write | [L216](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:216) |
| PUT | `/api/admin/storage` | `adminSaveStorage` | provider.write | [L217](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:217) |
| POST | `/api/admin/storage/test` | `adminTestStorage` | provider.write | [L218](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:218) |
| POST | `/api/admin/storage/migrate` | `adminMigrateStorage` | provider.write | [L219](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:219) |
| POST | `/api/admin/ai/channels/{channelID}/discover` | `adminDiscoverModels` | provider.write | [L220](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:220) |
| POST | `/api/admin/ai/channels/{channelID}/models` | `adminEnableModel` | provider.write | [L221](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:221) |
| GET | `/api/admin/ai/channels/{channelID}/models` | `adminChannelModels` | provider.write | [L222](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:222) |
| PATCH | `/api/admin/ai/channel-models/{modelID}` | `adminSetChannelModel` | provider.write | [L223](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:223) |
| PATCH | `/api/admin/route-groups/{groupID}` | `adminSetGroupMultiplier` | provider.write | [L224](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:224) |
| POST | `/api/admin/route-groups` | `adminCreateRouteGroup` | provider.write | [L225](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:225) |
| PUT | `/api/admin/route-groups/{groupID}/channels` | `adminSetGroupChannels` | provider.write | [L226](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:226) |
| PUT | `/api/admin/accounts/{accountNo}/groups` | `adminSetAccountGroups` | provider.write | [L227](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:227) |
| POST | `/api/admin/showcase` | `adminUploadShowcase` | showcase.write | [L228](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:228) |
| PATCH | `/api/admin/showcase/{showcaseID}` | `adminPatchShowcase` | showcase.write | [L229](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:229) |
| DELETE | `/api/admin/showcase/{showcaseID}` | `adminDeleteShowcase` | showcase.write | [L230](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:230) |
| POST | `/api/admin/credits/adjust` | `adminAdjustCredits` | credits.write | [L231](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:231) |
| PATCH | `/api/admin/users/{userID}/status` | `adminSetUserStatus` | users.write | [L232](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:232) |
| PUT | `/api/admin/users/{userID}/roles` | `adminSetUserRoles` | users.write | [L233](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:233) |
| POST | `/api/admin/invites` | `adminCreateInvite` | users.write | [L234](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:234) |
| PATCH | `/api/admin/users/{userID}/oss-sync` | `adminSetOSSSync` | users.write | [L235](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:235) |
| PATCH | `/api/admin/invites/{inviteID}` | `adminUpdateInvite` | users.write | [L236](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:236) |
| POST | `/api/admin/users/deletion-requests/{requestID}/approve` | `approveDeletion` | users.write | [L237](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:237) |
| POST | `/api/admin/users/deletion-requests/{requestID}/reject` | `rejectDeletion` | users.write | [L238](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:238) |
| PATCH | `/api/admin/plans/{planID}` | `adminUpdatePlan` | plans.write | [L239](/Users/jiangliu/Documents/weavia/server/services/backend/internal/httpapi/server.go:239) |
