import { useState, useEffect } from "react";
import { BrainCircuit, ShieldCheck } from "lucide-react";
import { School, ToastMessage } from "./types";
import SchoolSearch from "./components/SchoolSearch";
import MealAnalysis from "./components/MealAnalysis";
import ToastContainer from "./components/ToastContainer";

export default function App() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Stinger toast notification helper
  const addToast = (message: string, type: "success" | "warn" | "error" | "info" = "success") => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Persists chosen school on bootstrap
  useEffect(() => {
    const stored = localStorage.getItem("selectedSchool");
    if (stored) {
      try {
        const schoolObj: School = JSON.parse(stored);
        setSelectedSchool(schoolObj);
      } catch (e) {
        console.error("Local storage recovery failure solved:", e);
        localStorage.removeItem("selectedSchool");
      }
    }
  }, []);

  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    localStorage.setItem("selectedSchool", JSON.stringify(school));
    addToast(`${school.schoolName} 식생활 데이터가 정상 연결되었습니다.`, "success");
  };

  const handleBackToSearch = () => {
    setSelectedSchool(null);
    localStorage.removeItem("selectedSchool");
    addToast("학교 변경을 위해 검색 화면으로 이동했습니다.", "info");
  };

  const handleClearAll = () => {
    setSelectedSchool(null);
    localStorage.removeItem("selectedSchool");
  };

  return (
    <div className="bg-slate-50 text-slate-800 antialiased font-sans min-h-screen flex flex-col transition-all duration-300">
      
      {/* Absolute Overlays notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Persistent App Header */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          
          <div
            onClick={handleClearAll}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20 group-hover:bg-indigo-700 transition-all transform group-hover:scale-105">
              <BrainCircuit className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2 font-display">
                식식메이트{" "}
                <span className="text-[10px] px-2.5 py-0.5 bg-indigo-50 border border-indigo-100/50 text-indigo-600 rounded-full font-sans font-extrabold tracking-wide">
                  AI 급식 분석
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">우리 학교 급식 실시간 영양 분석</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100/30 rounded-xl text-xs font-bold leading-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>실시간 급식 정보 활성화됨</span>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Area */}
      <main className="flex-grow w-full py-6 lg:py-10">
        {selectedSchool ? (
          <MealAnalysis
            school={selectedSchool}
            onBack={handleBackToSearch}
            addToast={addToast}
          />
        ) : (
          <SchoolSearch
            onSelectSchool={handleSelectSchool}
            addToast={addToast}
          />
        )}
      </main>

      {/* Global Interactive Footer */}
      <footer className="bg-white border-t border-slate-100 text-center py-6 text-xs text-slate-400 leading-relaxed mt-auto shrink-0 pb-20 lg:pb-6">
        <div className="max-w-2xl mx-auto px-4 space-y-1.5">
          <p className="font-bold text-slate-500 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-indigo-500" />
            <span>식식메이트 실시간 학교 급식 정보 분석</span>
          </p>
          <p>
            본 서비스는 교육부 나이스(NEIS) 오픈 데이터를 바탕으로 전국의 초·중·고등학교 급식 정보와
            조화로운 영양소 구성을 쉽고 편리하게 분석하여 제공합니다.
          </p>
          <p className="text-[10px] text-slate-300">
            Copyright © 식식메이트. All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
