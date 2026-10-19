import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import manifest from './data/portfolio-content.json';
import { DecoderText } from './components/DecoderText';
import { FluidOrb } from './components/FluidOrb';
import { RouteCurtain } from './components/RouteCurtain';
import './styles.css';

const ProjectGalleryCanvas = lazy(() => import('./components/ProjectGalleryCanvas'));

const projectDefinitions = [
  {
    id: 'journal', number: '01', kind: 'UX PRACTICE',
    title: '《恋与深空》手账系统交互优化',
    subtitle: '降低创作门槛，并让编辑过程获得更明确的安全感与角色陪伴反馈',
    range: [4, 12], role: '独立交互设计练习', accent: '#54d5ee',
  },
  {
    id: 'equipment', number: '02', kind: 'SYSTEM DESIGN',
    title: '装备养成玩法全链路交互设计',
    subtitle: '围绕锻造、精炼与穿戴，梳理资源选择、反馈、异常状态与可逆路径',
    range: [13, 24], role: '独立交互设计练习', accent: '#a69de3',
  },
  {
    id: 'nsh', number: '03', kind: 'SHIPPED WORK',
    title: '《逆水寒》游戏交互落地',
    subtitle: '从需求拆解到资源规范和客户端对接，呈现跨部门协作与实现取舍',
    range: [25, 28], role: '网易雷火祝融工作室｜交互设计实习生', accent: '#efb866',
  },
  {
    id: 'event', number: '04', kind: 'UX PRACTICE',
    title: '二次元限时运营活动页交互练习',
    subtitle: '在弹窗布局约束下，提高回访效率并补齐奖励、时效与异常反馈',
    range: [29, 32], role: '独立交互设计练习', accent: '#ff8e9e',
  },
  {
    id: 'additional', number: '05', kind: 'ADDITIONAL WORKS',
    title: '其他设计实践',
    subtitle: '引擎场景搭建、简单动画与板绘练习',
    range: [33, 35], role: '个人实践', accent: '#8dc9bd',
  },
];

const slideTitles = {
  4: '《恋与深空》手账系统交互优化', 5: '项目分析框架', 6: '为什么要优化手账？',
  7: '创作入口优化：从空白画布到表达载体', 8: '从素材检索到创作意图驱动',
  9: '连续创作体验优化', 10: '创作状态可感知化', 11: '让角色感知玩家表达', 12: '项目复盘',
  13: '养成全链路交互设计练习', 14: '设计目标', 15: '任务流程',
  16: '养成全链路：锻造、精炼、穿戴', 17: '操作路径优化：让高频操作更短',
  18: '资源管理：降低选择与决策成本', 19: '锻造玩法与结果反馈',
  20: '状态反馈：让每一步操作都有结果', 21: '风险控制：减少误触与高价值操作失误',
  22: '空间管理：操作效率与视觉展示的平衡', 23: '穿戴玩法：全局结构',
  24: '穿戴玩法：沉浸与可逆', 25: '《逆水寒》游戏交互落地', 26: '我的工作流程',
  27: '炼金鉴宝模块｜交互文档', 28: '兵符台模块｜交互文档',
  29: '二次元限时运营活动页交互练习', 30: '题目背景与设计目标',
  31: '布局判断与信息层级', 32: '任务链路与异常场景处理', 33: '其他项目',
  34: '引擎项目：场景搭建与简单动画', 35: '板绘练习',
};

const slideRenderVersion = 'pdf-20261018';
const versionedSlide = src => `${src}?v=${slideRenderVersion}`;

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'home';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const handler = () => setRoute(read());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

function ThemeToggle({ theme, toggleTheme }) {
  const nextTheme = theme === 'light' ? '黑夜' : '白天';
  return (
    <label className="theme-toggle" title={`切换为${nextTheme}模式`}>
      <input type="checkbox" role="switch" checked={theme === 'dark'} onChange={toggleTheme} aria-label={`切换为${nextTheme}模式`} />
      <span aria-hidden="true" />
    </label>
  );
}

function CursorLens() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const root = document.documentElement;
    const lens = document.querySelector('.cursor-lens');
    root.classList.add('has-custom-cursor');
    const move = event => {
      lens.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0) translate(-50%,-50%)`;
      root.classList.add('cursor-active');
    };
    const over = event => root.classList.toggle('cursor-hover', Boolean(event.target.closest('a, button, [role="button"], input')));
    const pause = () => root.classList.remove('cursor-active');
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('mouseleave', pause);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      root.classList.remove('has-custom-cursor', 'cursor-active', 'cursor-hover');
      window.removeEventListener('pointermove', move); document.removeEventListener('pointerover', over); document.removeEventListener('mouseleave', pause);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return <i className="cursor-lens" aria-hidden="true" />;
}

function RevealText({ text }) {
  return <span className="block-reveal" aria-label={text}>{[...text].map((char, index) => <span aria-hidden="true" key={`${char}-${index}`} style={{ '--reveal-index': index }}>{char === ' ' ? '\u00a0' : char}</span>)}</span>;
}

function Header({ onMenu, menuOpen = false, theme, toggleTheme, dark = false }) {
  return (
    <header className={`site-header ${dark ? 'site-header--dark' : ''}`}>
      <a className="monogram" href="#/home" aria-label="返回首页">YJX<span>.</span></a>
      <nav aria-label="主导航">
        <a href="#/home?section=work">项目</a>
        <a href="#/home?section=about">关于</a>
        <a href="mailto:2474176580@qq.com">联系</a>
      </nav>
      <div className="site-header__actions">
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        <button className={`menu-button ${menuOpen ? 'menu-button--open' : ''}`} type="button" onClick={onMenu} aria-label={menuOpen ? '关闭项目目录' : '打开项目目录'} aria-expanded={menuOpen}>
          <span className="menu-button__label"><i>目录</i><i>关闭</i></span><span className="menu-button__icon" aria-hidden="true"><i /><i /></span>
        </button>
      </div>
    </header>
  );
}

function ProjectDrawer({ open, close }) {
  const panelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector('button, a')?.focus(), 460);
    const keydown = event => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button, a[href]')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      window.clearTimeout(focusTimer); document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open, close]);
  return (
    <div className={`drawer ${open ? 'drawer--open' : ''}`} aria-hidden={!open}>
      <button className="drawer__scrim" aria-label="关闭目录" onClick={close} />
      <i className="drawer__wipe drawer__wipe--cyan" aria-hidden="true" />
      <i className="drawer__wipe drawer__wipe--lavender" aria-hidden="true" />
      <aside ref={panelRef} className="drawer__panel" aria-label="项目目录" role="dialog" aria-modal="true">
        <div className="drawer__top"><span>SELECTED WORK</span><button onClick={close}>关闭 <b aria-hidden="true">×</b></button></div>
        <nav className="drawer__links" aria-label="全部项目">
          {projectDefinitions.map((project, index) => (
            <a key={project.id} href={`#/project/${project.id}`} onClick={close} style={{ '--menu-index': index }} tabIndex={open ? 0 : -1}>
              <span>{project.number}</span><strong>{project.title}</strong><i aria-hidden="true">↗</i>
            </a>
          ))}
        </nav>
        <div className="drawer__meta"><span>GAME UX · INTERACTION DESIGN</span><a href="mailto:2474176580@qq.com">2474176580@qq.com</a></div>
      </aside>
    </div>
  );
}

const titleMotion = [
  { y: '-1.35em', rotate: '-14deg', delay: '0ms' },
  { y: '1.25em', rotate: '12deg', delay: '90ms' },
  { y: '-1.1em', rotate: '9deg', delay: '35ms' },
  { y: '1.4em', rotate: '-16deg', delay: '145ms' },
];

function AnimatedTitleLine({ text, line }) {
  return (
    <span aria-hidden="true" className={`hero__title-line hero__title-line--${line}`}>
      {[...text].map((character, index) => {
        const motion = titleMotion[(index + line) % titleMotion.length];
        return (
          <span
            className="hero__title-char"
            key={`${line}-${character}-${index}`}
            style={{ '--char-y': motion.y, '--char-rotate': motion.rotate, '--char-delay': `calc(${motion.delay} + ${line * 120}ms)` }}
          >
            {character}
          </span>
        );
      })}
    </span>
  );
}

const burstPieces = [
  ['line', '-20em', '-6.8em', '-24deg', '40ms'],
  ['dot', '-16em', '6.5em', '0deg', '130ms'],
  ['square', '-9.5em', '-9em', '24deg', '70ms'],
  ['star', '-4em', '9.5em', '-12deg', '190ms'],
  ['line', '5em', '-9em', '58deg', '115ms'],
  ['dot', '11.5em', '7.4em', '0deg', '30ms'],
  ['square', '17em', '-6.2em', '-32deg', '165ms'],
  ['star', '21em', '2.2em', '18deg', '90ms'],
  ['line', '9em', '10.5em', '-62deg', '220ms'],
  ['dot', '-21em', '-.8em', '0deg', '245ms'],
  ['square', '18em', '10em', '42deg', '205ms'],
  ['line', '-8em', '11em', '18deg', '150ms'],
];

function TitleBurst() {
  return (
    <div className="title-burst" aria-hidden="true">
      {burstPieces.map(([type, x, y, rotate, delay], index) => (
        <i key={`${type}-${index}`} className={`title-burst__piece title-burst__piece--${type}`} style={{ '--burst-x': x, '--burst-y': y, '--burst-rotate': rotate, '--burst-delay': delay }} />
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <FluidOrb />
      <div className="hero__ambient hero__ambient--one" />
      <div className="hero__ambient hero__ambient--two" />
      <div className="hero__copy">
        <p className="eyebrow hero-reveal hero-reveal--eyebrow">
          <DecoderText text="GAME UX · INTERACTION DESIGN" delay={250} />
        </p>
        <div className="hero__title-stage">
          <TitleBurst />
          <h1 aria-label="游戏交互设计师">
            <AnimatedTitleLine text="游戏交互" line={0} />
            <AnimatedTitleLine text="设计师" line={1} />
          </h1>
        </div>
        <p className="hero__statement hero-reveal hero-reveal--intro">让复杂的游戏系统变得可理解、可操作</p>
        <a className="text-link hero-reveal hero-reveal--link" href="#/home?section=work">查看项目 <span>↘</span></a>
      </div>
      <div className="hero__index" aria-hidden="true"><span>PORTFOLIO</span><strong>2026</strong></div>
      <div className="hero__scroll" aria-hidden="true"><i /> SCROLL TO EXPLORE</div>
    </section>
  );
}

function getGalleryMode() {
  if (typeof window === 'undefined') return 'static';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const webgl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
  const lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
  if (reduced || !webgl) return 'static';
  if (mobile || lowCpu || lowMemory) return 'css';
  return 'webgl';
}

function StaticProjectList() {
  return (
    <div className="project-list project-list--static">
      {projectDefinitions.map((project, index) => (
        <a className="project-row" href={`#/project/${project.id}`} key={project.id} style={{ '--accent': project.accent }}>
          <span className="project-row__number">{project.number}</span>
          <div className="project-row__copy"><span>{project.kind}</span><h3>{project.title}</h3><p>{project.subtitle}</p></div>
          <div className="project-row__preview"><img src={`/previews/project-${project.id}.webp`} alt="" loading={index > 1 ? 'lazy' : 'eager'} /></div>
          <span className="project-row__arrow" aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}

function ProjectList() {
  const sectionRef = useRef(null);
  const progressRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const invalidateRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState(getGalleryMode);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const handleGalleryFailure = useCallback(() => setMode('css'), []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const responsive = window.matchMedia('(max-width: 760px), (pointer: coarse)');
    const updateMode = () => setMode(getGalleryMode());
    media.addEventListener('change', updateMode);
    responsive.addEventListener('change', updateMode);
    return () => { media.removeEventListener('change', updateMode); responsive.removeEventListener('change', updateMode); };
  }, []);
  useEffect(() => {
    if (mode === 'static' || !sectionRef.current) return undefined;
    const observer = new IntersectionObserver(entries => setGalleryVisible(entries[0]?.isIntersecting ?? false));
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [mode]);
  useEffect(() => {
    if (mode === 'static' || !sectionRef.current) return undefined;
    let frame = 0; let lastIndex = -1;
    const update = () => {
      const section = sectionRef.current;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - innerHeight);
      const progress = Math.max(0, Math.min(projectDefinitions.length - 1, (-rect.top / distance) * (projectDefinitions.length - 1)));
      progressRef.current = progress;
      invalidateRef.current?.();
      const nextIndex = Math.max(0, Math.min(projectDefinitions.length - 1, Math.round(progress)));
      if (nextIndex !== lastIndex) { lastIndex = nextIndex; setActiveIndex(nextIndex); }
      frame = 0;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [mode]);

  const onPointerMove = event => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: ((event.clientX - rect.left) / rect.width - .5) * 2, y: ((event.clientY - rect.top) / rect.height - .5) * -2, active: true };
    invalidateRef.current?.();
    event.currentTarget.style.setProperty('--magnetic-x', `${pointerRef.current.x * 10}px`);
    event.currentTarget.style.setProperty('--magnetic-y', `${pointerRef.current.y * -7}px`);
  };
  const onPointerLeave = event => {
    pointerRef.current = { x: 0, y: 0, active: false };
    invalidateRef.current?.();
    event.currentTarget.style.setProperty('--magnetic-x', '0px'); event.currentTarget.style.setProperty('--magnetic-y', '0px');
  };

  return (
    <section ref={sectionRef} className={`work ${mode === 'static' ? 'work--static' : `work--gallery work--gallery-${mode}`}`} id="work" style={{ '--project-count': projectDefinitions.length }}>
      {mode === 'static' ? <><div className="section-heading"><p className="eyebrow">SELECTED WORK</p><h2>从个人练习到上线协作</h2></div><StaticProjectList /></> : (
        <div className="project-gallery__stage">
          <div className="project-gallery__heading"><p className="eyebrow">SELECTED WORK</p><h2>从个人练习到上线协作</h2><span>{String(activeIndex + 1).padStart(2, '0')} / {String(projectDefinitions.length).padStart(2, '0')}</span></div>
          {mode === 'css' && <div className="project-gallery__css-images" aria-hidden="true">{projectDefinitions.map((project, index) => <img key={project.id} className={index === activeIndex ? 'is-active' : ''} src={`/previews/project-${project.id}.webp`} alt="" />)}</div>}
          {mode === 'webgl' && galleryVisible && <Suspense fallback={null}><ProjectGalleryCanvas projects={projectDefinitions} progressRef={progressRef} pointerRef={pointerRef} invalidateRef={invalidateRef} onFailure={handleGalleryFailure} /></Suspense>}
          <div className="project-gallery__cards">
            {projectDefinitions.map((project, index) => {
              const active = index === activeIndex;
              return (
                <a className={`project-gallery__card ${active ? 'is-active' : ''}`} href={`#/project/${project.id}`} key={project.id} style={{ '--accent': project.accent }} aria-hidden={!active} tabIndex={active ? 0 : -1} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
                  <span className="project-gallery__number">{project.number}</span>
                  <div className="project-gallery__copy"><small>{project.kind}</small><h3>{project.title}</h3><p>{project.subtitle}</p></div>
                  <span className="project-gallery__arrow" aria-hidden="true">↗</span>
                </a>
              );
            })}
          </div>
          <div className="project-gallery__scroll" aria-hidden="true"><i /><span>SCROLL TO SELECT</span></div>
        </div>
      )}
    </section>
  );
}

function TopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => { setVisible(window.scrollY > window.innerHeight * .72); frame = 0; };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
  }, []);
  const goTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return <button className={`top-button ${visible ? 'is-visible' : ''}`} type="button" onClick={goTop} aria-label="返回网页顶部"><span>TOP</span><i aria-hidden="true">↑</i></button>;
}

function About() {
  return (
    <section className="about" id="about">
      <div>
        <p className="eyebrow">ABOUT & EXPERIENCE</p>
        <h2>设计方案需要同时面对玩家体验与工程现实</h2>
      </div>
      <div className="about__body">
        <p>广州美术学院数字媒体艺术本科在读。曾在网易雷火祝融工作室参与《逆水寒》游戏模块交互设计，负责需求拆解、交互文档、资源规范对齐、客户端评审与版本走查。</p>
        <dl>
          <div><dt>方向</dt><dd>游戏交互设计、交互策划（UE）</dd></div>
          <div><dt>工具</dt><dd>Figma、Photoshop、AI、Unity、Scaleform、Flash</dd></div>
          <div><dt>能力</dt><dd>交互文档、跨部门协作</dd></div>
        </dl>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <footer className="contact">
      <p className="eyebrow">LET'S TALK</p>
      <h2>THANK YOU</h2>
      <a href="mailto:2474176580@qq.com">2474176580@qq.com <span>↗</span></a>
      <p className="contact__note">© 2026 杨静熙 · <a href="/THIRD_PARTY_NOTICES.txt" target="_blank">开源许可</a></p>
    </footer>
  );
}

function Home({ openMenu, menuOpen, route, theme, toggleTheme }) {
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting));
    }, { threshold: 0.12 });
    document.querySelectorAll('.project-row, .section-heading, .about').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    if (reduced || mobile) return undefined;
    let frame = 0;
    const update = () => {
      document.querySelectorAll('.project-row').forEach(row => {
        const rect = row.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight));
        row.style.setProperty('--parallax', `${progress * -38}px`);
        row.style.setProperty('--row-shift', `${Math.abs(progress) * 10}px`);
      });
      frame = 0;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  useEffect(() => {
    const section = new URLSearchParams(route.split('?')[1] || '').get('section');
    const timers = [];
    if (section) [80, 420].forEach(delay => timers.push(window.setTimeout(() => document.getElementById(section)?.scrollIntoView(), delay)));
    else window.scrollTo({ top: 0 });
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [route]);
  return <><Header onMenu={openMenu} menuOpen={menuOpen} theme={theme} toggleTheme={toggleTheme} /><main><Hero /><ProjectList /><About /></main><Contact /><TopButton /></>;
}

function Lightbox({ src, alt, close }) {
  useEffect(() => {
    const handler = event => event.key === 'Escape' && close();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="原始页面大图">
      <button className="lightbox__close" onClick={close}>关闭 ESC</button>
      <button className="lightbox__backdrop" onClick={close} aria-label="关闭图片" />
      <img src={src} alt={alt} />
    </div>
  );
}

function SlideSection({ slide, project, setLightbox }) {
  const heading = slideTitles[slide.number] || `原始方案第 ${slide.number} 页`;
  const videos = slide.media
    .map(filename => manifest.media.find(item => item.filename === filename))
    .filter(item => item?.extension === '.mp4');
  return (
    <section className="story-section" id={`slide-${slide.number}`} style={{ '--accent': project.accent }}>
      <div className="story-section__text">
        <span className="slide-label">SOURCE {String(slide.number).padStart(2, '0')}</span>
        <h2><RevealText text={heading} /></h2>
      </div>
      <figure className="source-figure">
        <button type="button" onClick={() => setLightbox({ src: versionedSlide(slide.render), alt: `PPT 第 ${slide.number} 页原始版面` })}>
          <img src={versionedSlide(slide.render)} alt={`PPT 第 ${slide.number} 页原始版面`} loading="lazy" width="1920" height="1080" />
          <span>点击放大 · 查看原始版面</span>
        </button>
      </figure>
      {videos.map(video => (
        <video key={video.filename} className="project-video" controls preload="metadata">
          <source src={video.path} type="video/mp4" />
          浏览器不支持视频播放。
        </video>
      ))}
    </section>
  );
}

function ProjectPage({ project, openMenu, menuOpen, route, theme, toggleTheme }) {
  const [lightbox, setLightbox] = useState(null);
  const slides = useMemo(() => manifest.slides.filter(slide => slide.number >= project.range[0] && slide.number <= project.range[1]), [project]);
  const index = projectDefinitions.findIndex(item => item.id === project.id);
  const previous = projectDefinitions[(index - 1 + projectDefinitions.length) % projectDefinitions.length];
  const next = projectDefinitions[(index + 1) % projectDefinitions.length];
  useEffect(() => {
    const section = new URLSearchParams(route.split('?')[1] || '').get('section');
    const timers = [];
    if (section) [80, 420, 900].forEach(delay => timers.push(window.setTimeout(() => document.getElementById(section)?.scrollIntoView(), delay)));
    else window.scrollTo({ top: 0 });
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [route]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting)), { threshold: .18 });
    document.querySelectorAll('.story-section').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [project.id]);
  return (
    <div className="project-page">
      <Header onMenu={openMenu} menuOpen={menuOpen} theme={theme} toggleTheme={toggleTheme} />
      <main>
        <section className="project-hero" style={{ '--accent': project.accent }}>
          <p className="eyebrow">{project.kind} · {project.number}</p>
          <h1>{project.title}</h1>
          <p>{project.subtitle}</p>
          <dl><div><dt>我的角色</dt><dd>{project.role}</dd></div><div><dt>原始范围</dt><dd>PPT {project.range[0]}–{project.range[1]} 页</dd></div></dl>
          <a href={`#/project/${project.id}?section=project-content`} className="text-link">开始阅读 <span>↓</span></a>
        </section>
        <div className="project-layout" id="project-content">
          <aside className="project-toc" aria-label="本项目页码目录">
            <a href="#/home">← 返回首页</a>
            <p>PROJECT CONTENT</p>
            {slides.map(slide => <a key={slide.number} href={`#/project/${project.id}?section=slide-${slide.number}`}>{String(slide.number).padStart(2, '0')}</a>)}
          </aside>
          <article>{slides.map(slide => <SlideSection key={slide.number} slide={slide} project={project} setLightbox={setLightbox} />)}</article>
        </div>
        <nav className="project-pagination" aria-label="相邻项目">
          <a href={`#/project/${previous.id}`}><span>上一个项目</span><strong>← {previous.title}</strong></a>
          <a href={`#/project/${next.id}`}><span>下一个项目</span><strong>{next.title} →</strong></a>
        </nav>
      </main>
      {lightbox && <Lightbox {...lightbox} close={() => setLightbox(null)} />}
    </div>
  );
}

function App() {
  const route = useHashRoute();
  const [theme, setTheme] = useState(() => localStorage.getItem('portfolio-theme') || 'light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [transition, setTransition] = useState({ active: false, direction: 'forward', id: 0 });
  const projectId = route.startsWith('project/') ? route.split('/')[1].split('?')[0] : null;
  const project = projectDefinitions.find(item => item.id === projectId);
  const routeKey = project ? `project-${project.id}` : 'home';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b1118' : '#f4f4f2');
    localStorage.setItem('portfolio-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(current => current === 'light' ? 'dark' : 'light');
  const toggleMenu = useCallback(() => setMenuOpen(current => !current), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useEffect(() => {
    const clickHandler = event => {
      const anchor = event.target.closest('a[href^="#/"]');
      if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const targetHash = anchor.getAttribute('href');
      const targetRoute = targetHash.replace(/^#\/?/, '');
      const targetProjectId = targetRoute.startsWith('project/') ? targetRoute.split('/')[1].split('?')[0] : null;
      const targetKey = targetProjectId ? `project-${targetProjectId}` : 'home';
      if (targetKey === routeKey || transition.active) return;
      event.preventDefault();
      const direction = routeKey === 'home' ? 'forward' : 'backward';
      const id = transition.id + 1;
      setTransition({ active: true, direction, id });
      window.setTimeout(() => { window.location.hash = targetHash.slice(1); }, 760);
      window.setTimeout(() => { setTransition(current => ({ ...current, active: false })); }, 1620);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  }, [routeKey, transition]);
  return (
    <>
      <CursorLens />
      {project ? <ProjectPage project={project} route={route} openMenu={toggleMenu} menuOpen={menuOpen} theme={theme} toggleTheme={toggleTheme} /> : <Home route={route} openMenu={toggleMenu} menuOpen={menuOpen} theme={theme} toggleTheme={toggleTheme} />}
      <RouteCurtain {...transition} transitionId={transition.id} />
      <ProjectDrawer open={menuOpen} close={closeMenu} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
