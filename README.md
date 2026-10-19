# 杨静熙｜游戏交互设计作品集

本项目是一个本地 React/Vite 静态作品集。内容以原始 PPT 为权威来源，首页与项目详情共用同一份内容清单。

首页使用 Three.js/GLSL 流体视觉、文字解码、分段入场、页面遮罩转场和滚动视差。移动端、低性能设备和 `prefers-reduced-motion` 环境自动切换为静态渐变或关闭位移动画。

## 本地运行

```powershell
pnpm install
pnpm run dev
```

浏览器打开 `http://localhost:5173/`。

## 检查与构建

```powershell
pnpm run validate
pnpm run build
```

`validate` 会核对 36 张幻灯片、107 个媒体资源、逐页视觉基准和手机号泄露。生产文件输出到 `dist/`。

## 内容结构

- `src/data/portfolio-content.json`：从 PPT 生成的文字、页码和媒体关系清单。
- `public/slides/`：逐页视觉基准，用于保留复杂流程图与交互文档版面。
- `public/source-media/`：PPT 内的原始媒体资源，包括两段项目视频。
- `tools/import-ppt.py`：从源 PPT 重新生成内容清单和媒体资源。

原始 PPT 不在仓库内，导入工具不会覆盖源文件。网站视觉参考 Hamish Williams 的开源作品集，但本站的结构、样式与代码均为独立实现。

参考来源、MIT 许可与设计致谢见 `THIRD_PARTY_NOTICES.md`。
