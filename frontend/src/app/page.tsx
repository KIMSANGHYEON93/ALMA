export default function LandingPage() {
  return (
    <div className="bg-gray-950 text-white">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Spline 3D Background (iframe embed) */}
        <iframe
          src="https://my.spline.design/treeplanterinteraction-8BPVN3fV6W7FxQnP/"
          className="absolute inset-0 w-full h-full border-0 z-0 opacity-80"
          title="ALMA 3D Tree"
          loading="lazy"
        />

        {/* Overlay Content */}
        <div className="relative z-10 text-center px-6">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              ALMA
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-2">
            Adaptive Life Management Agent
          </p>
          <p className="text-base md:text-lg text-gray-400 mb-10 max-w-lg mx-auto">
            인간이 원하는 삶의 성장을 목표로 하는 미래를 만들어가는 AI 비서
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
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>

      {/* Feature Sections */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-12">
          {/* Feature 1 */}
          <div className="text-center group">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">대화 기억</h3>
            <p className="text-gray-400 leading-relaxed">
              모든 대화를 기억하고 맥락을 이해합니다. 과거 대화에서 관련
              내용을 자동으로 찾아 더 정확한 답변을 제공합니다.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="text-center group">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition">
              <svg
                className="w-8 h-8 text-teal-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">성장 추적</h3>
            <p className="text-gray-400 leading-relaxed">
              목표를 설정하고 진행 상황을 추적합니다. 회고와 인사이트로
              삶의 성장 여정을 함께 만들어갑니다.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="text-center group">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition">
              <svg
                className="w-8 h-8 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">자동 행동</h3>
            <p className="text-gray-400 leading-relaxed">
              캘린더, 노션 등 외부 서비스와 연동하여 반복 작업을 자동화합니다.
              당신이 중요한 일에 집중할 시간을 만들어줍니다.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          당신의 성장을 함께할 준비가 되었습니다
        </h2>
        <p className="text-gray-400 mb-10 max-w-md mx-auto">
          ALMA와 함께 목표를 설정하고, 대화하고, 성장하세요.
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
        ALMA — Adaptive Life Management Agent
      </footer>
    </div>
  );
}
