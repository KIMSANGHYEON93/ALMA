"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Scroll-triggered animation hook
// ---------------------------------------------------------------------------
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView(0.3);
  useEffect(() => {
    if (!inView) return;
    let frame: number;
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ---------------------------------------------------------------------------
// Ontology graph animation (Hero background)
// ---------------------------------------------------------------------------
function OntologyGraphBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; color: string }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth * 2; canvas.height = canvas.offsetHeight * 2; };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#0EA5E9", "#22D3EE", "#059669", "#38BDF8", "#67E8F9"];
    for (let i = 0; i < 40; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 4 + 2,
        color: colors[i % colors.length],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(14,165,233,${0.15 * (1 - dist / 200)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      // nodes
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Feature tabs data
// ---------------------------------------------------------------------------
const features = [
  {
    id: "chat",
    label: "대화",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    title: "맥락을 기억하는 AI 대화",
    desc: "모든 대화를 벡터화하여 기억합니다. 과거 맥락이 자동으로 주입되어 한 번 말한 것은 다시 설명할 필요 없습니다.",
    mockup: (
      <div className="space-y-3 text-sm">
        <div className="flex justify-end"><div className="bg-sky-500 text-white px-4 py-2 rounded-2xl rounded-br-md max-w-xs">지난주 운동 루틴 바꾸려고 했잖아, 어떻게 됐어?</div></div>
        <div className="flex justify-start"><div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-md max-w-xs text-gray-800 dark:text-gray-200">3월 10일 대화에서 주 3회 러닝으로 바꾸겠다고 하셨죠. 이번 주 체크인 기록을 보니 2회 완료하셨어요. 내일 한 번 더 하시면 목표 달성이에요!</div></div>
      </div>
    ),
  },
  {
    id: "habits",
    label: "습관",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "습관 추적 & 분석",
    desc: "일일 체크인, 스트릭, 히트맵, 트렌드 차트. AI가 습관 간 상관관계를 분석하고 코칭합니다.",
    mockup: (
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">아침 러닝 30분</span>
          <span className="ml-auto text-xs text-orange-500 font-medium">12일 연속</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center text-sm">○</div>
          <span className="text-sm text-gray-600 dark:text-gray-400">영어 듣기 20분</span>
        </div>
        <div className="flex gap-1 mt-2">{Array.from({length: 14}).map((_, i) => <div key={i} className={`w-4 h-4 rounded-sm ${i < 10 ? "bg-emerald-400" : i < 12 ? "bg-emerald-200" : "bg-gray-200 dark:bg-gray-700"}`} />)}</div>
      </div>
    ),
  },
  {
    id: "goals",
    label: "목표",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" strokeWidth={1.5} /><circle cx="12" cy="12" r="6" strokeWidth={1.5} /><circle cx="12" cy="12" r="2" strokeWidth={1.5} />
      </svg>
    ),
    title: "목표 관리 & 마일스톤",
    desc: "목표를 설정하고 마일스톤으로 나누어 추적합니다. 대화에서 자연스럽게 목표를 생성하고 진행률을 확인합니다.",
    mockup: (
      <div className="space-y-3">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">토익 900점 달성</span><span className="text-xs text-sky-700">65%</span></div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-sky-500 rounded-full" style={{width: "65%"}} /></div>
          <div className="flex gap-2 mt-2 text-xs text-gray-600 dark:text-gray-400"><span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 rounded text-sky-700 dark:text-sky-400">커리어</span><span>D-45</span></div>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">10km 마라톤 완주</span><span className="text-xs text-emerald-700">80%</span></div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width: "80%"}} /></div>
        </div>
      </div>
    ),
  },
  {
    id: "insights",
    label: "인사이트",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7zM9 21h6" />
      </svg>
    ),
    title: "AI 인사이트 & 회고",
    desc: "주간 회고를 자동 생성하고, 그래프 분석으로 숨겨진 패턴을 발견합니다. 행동 제안까지 자동으로.",
    mockup: (
      <div className="space-y-3">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-sky-50 dark:bg-sky-900/20 rounded-full text-sky-700 dark:text-sky-400">주제 트렌드</span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">운동과 수면 품질의 강한 양의 상관관계 발견</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">러닝을 한 날 수면 점수가 평균 23% 높았습니다.</p>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-600 dark:text-emerald-400">추천</span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">영어 공부 시간을 오전으로 변경 제안</p>
        </div>
      </div>
    ),
  },
  {
    id: "ontology",
    label: "온톨로지",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
      </svg>
    ),
    title: "지식 그래프 시각화",
    desc: "삶의 모든 데이터가 노드와 엣지로 연결됩니다. Force-directed 그래프로 지식의 관계를 탐색하세요.",
    mockup: (
      <div className="relative h-40">
        {/* Static graph mockup */}
        <svg viewBox="0 0 300 160" className="w-full h-full" aria-hidden="true">
          <line x1="150" y1="80" x2="80" y2="40" stroke="#0EA5E9" strokeWidth="1" opacity="0.4" />
          <line x1="150" y1="80" x2="220" y2="40" stroke="#059669" strokeWidth="1" opacity="0.4" />
          <line x1="150" y1="80" x2="60" y2="120" stroke="#22D3EE" strokeWidth="1" opacity="0.4" />
          <line x1="150" y1="80" x2="240" y2="120" stroke="#0EA5E9" strokeWidth="1" opacity="0.4" />
          <line x1="80" y1="40" x2="60" y2="120" stroke="#059669" strokeWidth="1" opacity="0.3" />
          <line x1="220" y1="40" x2="240" y2="120" stroke="#22D3EE" strokeWidth="1" opacity="0.3" />
          <circle cx="150" cy="80" r="12" fill="#0EA5E9" opacity="0.8" />
          <circle cx="80" cy="40" r="8" fill="#059669" opacity="0.7" />
          <circle cx="220" cy="40" r="8" fill="#22D3EE" opacity="0.7" />
          <circle cx="60" cy="120" r="6" fill="#38BDF8" opacity="0.6" />
          <circle cx="240" cy="120" r="6" fill="#059669" opacity="0.6" />
          <circle cx="150" cy="30" r="5" fill="#67E8F9" opacity="0.5" />
          <text x="150" y="84" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">나</text>
          <text x="80" y="44" textAnchor="middle" fill="white" fontSize="6">건강</text>
          <text x="220" y="44" textAnchor="middle" fill="white" fontSize="6">커리어</text>
          <text x="60" y="124" textAnchor="middle" fill="white" fontSize="5">러닝</text>
          <text x="240" y="124" textAnchor="middle" fill="white" fontSize="5">토익</text>
        </svg>
      </div>
    ),
  },
];

// ---------------------------------------------------------------------------
// Voice waveform animation
// ---------------------------------------------------------------------------
function VoiceWaveform() {
  const bars = 24;
  return (
    <div className="flex items-center justify-center gap-[3px] h-16" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="w-1 bg-sky-400 rounded-full animate-pulse"
          style={{
            height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 10}%`,
            animationDelay: `${i * 80}ms`,
            animationDuration: `${800 + Math.random() * 400}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const [activeTab, setActiveTab] = useState("chat");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleWaitlist = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistSubmitted(true);
  }, []);

  // Section animations
  const hero = useInView(0.1);
  const problem = useInView(0.15);
  const solution = useInView(0.15);
  const featureSection = useInView(0.1);
  const voice = useInView(0.15);
  const social = useInView(0.15);
  const cta = useInView(0.15);

  const activeFeature = features.find((f) => f.id === activeTab) || features[0];

  return (
    <div className="bg-vivara-surface dark:bg-vivara-surface-dark text-gray-900 dark:text-white overflow-x-hidden">

      {/* ─── Hero ─── */}
      <section
        ref={hero.ref}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <OntologyGraphBg />
        <div className="absolute inset-0 bg-gradient-to-b from-vivara-surface/30 via-transparent to-vivara-surface dark:from-vivara-surface-dark/30 dark:to-vivara-surface-dark z-[1]" />

        <div className={`relative z-10 text-center px-6 max-w-3xl mx-auto transition-[opacity,transform] duration-1000 ${hero.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <p className="text-sm font-body tracking-widest text-sky-700 uppercase mb-4">Personal AI Cognitive Engine</p>
          <h1 className="text-5xl md:text-7xl font-heading font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              VIVARA
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-3 font-body">
            삶에 의미를 부여하다
          </p>
          <p className="text-base text-gray-700 dark:text-gray-300 mb-10 max-w-xl mx-auto leading-relaxed">
            대화, 목표, 습관, 지식 — 흩어진 삶의 조각들을
            <br className="hidden md:block" />
            온톨로지로 연결하고, AI가 의미를 발견합니다
          </p>
          <a
            href="/login"
            className="inline-block px-8 py-4 bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold rounded-full text-lg hover:shadow-lg hover:shadow-sky-500/25 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5"
          >
            시작하기
          </a>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ─── Problem ─── */}
      <section ref={problem.ref} className="py-24 md:py-32 px-6">
        <div className={`max-w-4xl mx-auto text-center transition-[opacity,transform] duration-1000 ${problem.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            흩어진 삶의 조각들
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            노트앱, 캘린더, 습관 트래커, 챗봇 — 데이터는 많지만 서로 연결되지 않습니다.
            어제 나눈 대화가 오늘의 목표와 어떤 관련이 있는지 아무도 알려주지 않습니다.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "대화", sublabel: "기억 없는 챗봇" },
              { label: "목표", sublabel: "추적 없는 계획" },
              { label: "습관", sublabel: "분석 없는 기록" },
              { label: "지식", sublabel: "연결 없는 문서" },
            ].map((item) => (
              <div key={item.label} className="p-6 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 opacity-60">
                <p className="text-lg font-semibold mb-1">{item.label}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Solution ─── */}
      <section ref={solution.ref} className="py-24 md:py-32 px-6 bg-gray-50 dark:bg-gray-900/30">
        <div className={`max-w-4xl mx-auto text-center transition-[opacity,transform] duration-1000 ${solution.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            연결하면 <span className="text-sky-700">의미</span>가 보입니다
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            VIVARA는 모든 데이터를 온톨로지 그래프로 연결합니다.
            LLM이 의미를 추출하고, 정제 파이프라인이 품질을 보장하며,
            그래프 분석이 숨겨진 패턴을 발견합니다.
          </p>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "입력", desc: "대화, 목표, 습관, 문서", color: "text-sky-400" },
              { step: "2", title: "의미 추출", desc: "LLM → 구조화된 노드/엣지", color: "text-cyan-400" },
              { step: "3", title: "정제 & 연결", desc: "중복 제거, 검증, 품질 보장", color: "text-emerald-400" },
              { step: "4", title: "인사이트", desc: "패턴 발견 → 행동 제안", color: "text-sky-400" },
            ].map((item, i) => (
              <div key={item.step} className={`transition-[opacity,transform] duration-700 delay-${i * 150} ${solution.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                <div className={`text-4xl font-bold ${item.color} mb-3`}>{item.step}</div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Interactive Feature Demo ─── */}
      <section ref={featureSection.ref} className="py-24 md:py-32 px-6">
        <div className={`max-w-5xl mx-auto transition-[opacity,transform] duration-1000 ${featureSection.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-4">
            하나의 플랫폼, 모든 것이 연결됩니다
          </h2>
          <p className="text-gray-700 dark:text-gray-300 text-center mb-12 max-w-2xl mx-auto">
            대화에서 시작해 목표, 습관, 인사이트, 지식 그래프까지 — 모든 기능이 유기적으로 작동합니다
          </p>

          {/* Tab buttons */}
          <div className="flex justify-center gap-2 mb-10 flex-wrap" role="tablist" aria-label="기능 탭">
            {features.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={activeTab === f.id}
                onClick={() => setActiveTab(f.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,transform] duration-200 ${
                  activeTab === f.id
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
          </div>

          {/* Feature content */}
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h3 className="text-2xl font-heading font-bold mb-4">{activeFeature.title}</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{activeFeature.desc}</p>
              <a href="/login" className="text-sky-700 hover:text-sky-800 text-sm font-medium transition">
                직접 체험하기 &rarr;
              </a>
            </div>
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg">
              {activeFeature.mockup}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Voice Section ─── */}
      <section ref={voice.ref} className="py-24 md:py-32 px-6 bg-gray-50 dark:bg-gray-900/30">
        <div className={`max-w-4xl mx-auto text-center transition-[opacity,transform] duration-1000 ${voice.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
            목소리로 대화하세요
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-10 max-w-xl mx-auto">
            음성 인식으로 더 자연스럽게 소통합니다.
            말한 내용이 텍스트로 변환되어 온톨로지에 자동 통합됩니다.
          </p>
          <div className="max-w-md mx-auto p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg">
            <VoiceWaveform />
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-sky-500 rounded-full flex items-center justify-center shadow-lg shadow-sky-500/25">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">음성 인식 중...</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Stats ─── */}
      <section ref={social.ref} className="py-24 md:py-32 px-6">
        <div className={`max-w-5xl mx-auto transition-[opacity,transform] duration-1000 ${social.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-center mb-16">
            성장하는 사용자들의 이야기
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { before: "매일 같은 실수를 반복하고 있다는 걸 몰랐어요", after: "VIVARA가 패턴을 발견해서 습관을 바꿀 수 있었어요", name: "김지현", role: "대학원생" },
              { before: "목표만 세우고 추적이 안 돼서 항상 흐지부지됐어요", after: "AI가 매주 회고해주니 목표 완료율이 3배 올랐어요", name: "박성훈", role: "프리랜서 개발자" },
              { before: "메모앱이 6개인데 연결이 안 돼서 결국 다 까먹어요", after: "모든 게 온톨로지로 연결되니 맥락이 저절로 따라와요", name: "이수진", role: "콘텐츠 크리에이터" },
            ].map((story) => (
              <div key={story.name} className="p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="mb-4">
                  <p className="text-sm text-gray-400 line-through mb-2">&ldquo;{story.before}&rdquo;</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">&ldquo;{story.after}&rdquo;</p>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="w-8 h-8 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center text-sky-700 text-xs font-bold">
                    {story.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{story.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{story.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-sky-700"><Counter target={12000} suffix="+" /></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">온톨로지 노드 생성</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-cyan-500"><Counter target={95} suffix="%" /></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">맥락 정확도</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-emerald-700"><Counter target={3} suffix="x" /></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">목표 완료율 향상</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-sky-400"><Counter target={500} suffix="+" /></p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">자동 인사이트 생성</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA: Waitlist ─── */}
      <section ref={cta.ref} className="py-24 md:py-32 px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/30 dark:to-vivara-surface-dark">
        <div className={`max-w-lg mx-auto text-center transition-[opacity,transform] duration-1000 ${cta.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            삶의 의미를 발견할 준비가 되셨나요?
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            VIVARA 얼리 액세스에 등록하고 가장 먼저 만나보세요
          </p>

          {waitlistSubmitted ? (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <svg className="w-10 h-10 text-emerald-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">등록이 완료되었습니다!</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">출시 소식을 가장 먼저 알려드릴게요.</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex gap-3 max-w-md mx-auto">
              <label htmlFor="waitlist-email" className="sr-only">이메일</label>
              <input
                id="waitlist-email"
                type="email"
                required
                placeholder="이메일 주소"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-cyan-400 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-sky-500/25 transition-[box-shadow] duration-300 text-sm whitespace-nowrap"
              >
                등록하기
              </button>
            </form>
          )}

          <p className="text-xs text-gray-600 dark:text-gray-400 mt-4">
            스팸 없음 — 출시 알림만 보내드립니다
          </p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 px-6 border-t border-gray-200 dark:border-gray-800 text-center text-gray-600 dark:text-gray-400 text-sm">
        <span className="font-heading font-bold bg-gradient-to-r from-sky-500 to-cyan-400 bg-clip-text text-transparent">VIVARA</span>
        <span className="mx-2">—</span>
        The Origin of Your Life, Visualized
      </footer>
    </div>
  );
}
