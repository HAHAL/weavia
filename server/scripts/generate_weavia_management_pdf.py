#!/usr/bin/env python3
"""Render the management brief from the verified 2026-10-13 WEAVIA snapshot.

The editable narrative is WEAVIA_PROJECT_REPORT.md. This layout intentionally
keeps claims short and labels planned capabilities separately from tested ones.
"""

from __future__ import annotations

from pathlib import Path
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "WEAVIA_AI电商智能创作平台项目汇报书.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("Heiti", "/System/Library/Fonts/STHeiti Medium.ttc", subfontIndex=0))

W, H = 960, 540
GREEN = HexColor("#19352B")
DEEP = HexColor("#15251F")
GREEN2 = HexColor("#284A3B")
GOLD = HexColor("#AC8B59")
PALE_GOLD = HexColor("#E9DDC6")
CREAM = HexColor("#F7F5F0")
WHITE = HexColor("#FFFFFF")
INK = HexColor("#202822")
MUTED = HexColor("#657068")
LINE = HexColor("#DBDFD7")
SOFT = HexColor("#EDF1EB")
WARN = HexColor("#A65F3D")

PAGES = [
    ("cover", None, "封面"),
    ("executive", None, "管理层摘要"),
    ("toc", None, "目录"),
    ("overview", 1, "项目概述"),
    ("market", 2, "市场背景"),
    ("product", 3, "产品介绍"),
    ("features", 4, "产品功能展示"),
    ("screens", None, "产品界面"),
    ("flow", None, "产品流程"),
    ("architecture", 5, "技术架构"),
    ("business", 6, "商业模式"),
    ("roi", None, "投入产出"),
    ("progress", 7, "研发进度"),
    ("strengths", 8, "技术优势"),
    ("roadmap", 9, "后续计划"),
    ("closing", 10, "项目价值总结"),
    ("sources", None, "资料来源"),
]

CHAPTERS = [(num, title, i + 1) for i, (_, num, title) in enumerate(PAGES) if num is not None]

c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
c.setTitle("织维 WEAVIA AI电商智能创作平台项目汇报书")
c.setAuthor("WEAVIA 项目组")
c.setSubject("管理层项目汇报｜产品、商业模式、技术与研发进度")
PAGE_NO = 0


def rect(x, y, w, h, fill, stroke=None, radius=0, sw=1):
    c.setLineWidth(sw)
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    if radius:
        c.roundRect(x, y, w, h, radius, stroke=int(stroke is not None), fill=1)
    else:
        c.rect(x, y, w, h, stroke=int(stroke is not None), fill=1)


def txt(x, y, value, size=14, color=INK, font="Heiti", align="left"):
    c.setFont(font, size)
    c.setFillColor(color)
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)


def wrap(value, width, size=13, font="Heiti"):
    lines = []
    current = ""
    for char in value:
        if char == "\n":
            lines.append(current)
            current = ""
            continue
        if pdfmetrics.stringWidth(current + char, font, size) > width and current:
            lines.append(current)
            current = char
        else:
            current += char
    if current or not lines:
        lines.append(current)
    return lines


def para(x, top, value, width, size=13, leading=21, color=INK, max_lines=None):
    lines = wrap(value, width, size)
    if max_lines:
        lines = lines[:max_lines]
    for i, line in enumerate(lines):
        txt(x, top - i * leading, line, size, color)
    return top - len(lines) * leading


def rule(x1, y, x2, color=LINE, width=1):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def arrow(x1, y1, x2, y2, color=GOLD, width=2):
    from math import atan2, cos, sin, pi
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    a = atan2(y2 - y1, x2 - x1)
    length = 8
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - length * cos(a - pi / 6), y2 - length * sin(a - pi / 6))
    p.lineTo(x2 - length * cos(a + pi / 6), y2 - length * sin(a + pi / 6))
    p.close()
    c.drawPath(p, stroke=0, fill=1)


def chip(x, y, label, tone="green", width=None):
    styles = {
        "green": (GREEN, WHITE),
        "light": (SOFT, GREEN),
        "gold": (PALE_GOLD, GREEN),
        "warn": (HexColor("#F4E5DD"), WARN),
    }
    bg, fg = styles[tone]
    width = width or max(68, pdfmetrics.stringWidth(label, "Heiti", 10) + 22)
    rect(x, y, width, 24, bg, radius=12)
    txt(x + width / 2, y + 7, label, 10, fg, align="center")
    return width


def page_base(chapter, title, subtitle="", dark=False):
    rect(0, 0, W, H, DEEP if dark else CREAM)
    fg = WHITE if dark else INK
    sub = HexColor("#C8D0C7") if dark else MUTED
    txt(42, 500, "WEAVIA  /  MANAGEMENT BRIEF", 10, GOLD if dark else GREEN2, "Helvetica-Bold")
    txt(918, 500, "2026.10", 10, sub, "Helvetica", "right")
    rule(42, 486, 918, HexColor("#426052") if dark else LINE)
    if chapter:
        txt(42, 453, f"{chapter:02d}  /  {title}", 11, GOLD, "Heiti")
    txt(42, 412, title, 31, fg)
    if subtitle:
        para(43, 381, subtitle, 845, 12, 19, sub, 2)
    if chapter or title != "封面":
        rule(42, 38, 918, HexColor("#426052") if dark else LINE)
        txt(42, 20, "织维 WEAVIA · AI 电商内容生产", 9, sub)
        txt(918, 20, f"{PAGE_NO:02d}  /  {len(PAGES):02d}", 9, sub, "Helvetica", "right")


def card(x, y, w, h, title, body="", accent=GOLD, light=False):
    rect(x, y, w, h, WHITE if light else SOFT, radius=13)
    rect(x + 18, y + h - 29, 22, 3, accent, radius=1.5)
    txt(x + 18, y + h - 60, title, 17, INK)
    if body:
        para(x + 18, y + h - 85, body, w - 36, 11.5, 19, MUTED)


def image_cover(path, x, y, w, h):
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    p = c.beginPath()
    p.roundRect(x, y, w, h, 10)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    c.restoreState()


def draw_cover():
    rect(0, 0, W, H, DEEP)
    rect(0, 0, 24, H, GOLD)
    txt(58, 484, "WEAVIA    /    织维", 20, WHITE, "Heiti")
    txt(58, 433, "AI COMMERCE STUDIO", 12, GOLD, "Helvetica-Bold")
    txt(58, 336, "AI 驱动电商", 45, WHITE)
    txt(58, 280, "智能创作平台", 45, WHITE)
    rule(58, 242, 398, GOLD, 2)
    para(58, 212, "从商品原图，到可管理、可复用、可衡量的视觉内容生产工作流。", 350, 17, 28, HexColor("#DCE2D9"))
    chip(58, 86, "管理层项目汇报", "gold", 128)
    txt(58, 58, "产品定位 · 商业路径 · 技术底座 · 阶段决策", 11, HexColor("#B8C4BA"))
    image_cover(ROOT / "docs/screenshots/phase2-web-visual-fix/home-desktop.jpg", 490, 75, 415, 355)
    txt(905, 55, "2026.10.13", 11, GOLD, "Helvetica", "right")


def draw_executive():
    page_base(None, "管理层摘要", "产品骨架已成形；下一步需要用一个可收费的高频图片场景证明质量、成本与复购。")
    card(42, 202, 274, 140, "已经验证", "官网、账户、Admin 用户查看与 Desktop 登录/本地项目创建；临时服务器服务正常。", GREEN, True)
    card(333, 202, 274, 140, "关键待办", "真实 AI 模型调用、在线支付、邮件注册与公众可访问的域名 HTTPS。", GOLD, True)
    card(624, 202, 294, 140, "建议决策", "批准受控预算的商业 Demo；先选一个图片场景，再按证据决定扩大投入。", WARN, True)
    rect(42, 78, 876, 102, GREEN, radius=14)
    txt(64, 142, "本次汇报的判断原则", 14, PALE_GOLD)
    para(64, 115, "界面与 API 骨架 ≠ 已商用能力；测试环境通过 ≠ 公开生产上线。所有市场与 ROI 结论均标明证据边界。", 820, 13, 21, WHITE)


def draw_toc():
    page_base(None, "目录", "依据章节结构自动生成页码，便于会议跳转与后续版本更新。")
    for idx, (num, title, page) in enumerate(CHAPTERS):
        col = idx // 5
        row = idx % 5
        x = 43 + col * 451
        y = 331 - row * 53
        txt(x, y, f"{num:02d}", 16, GOLD, "Helvetica-Bold")
        txt(x + 39, y, title, 15, INK)
        rule(x + 39, y - 13, x + 368, LINE)
        txt(x + 386, y, f"{page:02d}", 12, MUTED, "Helvetica", "right")
        c.linkAbsolute(f"第{num}章 {title}", f"chapter{num}", Rect=(x, y - 15, x + 395, y + 21))
    txt(43, 54, "附录  /  资料来源与证据口径", 11, MUTED)
    txt(430, 54, f"{len(PAGES):02d}", 11, MUTED, "Helvetica", "right")


def draw_overview():
    page_base(1, "项目概述", "把一次性商品摄影项目，转化为可复用、可管理的数字化内容生产流程。")
    card(43, 176, 273, 168, "目标客户", "电商企业 · 品牌商 · 设计师 · 运营团队\n从单人上新到多 SKU 团队创作。", GREEN, True)
    card(333, 176, 273, 168, "核心痛点", "拍摄和修图成本高、沟通周期长、跨渠道版本多、作品来源与费用难追踪。", GOLD, True)
    card(623, 176, 295, 168, "WEAVIA 路径", "以商品/SKU 为中心沉淀素材；以模板与任务生成视觉；以账本与审核管理成本。", GREEN, True)
    chip(44, 116, "首期：模特图 / 商拍图 / 商品主图", "green", 273)
    chip(331, 116, "后续：详情页 / 短视频 / 款式裂变", "light", 280)
    txt(44, 80, "预期价值：更快上新 · 更低单位可用图成本 · 更多渠道版本", 17, GREEN)
    txt(44, 56, "以上为待验证目标，非已取得的经营绩效。", 10, MUTED)


def draw_market():
    page_base(2, "市场背景", "商品视觉需求广泛；AI 普及提升接受度，但客户付费意愿必须通过试点验证。")
    rect(42, 203, 420, 143, GREEN, radius=14)
    txt(62, 301, "15.97 万亿元", 31, WHITE)
    txt(62, 271, "2025 年全国网上零售额", 14, PALE_GOLD)
    txt(62, 239, "同比 +8.6%  /  实物商品网上零售额 13.09 万亿元", 11, WHITE)
    rect(478, 203, 440, 143, WHITE, radius=14)
    txt(498, 301, "6.02 亿", 31, GREEN)
    txt(498, 271, "2025 年末生成式 AI 用户规模", 14, GREEN2)
    txt(498, 239, "用户普及 ≠ 电商企业采购；需做客户与付费验证", 11, MUTED)
    txt(43, 169, "优先切入的客户", 17, INK)
    for i, (label, desc) in enumerate([
        ("服装品牌", "模特与穿搭视觉"), ("淘宝/天猫商家", "上新主图与活动图"),
        ("跨境卖家", "多渠道、多市场版本"), ("设计/代运营", "多客户交付与版本管理")
    ]):
        x = 43 + i * 219
        rect(x, 77, 205, 73, SOFT, radius=10)
        txt(x + 14, 120, label, 13, GREEN)
        txt(x + 14, 93, desc, 10, MUTED)
    txt(43, 53, "来源：国家统计局（2025 网上零售）；CNNIC 第 57 次报告（生成式 AI 用户）。", 9, MUTED)


def draw_product():
    page_base(3, "产品介绍", "三端协同：Web 负责连接客户，Desktop 承载创作，Admin 支撑运营。")
    stages = [
        (44, "WEB 官网", "获客 / 账户", "品牌介绍、产品与定价方向、注册登录、用户中心"),
        (347, "DESKTOP", "核心生产工具", "商品/SKU、项目、素材、模板、任务与作品资产"),
        (650, "ADMIN", "商业运营", "用户、会员、Credits、订单记录、AI 与任务视图"),
    ]
    for x, label, title, body in stages:
        rect(x, 175, 266, 168, WHITE, radius=15)
        txt(x + 18, 310, label, 10, GOLD)
        txt(x + 18, 274, title, 20, GREEN)
        para(x + 18, 241, body, 225, 12, 20, MUTED)
    arrow(310, 259, 342, 259)
    arrow(613, 259, 645, 259)
    rect(45, 90, 870, 57, GREEN, radius=13)
    txt(69, 113, "统一服务层  /  身份与会员  ·  Credits 账本  ·  任务调度  ·  供应商适配", 15, WHITE)
    txt(45, 61, "当前为三端产品骨架；在线购买与真实 AI 生成尚未开放。", 11, MUTED)


def draw_features():
    page_base(4, "产品功能展示", "按真实状态呈现：已验证的用户路径、可演示的界面与尚未开放的商业能力。")
    rows = [
        ("WEB", "官网 / 定价 / 登录 / 用户中心", "页面与登录实测", "邮件注册、付费购买"),
        ("DESKTOP", "工作台 / 项目 / 素材 / 模板 / 任务", "登录、资料、本地项目实测", "真实生成、正式安装签名"),
        ("ADMIN", "用户 / 会员 / Credits / 订单 / AI", "登录、用户列表实测", "支付处理、配置发布"),
        ("BACKEND", "认证 / 工作区 / 账本 / 队列", "健康与就绪实测", "真实 Provider 与交易闭环"),
    ]
    rect(42, 322, 876, 31, GREEN, radius=7)
    txt(57, 332, "模块", 12, WHITE)
    txt(171, 332, "当前覆盖", 12, WHITE)
    txt(478, 332, "验收证据", 12, WHITE)
    txt(690, 332, "关键缺口", 12, WHITE)
    for i, (name, covered, tested, gap) in enumerate(rows):
        y = 254 - 62 * i
        rect(42, y, 876, 56, WHITE if i % 2 == 0 else SOFT, radius=7)
        txt(57, y + 21, name, 12, GREEN, "Helvetica-Bold")
        para(171, y + 28, covered, 288, 11, 16, INK, 2)
        para(478, y + 28, tested, 196, 11, 16, GREEN2, 2)
        para(690, y + 28, gap, 210, 11, 16, WARN, 2)
    txt(43, 53, "口径：页面存在 ≠ 已商用；Provider 适配器存在 ≠ 真实模型质量通过。", 10, MUTED)


def draw_screens():
    page_base(None, "产品界面", "仓库中的阶段性实测截图，用于展示产品形态；不是 AI 生成成果样张。")
    image_cover(ROOT / "docs/screenshots/phase2-web-visual-fix/home-desktop.jpg", 42, 148, 425, 205)
    image_cover(ROOT / "docs/screenshots/sprint2/home-1440.jpg", 493, 148, 425, 205)
    txt(45, 124, "Web 官网 / 品牌与产品入口", 13, GREEN)
    txt(495, 124, "Desktop / 本地创作工作台", 13, GREEN)
    rect(42, 57, 876, 47, SOFT, radius=9)
    txt(57, 75, "当前展示重点：统一的商品创作叙事、清晰的工作台导航与已封闭的真实生成入口。", 11, MUTED)


def draw_flow():
    page_base(None, "产品流程图", "面向真实商业闭环的目标路径；绿色为已有骨架，金色为下一阶段关键验收。")
    items = [
        ("01", "商品 / SKU", "本地组织", "done"),
        ("02", "素材导入", "原图管理", "done"),
        ("03", "方向与模板", "流程预览", "done"),
        ("04", "报价与权益", "服务端统一", "next"),
        ("05", "AI 生成", "真实模型验证", "next"),
        ("06", "审核与导出", "可用图闭环", "next"),
    ]
    for i, (num, title, detail, state) in enumerate(items):
        x = 42 + i * 149
        rect(x, 206, 133, 137, WHITE if state == "done" else PALE_GOLD, radius=12)
        txt(x + 14, 315, num, 11, GREEN if state == "done" else GOLD, "Helvetica-Bold")
        txt(x + 14, 274, title, 15, INK)
        txt(x + 14, 242, detail, 10, MUTED)
        if i < len(items) - 1:
            arrow(x + 134, 271, x + 146, 271, GOLD)
    rect(42, 94, 876, 78, GREEN, radius=13)
    txt(61, 140, "管理目标", 13, PALE_GOLD)
    txt(61, 109, "形成从商品原图到可审核营销素材的质量、交付时间和费用证据链。", 15, WHITE)


def draw_architecture():
    page_base(5, "技术架构", "采用成熟云端模型能力与轻量服务端，降低自建模型和 GPU 基础设施前期投入。")
    # Three levels with explicit data ownership.
    for x, label, sub in [(45, "Web / Admin", "Next.js"), (347, "Desktop", "Tauri + React"), (650, "本地数据", "SQLite / 文件")]:
        rect(x, 292, 265, 61, WHITE, radius=11)
        txt(x + 16, 322, label, 15, GREEN)
        txt(x + 16, 301, sub, 10, MUTED)
    rect(45, 189, 568, 65, GREEN, radius=11)
    txt(65, 217, "Go Backend API  /  身份 · 会员 · Credits · 任务", 16, WHITE)
    rect(650, 189, 265, 65, SOFT, radius=11)
    txt(670, 217, "PostgreSQL", 16, GREEN)
    rect(45, 87, 265, 65, SOFT, radius=11)
    txt(65, 115, "River 任务队列", 16, GREEN)
    rect(347, 87, 266, 65, SOFT, radius=11)
    txt(367, 115, "Go Worker", 16, GREEN)
    rect(650, 87, 265, 65, PALE_GOLD, radius=11)
    txt(670, 115, "云端 AI Provider", 16, GREEN)
    arrow(180, 292, 180, 254)
    arrow(478, 292, 478, 254)
    arrow(613, 221, 645, 221)
    arrow(180, 189, 180, 157)
    arrow(310, 119, 342, 119)
    arrow(613, 119, 645, 119)
    txt(43, 61, "当前服务器：Caddy + Docker Compose；百炼/通义（DashScope）与 AntDigital 适配；真实 AI 默认关闭。", 10, MUTED)


def draw_business():
    page_base(6, "商业模式", "订阅覆盖持续使用需求，Credits 对应模型消耗；企业增值能力按阶段推出。")
    for i, (title, audience, note) in enumerate([
        ("FREE", "体验与早期探索", "产品认知 / 素材管理"),
        ("PRO", "高频商家与设计师", "持续创作 / 透明消耗"),
        ("STUDIO", "品牌团队与工作室", "协作 / 更高使用规模"),
    ]):
        x = 43 + i * 299
        rect(x, 202, 281, 142, WHITE, radius=14)
        txt(x + 18, 307, title, 19, GREEN, "Helvetica-Bold")
        txt(x + 18, 272, audience, 13, INK)
        txt(x + 18, 238, note, 11, MUTED)
    rect(43, 100, 876, 72, GREEN, radius=13)
    txt(64, 143, "Credits 计费层", 15, PALE_GOLD)
    txt(64, 115, "按图片/视频/高阶模型区分消耗；失败释放预占，真实价格以服务端规则为准。", 13, WHITE)
    txt(43, 70, "云存储、团队账号、企业版为增值方向。正式售价、支付与退款尚未上线。", 11, MUTED)


def draw_roi():
    page_base(None, "投入产出：用真实试点建立财务证据", "当前没有供应商真实账单和客户基线，不提供未经验证的降本百分比或收入预测。")
    formulas = [
        ("单位可用图成本", "（模型 + 审核修正 + 存储交付）÷ 审核通过的图片数"),
        ("客户时间节省", "传统流程交付时间 − WEAVIA 流程交付时间"),
        ("平台贡献毛利", "订阅与 Credits 收入 − 模型/支付/存储等可变成本"),
    ]
    for i, (label, formula) in enumerate(formulas):
        y = 263 - i * 67
        rect(43, y, 876, 57, WHITE, radius=10)
        txt(61, y + 22, label, 14, GREEN)
        txt(270, y + 22, formula, 12, INK)
    txt(43, 68, "试点每周跟踪：样本 SKU、合格图率、单位成本、交付时长、失败率、Credits 差异、转化与复用。", 11, MUTED)


def draw_progress():
    page_base(7, "当前研发进度", "基础产品与技术底座已建立；商业闭环仍需跨过真实生成、支付和公开环境门禁。")
    rows = [
        ("产品规划 / 架构", "已形成", "三端 + Go API + Worker"),
        ("Web / 用户系统", "部分验收", "登录通过；SMTP 注册未通过"),
        ("Desktop 基础版", "已验收", "GUI 登录、资料、本地项目"),
        ("Admin / Credits", "基础可用", "用户查看与账本设计"),
        ("真实 AI / 支付", "未开放", "付费模型与交易闭环待验证"),
        ("公开生产访问", "未完成", "DNS / 公众信任证书待配置"),
    ]
    for i, (name, state, detail) in enumerate(rows):
        y = 303 - i * 43
        rule(43, y - 12, 918)
        txt(47, y + 3, name, 13, INK)
        chip(294, y - 4, state, "green" if state == "已验收" else "warn" if state in ("未开放", "未完成") else "light", 84)
        txt(409, y + 3, detail, 12, MUTED)
    txt(43, 57, "临时环境：build / lint / test / Go test / Docker 构建与核心访问路径通过；不等于完整 V1.0 发布。", 10, MUTED)


def draw_strengths():
    page_base(8, "技术优势", "在可控投入下，为多场景和多供应商保留扩展空间。")
    strengths = [
        ("01", "客户端优先", "本地项目与素材优先，减少不必要的云端同步与常驻存储。"),
        ("02", "供应商可替换", "Provider 适配层为多模型扩展保留空间；实际故障切换尚待建设。"),
        ("03", "本地数据优先", "项目、SKU 与结果可在用户电脑长期管理，来源区分 Mock 与真实。"),
        ("04", "商业基础前置", "账户、会员、Credits、任务与后台数据结构已布局，便于后续计费。"),
    ]
    for i, (num, title, body) in enumerate(strengths):
        col, row = i % 2, i // 2
        x, y = 43 + col * 451, 198 - row * 144
        rect(x, y, 425, 125, WHITE, radius=13)
        txt(x + 17, y + 90, num, 13, GOLD, "Helvetica-Bold")
        txt(x + 57, y + 88, title, 18, GREEN)
        para(x + 18, y + 57, body, 388, 11, 18, MUTED)


def draw_roadmap():
    page_base(9, "后续计划", "按门槛投资，而不是同时开启全部能力。")
    stages = [
        ("01", "商业 Demo", "选一个高频图片场景\n建立质量样本与成本账本", "客户愿意继续试用"),
        ("02", "真实 AI", "验证供应商调用、商品保真\n费用、失败恢复与作品落盘", "真实任务稳定可审核"),
        ("03", "收费版本", "定价、支付、退款\n正式安装包与运营支持", "转化、留存、毛利可追踪"),
        ("04", "企业客户", "团队协作与权限\n品牌模板、可选云存储", "标杆客户复购"),
    ]
    for i, (num, title, body, gate) in enumerate(stages):
        x = 43 + i * 223
        rect(x, 157, 208, 188, WHITE, radius=13)
        txt(x + 14, 313, num, 15, GOLD, "Helvetica-Bold")
        txt(x + 14, 277, title, 17, GREEN)
        para(x + 14, 245, body, 180, 10.5, 17, INK)
        txt(x + 14, 181, "门槛 / " + gate, 10, MUTED)
        if i < 3:
            arrow(x + 209, 245, x + 220, 245)
    txt(43, 109, "资源原则：先设小额模型调用上限与跨职能试点团队，阶段复盘后再扩展视频和企业能力。", 13, GREEN)
    txt(43, 70, "正式预算需以真实模型报价、团队工时和客户试点数据编制。", 11, MUTED)


def draw_closing():
    page_base(10, "项目价值总结", dark=True)
    txt(45, 347, "从商品内容工具，", 36, WHITE)
    txt(45, 296, "走向电商创作基础设施。", 36, PALE_GOLD)
    para(47, 245, "以商品为中心沉淀素材与创作配方；以 AI 扩展视觉供给；以任务、Credits 和后台建立可核算的交付体系。", 770, 16, 27, WHITE)
    rect(45, 101, 868, 78, GREEN2, radius=13)
    txt(65, 145, "建议管理决策", 13, PALE_GOLD)
    txt(65, 117, "批准有预算上限的单场景商业 Demo，并以可用图质量、成本和客户复用率作为继续投入条件。", 14, WHITE)
    txt(45, 70, "“中国领先平台”是长期愿景，不代表当前市场地位。", 10, HexColor("#C5D0C8"))


def draw_sources():
    page_base(None, "资料来源与证据口径", "截至 2026-10-13；外部数据仅用于判断趋势，不直接推导收入。")
    txt(44, 339, "仓库一手资料", 17, GREEN)
    para(44, 309, "README、docs/ARCHITECTURE、docs/PROGRESS、Desktop V2 计划、商业平台 V1 方案、Sprint 2 与 Sprint 3 报告、临时环境验收报告、生产就绪审计，以及 Web / Desktop / Admin / Go Backend 代码。", 840, 11, 18, INK)
    txt(44, 235, "外部市场资料", 17, GREEN)
    para(44, 205, "国家统计局：2025 年国民经济运行数据（网上零售额）。\nhttps://www.stats.gov.cn/xxgk/sjfb/zxfb2020/202601/t20260119_1962323.html", 840, 10, 17, INK)
    para(44, 149, "CNNIC：第 57 次中国互联网络发展状况统计报告（生成式 AI 用户）。\nhttps://www3.cnnic.cn/n4/2026/0304/c88-11549.html", 840, 10, 17, INK)
    txt(44, 83, "截图是阶段性产品界面；不是付费模型生成结果。ROI 为测算方法，尚无经营实绩。", 11, WARN)


DRAW = {
    "cover": draw_cover,
    "executive": draw_executive,
    "toc": draw_toc,
    "overview": draw_overview,
    "market": draw_market,
    "product": draw_product,
    "features": draw_features,
    "screens": draw_screens,
    "flow": draw_flow,
    "architecture": draw_architecture,
    "business": draw_business,
    "roi": draw_roi,
    "progress": draw_progress,
    "strengths": draw_strengths,
    "roadmap": draw_roadmap,
    "closing": draw_closing,
    "sources": draw_sources,
}


for PAGE_NO, (key, chapter_num, title) in enumerate(PAGES, start=1):
    if chapter_num is not None:
        c.bookmarkPage(f"chapter{chapter_num}")
        c.addOutlineEntry(f"第{chapter_num}章 {title}", f"chapter{chapter_num}", level=0)
    DRAW[key]()
    c.showPage()
c.save()
print(OUTPUT)
