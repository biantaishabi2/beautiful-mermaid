# Rust ASCII 复刻任务清单（按文件）

目标：在 `crates/beautiful-mermaid-rs/` 完整复刻 ASCII 渲染（含 flowchart/state/sequence/class/ER），不包含 SVG。

说明：下面每行是一个文件级任务，带 `Blocked by` 依赖标签。`Status` 仅标注当前进展。

## 增量迁移方案（Rust + N-API + 复用 TS 测试）

目标：不改动现有 TS 测试套件（`bun test`），通过 N-API 将 Rust 实现逐步替换 TS 模块。

已验证：
- Bun 1.3.5 可以直接加载 N-API 原生模块并运行测试。
- 已有最小可用 PoC：`crates/beautiful-mermaid-napi` + `src/__tests__/napi-smoke.test.ts`。

推荐迁移策略：
- 保持 TS 导出接口不变，内部加 Rust FFI 分发。
- 用环境变量开关控制（例如 `BM_USE_RUST=1` 走 Rust，默认走 TS）。
- 每替换一个模块就跑对应 TS 测试用例，确保行为一致。

模块优先级（建议顺序）：
1. `sequence/parser.ts`（有独立测试覆盖，依赖少）
2. `class/parser.ts`
3. `er/parser.ts`
4. `parser.ts`（flowchart/state）
5. ASCII 渲染核心（`src/ascii/*` 按依赖顺序）

N-API 落地步骤（每个模块一轮）：
1. 在 `crates/beautiful-mermaid-napi` 增加对应 Rust 实现（先返回 JSON，后续可直通 Rust structs）。
2. 在 `crates/beautiful-mermaid-napi/index.js` 导出 N-API 函数。
3. 在 TS 模块中加适配层（保持原函数签名，内部切换 Rust/TS）。
4. 执行 `bun test` 运行对应测试文件。

注意事项：
- Bun 支持 `.node` 但环境差异仍可能存在，遇到问题可临时切到 Node 运行测试。
- Rust 侧建议输出与 TS 完全一致的结构（字段名、可选字段、顺序无关）。

## 架构版本管理（flat / target / transition）

目标：保证“TS 现状验证”和“目标架构约束”同时存在，但只在需要时迭代 transition 版本。

约定：
- `flat.yaml`：仅反映 **当前 TS 实际依赖**，用于验证现状；不做版本号。
- `target.yaml`：终极目标架构（带 parent 分层）；不做版本号。
- `transition/vN.yaml`：过渡版本，只在 **发生架构拆分/分层调整** 时递增。

什么时候升级 transition 版本：
- 引入或调整 `parent` 分层
- 模块拆分/合并（例如把 `ascii_core` 再拆成 `ascii_layout` / `ascii_render`）
- 明确计划消除某类依赖边

什么时候不需要升级：
- 单文件实现替换（Rust/TS 互换）
- 内部实现调整但不改变模块依赖结构

建议流程：
1. 先维护 `flat.yaml`，确保 TS 现状验证始终可通过
2. 当需要结构化演进时，更新 `target.yaml`
3. 若引入拆分/迁移阶段，生成新的 `transition/vN.yaml`

## N-API 迁移任务清单（按文件）

| Task (File) | 说明 | Blocked by | Status |
| --- | --- | --- | --- |
| `crates/beautiful-mermaid-napi/package.json` | N-API 构建脚本与依赖 | None | done |
| `crates/beautiful-mermaid-napi/Cargo.toml` | N-API Rust crate 清单 | None | done |
| `crates/beautiful-mermaid-napi/src/lib.rs` | N-API 入口与导出（聚合各模块绑定） | `crates/beautiful-mermaid-rs` 对应模块实现 | in_progress |
| `crates/beautiful-mermaid-napi/index.js` | ESM loader（加载 `.node`） | `crates/beautiful-mermaid-napi/src/lib.rs` | done |
| `src/__tests__/napi-smoke.test.ts` | Bun N-API 冒烟测试 | `crates/beautiful-mermaid-napi/index.js` | done |
| `crates/beautiful-mermaid-napi/src/sequence.rs` | sequence parser N-API 绑定 | `crates/beautiful-mermaid-rs/src/sequence.rs` | todo |
| `crates/beautiful-mermaid-napi/src/class.rs` | class parser N-API 绑定 | `crates/beautiful-mermaid-rs/src/class.rs` | todo |
| `crates/beautiful-mermaid-napi/src/er.rs` | ER parser N-API 绑定 | `crates/beautiful-mermaid-rs/src/er.rs` | todo |
| `crates/beautiful-mermaid-napi/src/flowchart.rs` | flowchart/state parser N-API 绑定 | `crates/beautiful-mermaid-rs/src/parser.rs` | todo |
| `src/sequence/parser.ts` | TS 适配层：切换 Rust/TS 实现 | `crates/beautiful-mermaid-napi/src/sequence.rs` | todo |
| `src/class/parser.ts` | TS 适配层：切换 Rust/TS 实现 | `crates/beautiful-mermaid-napi/src/class.rs` | todo |
| `src/er/parser.ts` | TS 适配层：切换 Rust/TS 实现 | `crates/beautiful-mermaid-napi/src/er.rs` | todo |
| `src/parser.ts` | TS 适配层：flowchart/state 切换 | `crates/beautiful-mermaid-napi/src/flowchart.rs` | todo |
| `src/ascii/index.ts` | TS 适配层：ASCII 渲染入口切换 | `crates/beautiful-mermaid-napi/src/ascii.rs` | todo |
| `crates/beautiful-mermaid-napi/src/ascii.rs` | ASCII 渲染 N-API 绑定 | `crates/beautiful-mermaid-rs/src/ascii/mod.rs` | todo |

| Task (File) | 说明 | Blocked by | Status |
| --- | --- | --- | --- |
| `crates/beautiful-mermaid-rs/src/utils.rs` | `normalize_br_tags` 与基础文本规范化工具 | None | todo |
| `crates/beautiful-mermaid-rs/src/parser.rs` | flowchart/state 解析器（等价 TS `src/parser.ts`） | `src/utils.rs` | in_progress |
| `crates/beautiful-mermaid-rs/src/sequence.rs` | sequenceDiagram 解析器与类型 | `src/utils.rs` | todo |
| `crates/beautiful-mermaid-rs/src/class.rs` | classDiagram 解析器与类型 | `src/utils.rs` | todo |
| `crates/beautiful-mermaid-rs/src/er.rs` | erDiagram 解析器与类型 | `src/utils.rs` | todo |
| `crates/beautiful-mermaid-rs/src/lib.rs` | 统一入口与导出（`parse_diagram` 等） | `src/parser.rs`, `src/sequence.rs`, `src/class.rs`, `src/er.rs`, `src/ascii/mod.rs` | in_progress |
| `crates/beautiful-mermaid-rs/src/ascii/mod.rs` | ASCII 渲染入口与分发 | `src/ascii/converter.rs`, `src/ascii/grid.rs`, `src/ascii/draw.rs`, `src/ascii/canvas.rs`, `src/ascii/sequence.rs`, `src/ascii/class_diagram.rs`, `src/ascii/er_diagram.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/types.rs` | ASCII 结构体与坐标/角色类型 | `src/parser.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/ansi.rs` | ANSI 颜色与主题映射 | `src/ascii/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/canvas.rs` | 画布与 RoleCanvas 基础操作 | `src/ascii/types.rs`, `src/ascii/ansi.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/multiline_utils.rs` | 多行标签拆分与绘制辅助 | `src/ascii/canvas.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/validate.rs` | 对角线字符检测（测试辅助） | `src/ascii/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/pathfinder.rs` | A* 寻路 | `src/ascii/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/edge_routing.rs` | 边路径计算与方向判定 | `src/ascii/types.rs`, `src/ascii/pathfinder.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/edge_bundling.rs` | 并行边合流/分流 | `src/ascii/types.rs`, `src/ascii/pathfinder.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/converter.rs` | MermaidGraph -> AsciiGraph | `src/parser.rs`, `src/ascii/types.rs`, `src/ascii/canvas.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/grid.rs` | 网格布局、列宽行高、子图边界 | `src/ascii/types.rs`, `src/ascii/canvas.rs`, `src/ascii/edge_routing.rs`, `src/ascii/edge_bundling.rs`, `src/ascii/draw.rs`, `src/ascii/multiline_utils.rs`, `src/ascii/shapes/mod.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/draw.rs` | 画线、节点、箭头渲染 | `src/ascii/types.rs`, `src/ascii/canvas.rs`, `src/ascii/edge_routing.rs`, `src/ascii/grid.rs`, `src/ascii/multiline_utils.rs`, `src/ascii/shapes/mod.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/types.rs` | 形状渲染接口与尺寸 | `src/ascii/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/corners.rs` | 角字符与风格选择 | `src/ascii/shapes/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/rectangle.rs` | 矩形形状与连接点 | `src/ascii/shapes/types.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/rounded.rs` | 圆角矩形 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/diamond.rs` | 菱形 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/circle.rs` | 圆形 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/stadium.rs` | 体育场形状 | `src/ascii/shapes/rectangle.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/hexagon.rs` | 六边形 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/state.rs` | stateDiagram 起止伪状态 | `src/ascii/shapes/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/special.rs` | 子图/特殊形状 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/corners.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/shapes/mod.rs` | 形状注册表 | `src/ascii/shapes/rectangle.rs`, `src/ascii/shapes/rounded.rs`, `src/ascii/shapes/diamond.rs`, `src/ascii/shapes/circle.rs`, `src/ascii/shapes/stadium.rs`, `src/ascii/shapes/hexagon.rs`, `src/ascii/shapes/state.rs`, `src/ascii/shapes/special.rs`, `src/ascii/shapes/types.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/sequence.rs` | sequenceDiagram ASCII 渲染 | `src/sequence.rs`, `src/ascii/types.rs`, `src/ascii/canvas.rs`, `src/ascii/multiline_utils.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/class_diagram.rs` | classDiagram ASCII 渲染 | `src/class.rs`, `src/ascii/types.rs`, `src/ascii/canvas.rs`, `src/ascii/draw.rs`, `src/ascii/multiline_utils.rs` | todo |
| `crates/beautiful-mermaid-rs/src/ascii/er_diagram.rs` | erDiagram ASCII 渲染 | `src/er.rs`, `src/ascii/types.rs`, `src/ascii/canvas.rs`, `src/ascii/draw.rs`, `src/ascii/multiline_utils.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/parser_flowchart_state.rs` | flowchart/state parser 测试 | `src/parser.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/parser_sequence.rs` | sequence parser 测试 | `src/sequence.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/parser_class.rs` | class parser 测试 | `src/class.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/parser_er.rs` | ER parser 测试 | `src/er.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/ascii_golden_tests.rs` | ASCII/Unicode golden 输出测试 | `src/ascii/mod.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/ascii_edge_styles.rs` | 边线型字符测试 | `src/ascii/mod.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/ascii_multiline.rs` | 多行标签测试 | `src/ascii/mod.rs` | todo |
| `crates/beautiful-mermaid-rs/tests/diag_parse_all.rs` | 全部 testdata 解析通过性测试 | `src/lib.rs` | todo |

备注：`edge_routing` 与 `grid` 的相互依赖会在实现时通过抽公共辅助函数或在 `edge_routing` 内部实现来避免循环引用。
