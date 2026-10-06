# 织维 WEAVIA｜第一轮品牌与高保真设计交付
版本：Design v1.0 · 2026-10-06  
方向：Editorial Fashion × Premium SaaS  
主色：暖白、墨黑、柔灰；古铜只用于小面积选中与品牌细节。

## 00｜交付与边界
本包提供可运行的桌面客户端交互原型、完整官网、品牌与组件展示、设计变量、SVG 字标方向和页面截图。打开 index.html 即可浏览；图片下载建议通过本机预览服务使用。

这是设计原型，不是正式客户端，也不是已创建的原生 Figma 文件。AI、浏览器登录、Credits 与支付使用明确标识的交互演示；没有连接真实业务服务。模拟上传只在浏览器内读取；本轮不向服务端上传商品图片。任务只在当前会话内演示，不宣称实现了进程退出恢复。

核心链接：
- index.html：AI 模特、商拍、首页、项目、任务和结果查看器。
- index.html?flow=login：完整登录与新建项目流程。
- index.html?tool=commercial：商拍。
- index.html?state=credits：额度不足。
- website.html：完整 14 区块官网。
- system.html：品牌、变量、组件与流程入口。
- tokens.json：机器可读设计变量。
- assets/editorial-sheet.png：8 张概念摄影的 4×2 图集。
- screens/：1440×960、1280×800 与官网预览。

## 01｜依据与决策
|来源|设计约束|落点|
|---|---|---|
|01 MVP|V1 聚焦模特、商拍、本地项目与任务|侧栏无未来视频或设计功能|
|02 信息架构|首页、创作、项目、任务、账户分层|导航与主入口|
|03 AI 模特 PRD|商品→模特→姿势→背景→比例→质量→数量|右栏固定顺序|
|04 AI 商拍 PRD|场景、风格、构图；复用生成体验|同一三栏结构|
|05 Credits|冻结、成功结算、失败解冻|固定 CTA 的估算、任务与失败详情|
|06 技术架构|Local First 与云端 AI 协作|素材说明与官网真实表述|
|07 数据模型|任务、结果、流水相互关联|任务记录与结果参数分离|
|08 API 规范|幂等、状态查询|重复点击禁用、断网查询原任务|
|09 Roadmap|核心闭环优先|辅助页面支撑核心流程，不扩展全系统|
|10 验收|超时、部分成功、权限、重启恢复|异常状态规范与后续开发 Gate|
|11 Figma 任务书|高级极简、图像优先、组件化|品牌与 Figma 映射|
|本轮用户粘贴需求|限定第一轮 4 个核心页面 + 官网|当前交付范围优先|

01–10 使用项目现有同步源；11 来自产品文档对话中的完整任务书。知识库查询时未发现 11 的独立子页。05、06 当前版本仍包含待确认设计；具体价格、并发额度、正式字体授权不作为已决策事实。此设计不修改既有研发文档。

## 02｜品牌基线
### 定位与表达
面向电商商家、品牌和设计师的桌面商品视觉生产工具。视觉中心始终是商品与作品。通过充足留白、清晰排版与安静控件传递品质，而不是炫技动效。

品牌主张：让每一件商品拥有专业级视觉表达。  
英文辅助表达：A new perspective for every product.  
口吻：简短、具体、平静。动词优先，例如“添加商品”“开始生成”“下载图片”。

### 标识方向
拉开字距的 WEAVIA 字标，搭配交织笔画的 W 概念符号。中文“织维”作为辅助签名。SVG 为本轮原创方向稿，非最终商标定稿。
- 组合安全空间：不小于符号宽度的 1/2。
- 最小宽：字标 120 px；独立符号 24 px。
- 单色优先，允许墨黑、白色、古铜三种。
- 禁止拉伸、旋转、阴影、渐变、霓虹和复杂纹理。

### 色彩
|角色|Light|Dark|使用|
|---|---|---|---|
|背景|#F7F6F2|#242722|大面积底色|
|表面|#FFFFFF|#30352E|参数栏、弹窗|
|主文本|#252522|#EEEEE6|正文、标题|
|次文本|#6C6B64|#B8BCB0|辅助信息|
|弱文本|#85847D|#9DA494|仅非关键说明|
|描边|#E7E5DF|#495044|控件分隔|
|品牌强调|#9C8059|#C2AA82|小面积点缀|
|主要按钮|#282924|#EEEEE6|单一关键动作|
|成功|#53775E|#96BB9C|文字 + 图标|
|警示|#8A681D|#D6BE7F|文字 + 图标|
|错误|#A34539|#DDA097|错误原因 + 恢复操作|
|信息|#526B78|#A2BBC8|中性提示|

本轮桌面与官网以浅色为主要评审稿；深色仅提供基础变量和样例，不声称全站深色页面已完成。古铜不用于长段正文。正式实现需对每种文字/背景组合做 WCAG AA 对比度检查，正文至少 4.5:1，非文本控件至少 3:1。

### Typography
|层级|桌面 px/行高|官网 px/行高|字重|
|---|---|---|---|
|Display|不使用|56/1.3；移动 37/1.3|400|
|H1|25/1.3|48/1.3|500 / 400|
|H2|20/1.4|34/1.4|500|
|H3|14/1.5|18/1.5|500|
|Body Large|14/1.8|16/1.8|400|
|Body|13/1.7|14/1.8|400|
|Small|12/1.6|12/1.8|400|
|Caption|11/1.6|11/1.6|400|
|Label|12/1.4|11/1.4|500|

客户端英文 Inter → Helvetica Neue → sans；中文 PingFang SC → Microsoft YaHei。官网仅英文点缀使用 Georgia；中文保持现代黑体。概念稿中 9–10 px 的英文 eyebrow 与元数据不承载关键决策，开发时按系统缩放至少保证可读性。

### 摄影、图标与空间
- 摄影：暖灰影棚、浅石材、真实纤维、自然肤色，光线有方向且柔和。
- 不使用普通图标插画替代核心产品结果，不使用抽象 AI 光球。
- 图片为生成式概念素材，未来逐张替换为真实 WEAVIA 输出。不能把它们当成已验证的效果证据。
- 图标：20×20 基准，1.5 px 线宽，圆端点。姿势采用简化人形；全套正式图标需统一矢量资产。
- 间距：4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96。
- 圆角：控件 4、图片卡 4、普通卡 6、弹窗 8。
- 阴影：常规区域无阴影；浮层 0 20 90 rgba(0,0,0,.13)。
- 桌面 1440×960；1280×800 缩窄导航/素材栏，参数内容可独立滚动，底部 CTA 常驻。
- 官网最大内容宽 1224，12 列；窄屏改为单列，横向摄影组保留 3 张的编辑节奏。

## 03｜组件与 Variants
命名规则：Component / Variant / State。业务文案使用内容属性，不复制组件。

|组件|建议属性|关键状态与交互|
|---|---|---|
|Button|kind=primary/secondary/ghost/danger；size=sm/md；icon|默认、悬停、按下、禁用、加载；加载宽度稳定|
|Icon Button|icon；label；size|始终有可读名称与 tooltip|
|Input / Search|label；hint；error；value|聚焦、填写、清空、错误、禁用|
|Select|value；options|展开、选中、禁用；长内容截断|
|Segmented|items；selected；size|单选；选中背景与边框双重提示|
|Tabs|items；active；count|保留内容上下文；不与参数选择混用|
|Checkbox / Radio / Switch|checked；disabled；label|键盘操作；switch 为即时开关|
|Card|media；title；meta；action|可点区域明确，避免整卡嵌套交互冲突|
|Modal|title；body；primary；secondary|确认危险操作；Esc 关闭；正式实现焦点锁定|
|Drawer|side=right；width=360|查看任务细节，不中断画布上下文|
|Toast|type=info/success/error|短暂显示；错误仍在页面内保留恢复入口|
|Tooltip|placement；text|悬停/聚焦出现，不放关键说明|
|Badge|type；label|状态文字始终保留，不仅靠颜色|
|Avatar|image/initials；size|缺图使用首字母|
|Navigation|icon；label；selected；count|当前工具可辨识；会员信息置底|
|Task Status|state；resultCount|排队、生成、完成、部分成功、失败、状态未确认|
|Credits Display|estimated；available；frozen|估算与实际分开，成功张数决定结算|
|Image Card|ratio；source；selected|上传预览、结果预览、删除确认|
|Template Card|category；entitlement；selected|图像优先，选中勾选，限制时解释权益|
|Empty State|icon；title；body；CTA|明确下一步，只保留一个主动作|
|Skeleton|shape；count|只代表加载，不伪造百分比|

所有可交互组件定义 Default / Hover / Pressed / Disabled / Loading / Selected；不适用状态标记 N/A，而不创造没有意义的选中态。组件页提供浏览器原生表单与视觉示例；这不等于已经创建 Figma Component Sets。

## 04｜桌面核心页面
### D-001 Login
以字标、价值表达和浏览器登录按钮为主。正式产品在浏览器授权，再回到桌面客户端；原型按钮明确为模拟登录。

### D-002 Home
欢迎 → 模特/商拍两个大入口 → 最近项目 → 最近生成 → 当前任务。不给收益图表、运营 KPI 或复杂统计。
新建项目只要求名称；提交后进入 AI 模特空态。其他业务字段渐进披露。

### D-003 Projects
项目封面、名称、近期编辑时间。当前原型使用会话内示例项目，不模拟真实磁盘路径权限。

### D-004–007 AI Model
三栏：素材 164 / 弹性画布 / 参数 284；左侧应用导航 218。
- 默认推荐模特“温雅”、姿势“自动”、摄影棚、3:4、标准、4 张。
- 参数严格遵循用户认知顺序，无 Prompt / Seed / Provider 等。
- 提交前主视觉是商品；完成后 2×2 结果占据画布。
- 固定底栏明确预计消耗、单张估算、冻结与结算说明。
- 模特卡默认 3 张；完整选择弹窗保留搜索。

### D-008 AI Commercial
复用三栏和结果查看器。场景 → 风格 → 构图 → 比例 → 质量 → 数量。
默认极简影棚、高级风格、自动构图、3:4、标准、4 张。分类推荐 / 摄影棚 / 极简 / Lifestyle / Luxury / Nature。类别是筛选，不直接修改生成参数；最终必须选中一个场景。

### D-009 Tasks
任务记录可查看当前状态和费用。错误不直接等于退款：仅在服务端确认终态和释放额度后显示“已解冻”。

### D-010 Result Viewer
大图占据主要空间；右侧项目、场景、比例、质量与费用。下载主按钮，再次生成次按钮，删除低权重危险操作。原型下载的是真实概念图片文件，非真实生成输出。作品删除不等于删除原商品文件。

## 05｜完整状态规范
|状态|画布文案方向|CTA|计费 / 恢复|
|---|---|---|---|
|Empty|添加一件商品，开始创作|添加图片|0；未提交|
|Upload|正在读取商品图片|禁用生成|本地读取，无 AI 扣费|
|Analyze|检查尺寸与格式|禁用生成|不得宣称未执行的 AI 分析|
|Ready|素材已就绪|开始生成|显示估算|
|Submitting|正在提交任务|加载、不可连点|请求带幂等键；查询确认冻结|
|Processing|正在为商品创作新视觉|不可重复生成|只显示真实阶段|
|Success|作品已生成|查看 / 下载|按成功结果结算|
|Failed|这次生成未完成|详情 / 返回创作|明确是否已释放，保留参数|
|Credits insufficient|额度不足|补充 Credits|冻结前拦截，不偷偷降低数量|
|Plan restricted|此模板需要 Pro|权益 / 换推荐模板|不主动扣费或升级|
|Network error|任务状态尚未确认|恢复连接并查询|沿用原 task，不盲目重试|
|Partial success|4 张中 3 张成功|查看 3 张 / 重试失败项|示例 60 扣费、20 解冻；新任务须重新确认|

超时：显示“仍在确认任务状态”直到可靠终态，不能只靠客户端计时结束任务。Provider Fallback 对用户不暴露厂商名；若需更长等待，以真实阶段说明。关闭客户端后恢复是正式研发要求，本原型不伪装为已实现。

## 06｜官网
14 个区块：Navigation / Hero / Results / AI Model / AI Commercial / BeforeAfter / HowItWorks / UseCases / LocalFirst / AI Engine / Pricing / Download / FAQ / Footer。
- Hero 在 5 秒内说明商品图片 → AI 模特图 / 商拍图。
- 作品以大尺寸摄影呈现，所有概念案例透明标识。
- BeforeAfter 是可拖动对比，不暗示本原型执行了生成。
- Free / Pro / Studio 中 Pro 以温暖底色和细边框区分，不使用折扣贴纸。
- 未确认定价、平台最低版本、安装包均不虚构；下载按钮解释原型状态并引导体验。
- 官网移动版以 390 px 宽设计；桌面创作工具不伪装为移动端产品。

## 07｜三条原型路径
1. Login → Home → Create project → Empty → Upload / 示例 → Ready → Select model → Submit → Processing → Success → Viewer → Download。
2. Home → AI Commercial → Upload / 示例 → Scene → Style / Composition → Generate → Viewer。
3. Credits insufficient → Generate → Credits modal → Package → Confirm purchase preview → End（无真实支付）。

右上评审状态切换器可直接访问 11 个状态，独立于业务流程；这是设计评审工具，正式产品移除。状态预览的数字是固定设计案例，不当作业务账本。

## 08｜Figma 搭建映射
|Page|Frames|
|---|---|
|00 Cover|版本、主张、封面拼图、交付边界|
|01 Brand|Logo direction、Light/Dark palette、Photography|
|02 Foundations|Type、Spacing、Radius、Shadow、Grid|
|03 Components|上述组件的 Component Set 与业务组合|
|04 Desktop Core|D-001–010；1440×960 与重点 1280×800|
|05 Desktop States|Model 和 Commercial 各 11 状态，5 关键弹窗|
|06 Website|W-001 完整首页；Pricing/Download 可复用 section|
|07 Prototype|3 flow starting points|
|08 Archive|上一版与弃用方案，附日期|

Auto Layout：
- App shell：横向，导航 fixed，main fill。
- Studio：横向，materials fixed、canvas fill、settings fixed。
- Settings：纵向，上部 scroll fill，底部 CTA hug。
- Button：水平居中，图标间距 8，水平 padding 16–20。
- Template cards：media fill + caption hug，选中为 variant。
- Modal：标题行、正文 fill、footer hug；最大高度 viewport–64。
- Website：section vertical，max-width 1224，mobile 转单列。

## 09｜研发衔接与待确认
- 示例标准价格：AI 模特 20 Credits/张，商拍 15；4 张分别 80/60。高质量×2、快速×0.5 只为原型响应演示，不能作为已批准费率上线。
- 正式定价、权益、并发、图片尺寸与素材保存时限需产品确认。
- 用户输入文件应检查 MIME、尺寸、方向与体积；当前演示只检查类型与 20MB 大小并预览。
- 页面关键状态应来自任务 API，不使用固定秒数；模拟计时仅为本原型走查。
- 正式下载增加单图/全选与断点恢复；本轮单图演示。
- 正式支付只有服务端确认到账后才增加余额；客户端提示不能创建额度。
- 焦点锁定、完整 ARIA 单选状态、屏幕阅读器、系统高对比模式与真实 Windows 客户端需要实施验收；不可因浏览器原型通过而视为客户端已验收。
- 第一轮已设计核心页面；设备管理、完整用户中心、Admin、支付账单全页不在本轮高保真重点，留在既有研发范围。

