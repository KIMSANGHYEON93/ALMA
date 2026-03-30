export default function LandingPage() {
  return (
    <div className="bg-gray-950 text-white">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Spline 3D Background (iframe embed) */}
        <iframe
          src="https://my.spline.design/treeplanterinteraction-8BPVN3fV6W7FxQnP/"
          className="absolute inset-0 w-full h-full border-0 z-0 opacity-80"
          title="VIVARA 3D"
          loading="lazy"
        />

        {/* Overlay Content */}
        <div className="relative z-10 text-center px-6">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              VIVARA
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-2">
            The Origin of Your Life, Visualized
          </p>
          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-xl mx-auto">
            삶의 모든 데이터에 의미를 부여하고, 관계를 발견하고,
            성장의 방향을 제시하는 인지 엔진
          </p>
          <a
            href="/login"
            className="inline-block px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-full text-lg hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
          >
            시작하기
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            당신의 삶을 이해하는 방식이 달라집니다
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            대화, 목표, 습관, 문서 — 흩어진 데이터를 온톨로지로 연결하고,
            AI가 패턴을 발견하여 행동을 제안합니다
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {/* Feature 1: Ontology */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-emerald-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">지식 온톨로지</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                모든 데이터에 의미를 부여하고 관계를 자동으로 연결합니다.
                팔란티어 스타일의 정제 파이프라인이 쓰레기 데이터를 걸러냅니다.
              </p>
            </div>

            {/* Feature 2: Graph */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-teal-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition">
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">그래프 시각화</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Obsidian 스타일의 force-directed 그래프로 지식의 연결을 탐색합니다.
                노드를 클릭하면 관련 관계가 즉시 드러납니다.
              </p>
            </div>

            {/* Feature 3: Insights */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-cyan-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition">
                <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AI 인사이트</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                그래프 분석 알고리즘이 숨겨진 패턴을 발견하고,
                LLM이 실행 가능한 인사이트로 해석하여 행동을 제안합니다.
              </p>
            </div>

            {/* Feature 4: Chat */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-purple-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">맥락을 기억하는 대화</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                모든 대화를 기억하고 벡터 검색으로 관련 맥락을 자동 주입합니다.
                대화할수록 온톨로지가 풍부해지고 더 정확해집니다.
              </p>
            </div>

            {/* Feature 5: Growth */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-orange-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">목표 & 습관 추적</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                목표와 습관을 설정하면 자동으로 온톨로지에 연결됩니다.
                회고와 인사이트로 성장의 여정을 시각화합니다.
              </p>
            </div>

            {/* Feature 6: Automation */}
            <div className="group p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-rose-500/30 transition">
              <div className="w-12 h-12 mb-5 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition">
                <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">자율 행동 에이전트</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                인사이트 기반으로 에이전트가 자율적으로 판단하고 행동합니다.
                캘린더 등록, 관계 연결, 알림 — 당신 대신 실행합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-gray-900/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-16">작동 원리</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl font-bold text-emerald-400 mb-3">1</div>
              <h4 className="font-semibold mb-2">입력</h4>
              <p className="text-gray-400 text-sm">대화, 목표, 습관, 문서 — 어떤 형태든</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-teal-400 mb-3">2</div>
              <h4 className="font-semibold mb-2">의미 추출</h4>
              <p className="text-gray-400 text-sm">LLM이 구조화된 노드와 관계로 변환</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-cyan-400 mb-3">3</div>
              <h4 className="font-semibold mb-2">정제 & 연결</h4>
              <p className="text-gray-400 text-sm">중복 제거, 검증, 기존 지식과 연결</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-400 mb-3">4</div>
              <h4 className="font-semibold mb-2">인사이트 & 행동</h4>
              <p className="text-gray-400 text-sm">패턴 발견, 미래 예측, 자율 실행</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          당신의 삶을 이해하는 AI를 만나보세요
        </h2>
        <p className="text-gray-400 mb-10 max-w-lg mx-auto">
          VIVARA는 단순한 챗봇이 아닙니다.
          삶의 데이터에 의미를 부여하고, 성장의 방향을 제시하는 인지 엔진입니다.
        </p>
        <a
          href="/login"
          className="inline-block px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-full text-lg hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/25"
        >
          지금 시작하세요
        </a>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-800 text-center text-gray-500 text-sm">
        VIVARA — The Origin of Your Life, Visualized
      </footer>
    </div>
  );
}
