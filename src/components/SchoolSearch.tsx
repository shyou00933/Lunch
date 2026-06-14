import React, { useState, useEffect, useRef } from "react";
import { Search, School as SchoolIcon, X, List, BrainCircuit } from "lucide-react";
import { School } from "../types";

interface SchoolSearchProps {
  onSelectSchool: (school: School) => void;
  addToast: (message: string, type?: "success" | "warn" | "error" | "info") => void;
}

export default function SchoolSearch({ onSelectSchool, addToast }: SchoolSearchProps) {
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [resultsCount, setResultsCount] = useState(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.trim().length < 2) {
      setSchools([]);
      setShowPopover(false);
      setResultsCount(0);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(val.trim());
    }, 500);
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) return;

    setIsLoading(true);
    setShowPopover(true);

    try {
      const response = await fetch(`/api/neis/schoolSearch?query=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) throw new Error("NEIS API 연결 장애 발생");
      const data = await response.json();

      let matches: School[] = [];
      const rowData = data?.schoolInfo?.[1]?.row || [];
      if (rowData.length > 0) {
        matches = rowData.map((row: any) => ({
          schoolName: row.SCHUL_NM,
          officeCode: row.ATPT_OFCDC_SC_CODE,
          officeName: row.ATPT_OFCDC_SC_NM,
          schoolCode: row.SD_SCHUL_CODE,
        }));
      }

      setSchools(matches);
      setResultsCount(matches.length);

      if (matches.length === 0) {
        addToast("실제 등록된 학교를 찾을 수 없습니다.", "warn");
      } else {
        addToast(`실시간 NEIS 학교 검색 결과 ${matches.length}건을 성공적으로 연동했습니다.`, "success");
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "학교 검색 중 문제가 발생했습니다.", "error");
      setSchools([]);
      setResultsCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const applyQuickFilter = (searchTerm: string) => {
    setQuery(searchTerm);
    performSearch(searchTerm);
  };

  const clearQuery = () => {
    setQuery("");
    setSchools([]);
    setResultsCount(0);
    setShowPopover(false);
  };

  const triggerInstantQuery = () => {
    if (query.trim().length < 2) {
      addToast("학교명을 2글자 이상 입력해 주세요.", "warn");
      return;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    performSearch(query.trim());
  };

  return (
    <div id="screen-search" className="max-w-2xl mx-auto w-full px-4 flex flex-col gap-8 animate-fade-in">
      
      {/* Service Logo Section */}
      <div className="text-center">
        <div className="inline-flex p-4.5 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-600/20 mb-5 transform hover:rotate-6 hover:scale-105 transition-all duration-300">
          <BrainCircuit className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display">
          식식메이트 <span className="text-indigo-600">AI</span>
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-2">
          전국 학교 급식 실시간 조회 및 인공지능 영양 분석
        </p>
      </div>

      {/* Search Card Wrapper */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col gap-6">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-50">
          <div className="p-2 bg-indigo-50 text-indigo-650 rounded-xl">
            <Search className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 tracking-tight">🏫 학교 검색 및 선택</h2>
            <p className="text-[10px] text-slate-400 font-semibold">
              전국 초·중·고등학교 급식의 일별 영양 배분과 균형 상태 진단
            </p>
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">
            학교명 입력 (2글자 이상)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <SchoolIcon className="w-5 h-5" />
            </span>
            <input
              id="school-search-input"
              type="text"
              value={query}
              onChange={handleSearchInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  triggerInstantQuery();
                }
              }}
              placeholder="학교명을 입력하세요 (예: 청북고, 평택고)"
              autoComplete="off"
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-100 hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 rounded-2xl text-sm font-bold text-slate-800 placeholder-slate-400 transition-all shadow-inner"
            />
            {query && (
              <button
                id="search-clear-btn"
                onClick={clearQuery}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                title="검색어 지우기"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Popover Autocomplete */}
          {showPopover && (
            <div
              id="autocomplete-popover"
              className="absolute left-0 right-0 mt-2 max-h-60 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-y-auto custom-scrollbar overflow-hidden divide-y divide-slate-50"
            >
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-100 border-t-indigo-600"></div>
                  <span>학교 정보 실시간 검색 중...</span>
                </div>
              ) : schools.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-semibold">
                  검색된 학교가 없습니다. 정확한 이름을 입력해 주세요.
                </div>
              ) : (
                schools.map((school) => (
                  <div
                    key={school.schoolCode}
                    onClick={() => onSelectSchool(school)}
                    className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors cursor-pointer group leading-tight"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 px-1.5 bg-slate-100 text-slate-500 rounded group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                        <SchoolIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                          {school.schoolName}
                        </span>
                        <span className="text-[9px] text-slate-400 font-semibold">
                          {school.officeName}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-md font-mono">
                      {school.schoolCode}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>


      </div>

      {/* Results panel when query yields multiple options */}
      {query.length >= 2 && schools.length > 0 && (
        <div id="school-results-panel" className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-50">
            <span className="text-xs text-indigo-650 font-extrabold tracking-tight inline-flex items-center gap-1.5">
              <List className="w-4 h-4 text-indigo-500" />
              <span>학교 검색 결과</span>
            </span>
            <span id="results-count-badge" className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full">
              {resultsCount}건
            </span>
          </div>

          <div id="school-results-list" className="flex flex-col gap-3 max-h-[360px] overflow-y-auto custom-scrollbar">
            {schools.map((school) => (
              <div
                key={school.schoolCode}
                onClick={() => onSelectSchool(school)}
                className="group bg-slate-50/50 hover:bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-xl transition-colors shrink-0">
                    <SchoolIcon className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                      {school.schoolName}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      {school.officeName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSchool(school);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow shadow-indigo-600/10 shrink-0 cursor-pointer"
                >
                  선택하기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
