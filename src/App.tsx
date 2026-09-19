/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sparkles, Code2, Rocket, Palette } from 'lucide-react';

export default function App() {
  const suggestions = [
    {
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      title: "智能工具",
      desc: "例如：待办清单、计算器、记账本或番茄钟",
    },
    {
      icon: <Palette className="w-5 h-5 text-indigo-500" />,
      title: "数据看板",
      desc: "例如：财务分析、个人习惯打卡、销售看板",
    },
    {
      icon: <Code2 className="w-5 h-5 text-emerald-500" />,
      title: "效率与协作",
      desc: "例如：Markdown 编辑器、白板笔记、日程管理",
    },
    {
      icon: <Rocket className="w-5 h-5 text-rose-500" />,
      title: "创意互动",
      desc: "例如：趣味小游戏、测验题库、音乐节奏板",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-neutral-900 selection:text-white">
      <header className="max-w-4xl mx-auto w-full pt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-500 tracking-wide uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          AI Studio Ready
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full py-12">
        <div className="space-y-6">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-neutral-950">
            你好！很高兴为你服务。
          </h1>
          <p className="text-lg sm:text-xl text-neutral-600 leading-relaxed max-w-2xl">
            我已经准备好为你构建完整的 Web 应用程序。你可以直接告诉我你的想法、功能需求或设计风格。
          </p>

          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border border-neutral-200 bg-white shadow-xs transition-all hover:border-neutral-300"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-neutral-100">{item.icon}</div>
                  <h3 className="font-semibold text-neutral-900">{item.title}</h3>
                </div>
                <p className="text-sm text-neutral-500 leading-normal">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center gap-3 text-sm text-neutral-500 bg-neutral-100/80 border border-neutral-200/60 rounded-xl px-4 py-3">
            <span className="font-medium text-neutral-700">提示：</span>
            <span>随时在对话框中输入你的需求，我将立即为你编写与实现！</span>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full pb-4 text-center text-xs text-neutral-400">
        Google AI Studio · 构建属于你的专属应用
      </footer>
    </div>
  );
}

