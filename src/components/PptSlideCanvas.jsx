import { useState } from 'react';

const alignments = { ctr: 'center', r: 'right', just: 'justify', dist: 'justify' };

function fontStack(name = '') {
  if (/210 8|pixel|mono/i.test(name)) return 'Consolas, "Courier New", monospace';
  return '"Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif';
}

function positionStyle(element) {
  const { box } = element;
  return {
    left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`,
    zIndex: element.z + 1,
    transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
  };
}

function fillStyle(fill) {
  return fill?.kind === 'solid' ? fill.color : 'transparent';
}

function runFontSize(run, slideWidth) {
  const sourceSize = run.fontSize || 18;
  const fitScale = sourceSize <= 24 ? .72 : sourceSize <= 40 ? .9 : 1;
  return `${((sourceSize * fitScale) / (slideWidth / 12700)) * 100}cqw`;
}

function ImageElement({ element, openImage }) {
  const crop = element.fill.crop || {};
  const visibleWidth = Math.max(1, 100 - (crop.l || 0) - (crop.r || 0));
  const visibleHeight = Math.max(1, 100 - (crop.t || 0) - (crop.b || 0));
  const imageStyle = {
    width: `${10000 / visibleWidth}%`, height: `${10000 / visibleHeight}%`,
    left: `${-(crop.l || 0) / visibleWidth * 100}%`, top: `${-(crop.t || 0) / visibleHeight * 100}%`,
  };
  return (
    <button
      className="ppt-element ppt-element--image"
      style={positionStyle(element)}
      type="button"
      onClick={() => openImage({ src: element.fill.src, alt: element.name || 'PPT 原始图片资源' })}
      aria-label={`放大查看：${element.name || element.fill.filename}`}
    >
      <img src={element.fill.src} alt="" loading="lazy" style={imageStyle} />
    </button>
  );
}

function ShapeElement({ element }) {
  const fill = fillStyle(element.fill);
  const stroke = element.line?.color || 'none';
  const strokeWidth = element.line?.width || 0;
  if (element.customPath) {
    return (
      <svg className="ppt-element ppt-element--shape" style={positionStyle(element)} viewBox={element.customPath.viewBox} preserveAspectRatio="none" aria-hidden="true">
        <path d={element.customPath.path} fill={fill} stroke={stroke} strokeWidth={strokeWidth * 12700} />
      </svg>
    );
  }
  const geometryStyle = {
    ...positionStyle(element),
    background: fill,
    border: element.line ? `${Math.max(.5, strokeWidth)}px solid ${stroke}` : undefined,
    borderRadius: element.geometry === 'ellipse' ? '50%' : element.geometry === 'roundRect' ? '8%' : undefined,
  };
  return <div className="ppt-element ppt-element--shape" style={geometryStyle} aria-hidden="true" />;
}

function TextElement({ element, slideWidth }) {
  const padding = element.textBox || {};
  const vertical = element.textBox?.anchor === 'ctr' ? 'center' : element.textBox?.anchor === 'b' ? 'flex-end' : 'flex-start';
  return (
    <div
      className="ppt-element ppt-element--text"
      style={{
        ...positionStyle(element),
        background: fillStyle(element.fill),
        border: element.line ? `${Math.max(.5, element.line.width)}px solid ${element.line.color}` : undefined,
        padding: `${padding.top || 0}% ${padding.right || 0}% ${padding.bottom || 0}% ${padding.left || 0}%`,
        justifyContent: vertical,
      }}
    >
      {element.paragraphs.map((paragraph, paragraphIndex) => (
        <p key={`${element.id}-${paragraphIndex}`} style={{ textAlign: alignments[paragraph.align] || 'left' }}>
          {paragraph.runs.map((run, runIndex) => (
            <span
              key={`${element.id}-${paragraphIndex}-${runIndex}`}
              style={{
                color: run.color || '#000',
                fontFamily: fontStack(run.fontFamily),
                fontSize: runFontSize(run, slideWidth),
                fontWeight: run.bold || /Bold/i.test(run.fontFamily || '') ? 700 : 400,
                fontStyle: run.italic ? 'italic' : 'normal',
              }}
            >{run.text}</span>
          ))}
        </p>
      ))}
    </div>
  );
}

export function PptSlideCanvas({ scene, fallback, openImage }) {
  const [zoom, setZoom] = useState(1);
  const changeZoom = value => setZoom(Math.min(2, Math.max(1, Number(value.toFixed(2)))));
  return (
    <div className="ppt-canvas-block">
      <div className="ppt-canvas-toolbar" aria-label="幻灯片缩放控制">
        <button type="button" onClick={() => setZoom(1)} aria-pressed={zoom === 1}>适应宽度</button>
        <button type="button" onClick={() => changeZoom(zoom - .25)} aria-label="缩小">−</button>
        <output>{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => changeZoom(zoom + .25)} aria-label="放大">＋</button>
        <button type="button" onClick={() => openImage({ src: fallback, alt: `PPT 第 ${scene.number} 页完整原页` })}>查看完整原页</button>
      </div>
      <div className="ppt-canvas-scroll" tabIndex="0" aria-label={`PPT 第 ${scene.number} 页可缩放画布`}>
        <div className="ppt-slide-stage" style={{ width: `${zoom * 100}%`, aspectRatio: `${scene.width} / ${scene.height}` }}>
          {scene.elements.map(element => {
            if (element.kind === 'image') return <ImageElement key={`${element.id}-${element.z}`} element={element} openImage={openImage} />;
            if (element.kind === 'text') return <TextElement key={`${element.id}-${element.z}`} element={element} slideWidth={scene.width} />;
            return <ShapeElement key={`${element.id}-${element.z}`} element={element} />;
          })}
        </div>
      </div>
    </div>
  );
}
