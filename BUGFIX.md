# Bugfix — 2xx 空响应体导致工具卡片发送抛裸 SyntaxError（上游 issue #5）

## 标题

工具卡片全部失败：2xx + 空响应体导致 `JSON.parse('')` 抛 `Unexpected end of JSON input`（上游 https://github.com/xcisxc29/dsh-wechat/issues/5 ）。

## 证据链（失败 → 通过）

基线（上游 HEAD `e0e8cb3d4c4376b15c598d4843b52b44ce8dac38`，版本 0.46.0）：

- `pnpm build`、`pnpm typecheck` 通过；`pnpm test` 全部 324 个测试通过（10 个套件：94+15+6+15+3+123+19+5+13+31），无失败测试可挑，故走可复现 issue 路线。
- 最小复现脚本（离线，stub 全局 `fetch` 返回 `200 + ''`，不碰真实微信网关/账号；脚本保存在工作区 `../repro.mts`，通过 `git stash` 对照复跑）：
  - 修复前（exit 1）：`parseWireJson(empty): threw SyntaxError: Unexpected end of JSON input`；`apiCall(empty 200): threw SyntaxError: Unexpected end of JSON input` —— 与 issue #5 日志逐字一致。
  - 修复后（exit 0）：`parseWireJson(empty): threw ApiEmptyResponseError: empty response body`；`apiCall(empty 200): threw ApiEmptyResponseError: ilink/bot/sendmessage returned an empty response body (2xx with no body)`。

## 根因

`packages/core/src/http.ts` 的 `apiCall()` → `parseWireJson()` 链上缺少「2xx 但响应体为空」的防护：`apiCallRaw()` 只对非 2xx 抛 `ApiHttpError`，2xx 空 body 原样返回 `''`，随后 `JSON.parse('')` 抛裸 `SyntaxError`，不带 endpoint 也不带原因。`sendItem()`（工具卡片路径）因此每次调用都以这个无名错误失败，且控制流走不到本应处理拒绝的 `assertSendAccepted()`。

## 改动（仅 1 个文件，+30 行）

`packages/core/src/http.ts`：

- 新增命名错误类 `ApiEmptyResponseError`（可选携带 `endpoint`）。
- `parseWireJson()`：body 为空/纯空白时抛 `ApiEmptyResponseError`，不再落到 `JSON.parse`。
- `apiCall()`：拿到 raw 后先判空，抛带 endpoint 的 `ApiEmptyResponseError(request.endpoint)`，并补 `@throws` 文档。

刻意不把空 body 当成功：空响应里没有 `errcode`，`assertSendAccepted` 无从判断，把发送报成「已送达」可能与事实相反（原代码注释里明确把这种假成功列为最坏形态）。本次只按 issue 期望行为第 1 条把失败「命名化」。

## 复验

- 复现脚本：修复前 exit 1（双 SyntaxError）→ 修复后 exit 0（双 `ApiEmptyResponseError`），`git stash` / `stash pop` 对照一致。
- 修复后 `pnpm build` 通过、`pnpm typecheck` 通过、`pnpm test` 仍 324/324 全部通过，无回归。

## 边界

- 只做离线逻辑修复，未连接真实微信网关/账号，未做真实发送验证；触发条件（会话超时后服务端 2xx 空 body）取自 issue #5 的实测报告。
- 空 body 仍是一次失败（只是有名字、可定位），不是吞掉错误或假报成功；调用方原有的 catch/retry/日志路径行为不变（`setTyping`、`notifyStop` 等原本就捕获全部异常）。
- 未改其他调用点、未改响应解析的 uint64 无损处理逻辑；非空 body 行为与上游完全一致。
