import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  RefreshCw,
  Utensils,
  PieChart,
  Flame,
  Award,
  Sparkles,
  CalendarDays,
  TrendingUp,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { School, AIAnalysis, DayMeal, WeeklyMeal } from "../types";
import { localNutritionalAnalysis } from "../utils/nutrition";

interface MealAnalysisProps {
  school: School;
  onBack: () => void;
  addToast: (message: string, type?: "success" | "warn" | "error" | "info") => void;
}

// Helper to convert weekday to formatted dates with a given week offset
function getFormattedDateAndYmd(weekdayStr: string, weekOffset: number = 0) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const targetDayIdx = weekdays.indexOf(weekdayStr);
  if (targetDayIdx === -1) return { formatted: '', ymd: '' };

  const current = new Date();
  if (weekOffset !== 0) {
    current.setDate(current.getDate() + (weekOffset * 7));
  }
  const currentDayIdx = current.getDay();

  // Convert Sunday from 0 to 7 for correct ISO weeks
  const adjCurrentDayIdx = currentDayIdx === 0 ? 7 : currentDayIdx;
  const adjTargetDayIdx = targetDayIdx === 0 ? 7 : targetDayIdx;
  const adjDiff = adjTargetDayIdx - adjCurrentDayIdx;

  const targetDate = new Date(current);
  targetDate.setDate(current.getDate() + adjDiff);

  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const formatted = `${yyyy}년 ${mm}월 ${dd}일 (${dayNames[targetDate.getDay()]})`;
  const ymd = `${yyyy}${mm}${dd}`;

  return { formatted, ymd };
}

function parseKcal(calStr: string | null | undefined): number {
  if (!calStr) return 0;
  const cleaned = calStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanMealName(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/\s*\([\d\s.]+\)/g, ''); // Remove allergy numbers
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
}

// Calculate week date range (Monday to Sunday) with a given week offset
function getWeeklyDateRange(weekOffset: number = 0) {
  const current = new Date();
  if (weekOffset !== 0) {
    current.setDate(current.getDate() + (weekOffset * 7));
  }
  const currentDayIdx = current.getDay();
  const adjCurrentDayIdx = currentDayIdx === 0 ? 7 : currentDayIdx; // Mon=1, Sun=7
  
  const monday = new Date(current);
  monday.setDate(current.getDate() - (adjCurrentDayIdx - 1));
  
  const sunday = new Date(current);
  sunday.setDate(current.getDate() + (7 - adjCurrentDayIdx));
  
  function formatYMD(d: Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }
  
  return {
    fromYmd: formatYMD(monday),
    toYmd: formatYMD(sunday)
  };
}

export default function MealAnalysis({ school, onBack, addToast }: MealAnalysisProps) {
  const [currentWeekday, setCurrentWeekday] = useState<string>("월");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [mobileTab, setMobileTab] = useState<"meals" | "ai" | "nutrition" | "weekly">("meals");
  
  // Daily meals loaded state
  const [lunch, setLunch] = useState<DayMeal | null>(null);
  const [dinner, setDinner] = useState<DayMeal | null>(null);
  const [isLoadingMeals, setIsLoadingMeals] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Weekly map states for timeline cards
  const [weeklyMeals, setWeeklyMeals] = useState<Record<string, WeeklyMeal>>({});
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);

  // AI Analysis result
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  const { formatted: formattedDate, ymd: activeYmd } = getFormattedDateAndYmd(currentWeekday, weekOffset);

  // Fetch individual daily meals on weekday trigger change
  useEffect(() => {
    loadDailyMealData();
  }, [currentWeekday, school, weekOffset]);

  // Load weekly plans once
  useEffect(() => {
    loadWeeklyTimeline();
  }, [school, weekOffset]);

  const handlePrevWeek = () => {
    if (weekOffset > 0) {
      const nextOffset = weekOffset - 1;
      setWeekOffset(nextOffset);
      addToast("이전 주 식생활 데이터로 이동했습니다.", "info");
    }
  };

  const handleNextWeek = () => {
    if (weekOffset < 2) {
      const nextOffset = weekOffset + 1;
      setWeekOffset(nextOffset);
      addToast(`${nextOffset === 1 ? "다음" : "다다음"} 주 식생활 데이터로 이동했습니다.`, "info");
    }
  };

  const loadDailyMealData = async () => {
    setIsLoadingMeals(true);
    setIsLoadingAnalysis(true);
    setAnalysis(null);
    setLunch(null);
    setDinner(null);

    const { ymd } = getFormattedDateAndYmd(currentWeekday, weekOffset);
    try {
      const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&KEY=6c514420a932447da193272417931121&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}&MLSV_YMD=${ymd}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("NEIS API 연결 및 처리 장애");
      const data = await res.json();

      let activeLunch: DayMeal | null = null;
      let activeDinner: DayMeal | null = null;

      const info = data?.mealServiceDietInfo;
      if (!info) {
        const errMsg = data?.RESULT?.MESSAGE || "선택된 요일의 NEIS 급식 정보가 존재하지 않습니다.";
        addToast(errMsg, "info");
      }

      const rows = info?.[1]?.row || [];
      rows.forEach((row: any) => {
        const mealCode = row.MMEAL_SC_CODE; // "1"=Breakfast, "2"=Lunch, "3"=Dinner
        const cleanedMenu = cleanMealName(row.DDISH_NM);
        const cal = row.CAL_INFO || "- kcal";

        if (mealCode === "1" || mealCode === "2") {
          activeLunch = { menu: cleanedMenu, calories: cal };
        } else if (mealCode === "3") {
          activeDinner = { menu: cleanedMenu, calories: cal };
        }
      });

      setLunch(activeLunch);
      setDinner(activeDinner);
      setIsLoadingMeals(false);

      // Perform AI Analysis triggers
      if (activeLunch || activeDinner) {
        await analyzeMealNutrition(
          activeLunch ? (activeLunch as DayMeal).menu : "",
          activeDinner ? (activeDinner as DayMeal).menu : ""
        );
      } else {
        setIsLoadingAnalysis(false);
      }

    } catch (err: any) {
      console.error(err);
      addToast(err.message || "급식 정보를 실시간 로딩할 수 없습니다.", "error");
      setIsLoadingMeals(false);
      setIsLoadingAnalysis(false);
    }
  };

  const loadWeeklyTimeline = async () => {
    setIsLoadingWeekly(true);
    const { fromYmd, toYmd } = getWeeklyDateRange(weekOffset);

    try {
      // Fetch weekly info from NEIS directly
      const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&KEY=6c514420a932447da193272417931121&ATPT_OFCDC_SC_CODE=${school.officeCode}&SD_SCHUL_CODE=${school.schoolCode}&MLSV_FROM_YMD=${fromYmd}&MLSV_TO_YMD=${toYmd}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("NEIS API 연결 실패");
      const data = await res.json();

      const mealsMap: Record<string, WeeklyMeal> = {};
      const info = data?.mealServiceDietInfo;
      if (!info) {
        const errMsg = data?.RESULT?.MESSAGE || "해당 주간의 급식 데이터가 존재하지 않습니다.";
        console.warn(`Weekly Meal Info missing: ${errMsg}`);
      }

      const rows = info?.[1]?.row || [];

      rows.forEach((row: any) => {
        const dateYmd = row.MLSV_YMD;
        const mealCode = row.MMEAL_SC_CODE;
        const cleanedMenu = cleanMealName(row.DDISH_NM);
        const cal = row.CAL_INFO || "- kcal";

        if (!mealsMap[dateYmd]) {
          mealsMap[dateYmd] = { lunch: null, dinner: null };
        }

        if (mealCode === "1" || mealCode === "2") {
          mealsMap[dateYmd].lunch = { menu: cleanedMenu, calories: cal };
        } else if (mealCode === "3") {
          mealsMap[dateYmd].dinner = { menu: cleanedMenu, calories: cal };
        }
      });

      setWeeklyMeals(mealsMap);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingWeekly(false);
    }
  };

  const analyzeMealNutrition = async (lunchMenu: string, dinnerMenu: string) => {
    setIsLoadingAnalysis(true);
    try {
      // Analyze the meals client-side locally using the optimized nutrition analyzer engine
      const data = localNutritionalAnalysis(lunchMenu, dinnerMenu);
      setAnalysis(data as any);
    } catch (err: any) {
      console.error(err);
      addToast("AI 분석 도중 오류가 발생했습니다.", "error");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const manualRefresh = async () => {
    setIsRefreshing(true);
    addToast("대시보드를 실시간 갱신 중입니다.", "info");
    await Promise.all([loadDailyMealData(), loadWeeklyTimeline()]);
    setIsRefreshing(false);
    addToast("영양 분석 보고서가 최신 상태로 동기화되었습니다.", "success");
  };

  // Computations for calories indicators
  const lunchKcal = lunch ? parseKcal(lunch.calories) : 0;
  const dinnerKcal = dinner ? parseKcal(dinner.calories) : 0;
  const totalKcal = lunchKcal + dinnerKcal;
  const targetThreshold = 1600; // default indicator baseline
  const progressRatio = Math.min(100, (totalKcal / targetThreshold) * 100);

  // Nutrition default ratios or loaded analysis
  const carbPercent = analysis ? analysis.ratioCarb : 0;
  const protPercent = analysis ? analysis.ratioProt : 0;
  const fatPercent = analysis ? analysis.ratioFat : 0;
  const scoreVal = analysis ? analysis.score : 0;
  const isServerAI = analysis ? analysis.isAI : false;

  // SVG dashOffsets calculators
  const carbOffsetDesktop = 138 - (138 * carbPercent) / 100;
  const protOffsetDesktop = 138 - (138 * protPercent) / 100;
  const fatOffsetDesktop = 138 - (138 * fatPercent) / 100;

  const carbOffsetMobile = 163 - (163 * carbPercent) / 100;
  const protOffsetMobile = 163 - (163 * protPercent) / 100;
  const fatOffsetMobile = 163 - (163 * fatPercent) / 100;

  const scoreOffsetDesktop = 100 - scoreVal;
  const scoreOffsetMobile = 119 - (119 * scoreVal) / 100;

  const weekdayButtons = ["월", "화", "수", "목", "금", "토", "일"];

  // Helper function to build dynamic timeline cards for desktop/mobile
  const renderWeeklyPlanForCard = (day: string) => {
    const { ymd } = getFormattedDateAndYmd(day, weekOffset);
    const dateObj = weeklyMeals[ymd];

    const hasLunch = dateObj && dateObj.lunch;
    const hasDinner = dateObj && dateObj.dinner;

    const lCal = hasLunch ? dateObj.lunch!.calories : "- kcal";
    const dCal = hasDinner ? dateObj.dinner!.calories : "- kcal";
    const dayTotalKcal = (hasLunch ? parseKcal(lCal) : 0) + (hasDinner ? parseKcal(dCal) : 0);

    const isToday = currentWeekday === day;
    const desktopClasses = isToday
      ? "bg-indigo-600 text-white border-indigo-700 shadow shadow-indigo-600/15 transform scale-102 font-black"
      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-100 hover:border-indigo-150 font-bold";

    const badgeClasses = isToday ? "bg-indigo-700/50 text-white" : "bg-indigo-50 text-indigo-600 border border-indigo-100/50";
    const subTextClasses = isToday ? "text-indigo-100" : "text-slate-400";

    return (
      <div
        key={day}
        onClick={() => setCurrentWeekday(day)}
        className={`border rounded-2xl p-4 transition-all duration-250 cursor-pointer flex flex-col justify-between group text-center min-h-[144px] shadow-sm relative overflow-hidden ${desktopClasses}`}
      >
        <div>
          <span className={`text-[10px] uppercase tracking-wider block font-mono ${subTextClasses}`}>
            {ymd ? `${ymd.substring(4, 6)}/${ymd.substring(6, 8)}` : ""}
          </span>
          <h4 className="text-xs mt-1 leading-none font-extrabold">{day}요일</h4>
        </div>
        <div className="mt-3">
          <span className={`text-[9px] font-black px-2 py-1 rounded-lg inline-block ${badgeClasses}`}>
            {dayTotalKcal > 0 ? `${dayTotalKcal} kcal` : "식단 없음"}
          </span>
        </div>
      </div>
    );
  };

  const renderWeeklyVerticalCardForMobile = (day: string) => {
    const { ymd } = getFormattedDateAndYmd(day, weekOffset);
    const dateObj = weeklyMeals[ymd];

    const hasLunch = dateObj && dateObj.lunch;
    const hasDinner = dateObj && dateObj.dinner;

    const lCal = hasLunch ? dateObj.lunch!.calories : "- kcal";
    const dCal = hasDinner ? dateObj.dinner!.calories : "- kcal";
    const dayTotalKcal = (hasLunch ? parseKcal(lCal) : 0) + (hasDinner ? parseKcal(dCal) : 0);

    const isToday = currentWeekday === day;
    const mobileClasses = isToday
      ? "bg-indigo-600 text-white border-indigo-700 shadow shadow-indigo-600/15"
      : "bg-slate-55 hover:bg-slate-100 text-slate-700 border-slate-100/80";

    const badgeClasses = isToday ? "bg-indigo-700/50 text-white" : "bg-indigo-50 border border-indigo-100 text-indigo-700";
    const subtextClasses = isToday ? "text-indigo-100" : "text-slate-400";

    return (
      <div
        key={day}
        onClick={() => {
          setCurrentWeekday(day);
          setMobileTab("meals"); // return to meals tab automatically
        }}
        className={`border rounded-2xl p-4 transition-all duration-200 cursor-pointer flex items-center justify-between shadow-sm ${mobileClasses}`}
      >
        <div className="flex items-center gap-3">
          <div className="text-center min-w-[32px]">
            <span className={`text-[10px] block font-mono ${subtextClasses}`}>
              {ymd ? `${ymd.substring(4, 6)}/${ymd.substring(6, 8)}` : ""}
            </span>
            <h4 className="text-sm font-extrabold leading-tight">{day}</h4>
          </div>
          <div>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg inline-block ${badgeClasses}`}>
              {dayTotalKcal > 0 ? `${dayTotalKcal} kcal` : "식단 없음"}
            </span>
            <p className={`text-[10px] mt-1 font-semibold ${subtextClasses}`}>
              {hasLunch ? "중식 포함" : "중식 없음"}{hasDinner ? " · 석식 포함" : ""}
            </p>
          </div>
        </div>
        <Calendar className={`w-4 h-4 ${subtextClasses} shrink-0`} />
      </div>
    );
  };

  return (
    <div id="screen-analysis">
      
      {/* ========================================== */}
      {/* 1. DESKTOP VIEW LAYOUT (>= 1024px) */}
      {/* ========================================== */}
      <div className="hidden lg:flex flex-col gap-6 max-w-7xl mx-auto w-full px-6 animate-fade-in">
        
        {/* Desktop Header Zone */}
        <div className="flex items-center justify-between bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mt-2">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-black text-slate-600 hover:text-indigo-600 hover:bg-slate-50 bg-white border border-slate-200 hover:border-slate-300 px-4 py-3 rounded-2xl transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-500" />
              <span>학교 변경</span>
            </button>
            <div>
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full inline-block mr-2">
                실시간 급식
              </span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight font-display inline-block align-middle">
                {school.schoolName}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-right">
            <div>
              <span className="text-sm font-black text-slate-700 flex items-center justify-end gap-1.5">
                <Calendar className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                {formattedDate}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-lg font-mono font-bold inline-block mt-1">
                {activeYmd}
              </span>
            </div>
            <button
              onClick={manualRefresh}
              className={`p-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-2xl border border-slate-200 hover:border-indigo-100 transition-all cursor-pointer ${
                isRefreshing ? "animate-spin" : ""
              }`}
              title="대시보드 실시간 동기화"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Desktop Grid */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* COLUMN 1: Week Selection & Today's Meals (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
            
            {/* Weekday Selector */}
            <div className="bg-white rounded-[2rem] p-4.5 shadow-sm border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  분석 요일 선택
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-lg font-bold">
                  {weekOffset === 0 ? "이번 주" : weekOffset === 1 ? "다음 주" : "다다음 주"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevWeek}
                  disabled={weekOffset <= 0}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl transition-all cursor-pointer"
                  title="이전 주"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="grid grid-cols-7 gap-1 bg-slate-50 p-1 rounded-2xl border border-slate-100/50 flex-grow">
                  {weekdayButtons.map((day) => (
                    <button
                      key={day}
                      onClick={() => setCurrentWeekday(day)}
                      className={`py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                        day === currentWeekday
                          ? "bg-indigo-650 text-white shadow shadow-indigo-600/15"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextWeek}
                  disabled={weekOffset >= 2}
                  className="p-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 text-slate-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl transition-all cursor-pointer"
                  title="다음 주"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Meals Display Component */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-4 flex-grow">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Utensils className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">🍽️ 오늘의 학교 급식</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    선택한 요일의 NEIS 오리지널 식사 내역 (중식 / 석식)
                  </p>
                </div>
              </div>

              {/* LUNCH CARD */}
              <div className="border border-slate-100 rounded-2xl p-4.5 bg-slate-50/20 flex flex-col justify-between h-44">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded-lg tracking-wide uppercase">
                      중식 (Lunch)
                    </span>
                    <span className="text-xs font-mono font-extrabold text-slate-500">
                      {lunch ? lunch.calories : "- kcal"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 leading-relaxed overflow-y-auto max-h-28 custom-scrollbar">
                    {isLoadingMeals ? (
                      <div className="flex items-center gap-2 text-slate-400 py-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-indigo-600"></div>
                        <span>불러오는 중...</span>
                      </div>
                    ) : lunch ? (
                      <p className="break-keep whitespace-pre-wrap">{lunch.menu}</p>
                    ) : (
                      <p className="text-slate-400 italic">오늘은 급식이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* DINNER CARD */}
              <div className="border border-slate-100 rounded-2xl p-4.5 bg-slate-50/20 flex flex-col justify-between h-44">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white font-black text-[9px] rounded-lg tracking-wide uppercase">
                      석식 (Dinner)
                    </span>
                    <span className="text-xs font-mono font-extrabold text-slate-500">
                      {dinner ? dinner.calories : "- kcal"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-700 leading-relaxed overflow-y-auto max-h-28 custom-scrollbar">
                    {isLoadingMeals ? (
                      <div className="flex items-center gap-2 text-slate-400 py-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-indigo-600"></div>
                        <span>불러오는 중...</span>
                      </div>
                    ) : dinner ? (
                      <p className="break-keep whitespace-pre-wrap">{dinner.menu}</p>
                    ) : (
                      <p className="text-slate-400 italic">오늘은 급식이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMN 2: Visual Charts (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col justify-between gap-5">
            
            <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <PieChart className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-800">📊 입체 탄단지 시각화</h3>
                <p class="text-[10px] text-slate-400 font-semibold font-sans">
                  1일 영양소 기준에 근거한 정밀 칼로리 및 성분 비율
                </p>
              </div>
            </div>

            {/* Total Daily calories tracker */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>총 칼로리 섭취량</span>
              </h4>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center">
                <span className="text-2xl font-black text-indigo-600 font-display">
                  {totalKcal > 0 ? `${totalKcal} kcal` : "0 kcal"}
                </span>
                <span className="text-[9px] text-slate-400 mt-1 font-semibold">
                  학교급식 권장기준 실효 1600 kcal 대비
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>권장 수용선 도달율</span>
                  <span className="font-mono text-indigo-600">{progressRatio.toFixed(2)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-teal-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressRatio}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Concentric Activity Rings */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 tracking-widest">
                탄소포화·단백·지질 배분
              </h4>
              <div className="flex justify-center gap-5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                
                {/* Carb SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="absolute w-full h-full" viewBox="0 0 56 56">
                      <g transform="rotate(-90 28 28)">
                        <circle cx="28" cy="28" r="22" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="28" cy="28" r="22"
                          className="stroke-indigo-650 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="138"
                          strokeDashoffset={analysis ? carbOffsetDesktop : 138}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-[9px] font-black text-indigo-650 font-mono">
                      {carbPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 mt-1.5">탄수화물</span>
                </div>

                {/* Protein SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="absolute w-full h-full" viewBox="0 0 56 56">
                      <g transform="rotate(-90 28 28)">
                        <circle cx="28" cy="28" r="22" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="28" cy="28" r="22"
                          className="stroke-amber-500 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="138"
                          strokeDashoffset={analysis ? protOffsetDesktop : 138}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-[9px] font-black text-amber-600 font-mono">
                      {protPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 mt-1.5">단백질</span>
                </div>

                {/* Lipid SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="absolute w-full h-full" viewBox="0 0 56 56">
                      <g transform="rotate(-90 28 28)">
                        <circle cx="28" cy="28" r="22" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="28" cy="28" r="22"
                          className="stroke-rose-500 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="138"
                          strokeDashoffset={analysis ? fatOffsetDesktop : 138}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-[9px] font-black text-rose-500 font-mono">
                      {fatPercent}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 mt-1.5">지방</span>
                </div>

              </div>
            </div>

            {/* Horizontal Stack Scale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                <span>탄단지 실제 흡수 비율</span>
                <span className="text-indigo-600 font-mono font-black">
                  {analysis ? `${carbPercent} : ${protPercent} : ${fatPercent}` : "0 : 0 : 0"}
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-indigo-505 h-full bg-indigo-500 transition-all duration-500" style={{ width: `${carbPercent}%` }}></div>
                <div className="bg-amber-450 h-full bg-amber-500 transition-all duration-500" style={{ width: `${protPercent}%` }}></div>
                <div className="bg-rose-455 h-full bg-rose-550 bg-rose-400 transition-all duration-500" style={{ width: `${fatPercent}%` }}></div>
              </div>
            </div>

            {/* AI score indicator ring */}
            <div className="flex items-center gap-3 p-3.5 bg-indigo-50/20 rounded-2xl border border-indigo-100/50">
              <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                <svg className="absolute w-full h-full" viewBox="0 0 40 40">
                  <g transform="rotate(-90 20 20)">
                    <circle cx="20" cy="20" r="16" className="stroke-slate-200 fill-none" strokeWidth="3"></circle>
                    <circle
                      cx="20" y="20" r="16"
                      className="stroke-indigo-650 fill-none"
                      strokeWidth="3"
                      strokeDasharray="100"
                      strokeDashoffset={analysis ? scoreOffsetDesktop : 100}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 1s ease-out", stroke: "rgb(79, 70, 229)" }}
                    ></circle>
                  </g>
                </svg>
                <span className="text-[10px] font-black text-indigo-600 font-mono">
                  {scoreVal || "-"}
                </span>
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold text-indigo-600 leading-none">
                  AI 종합 균형지수
                </span>
                <p className="text-[11px] text-slate-600 font-bold truncate mt-1">
                  오늘 식단 다양성 평가 평점
                </p>
              </div>
            </div>

            {/* Tags Row */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50 shrink-0">
              {analysis?.tags ? (
                analysis.tags.map((tag) => (
                  <span key={tag} className="text-[9px] font-extrabold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-md">
                    {tag}
                  </span>
                ))
              ) : (
                <>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-400 rounded-md">
                    #분석_대기
                  </span>
                  <span className="text-[9px] font-extrabold px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-400 rounded-md">
                    #식품분석_스마트
                  </span>
                </>
              )}
            </div>

          </div>

          {/* COLUMN 3: Gemini AI 스마트 분석 보드 (col-span-4) */}
          <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-indigo-50/10 via-white to-pink-50/10 rounded-[2rem] p-6 shadow-sm border border-indigo-100/50 flex flex-col gap-4 relative overflow-hidden">
            
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-4 -translate-y-4">
              <Sparkles className="w-32 h-32 text-indigo-600" />
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-indigo-100/30">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex p-2 bg-indigo-600 text-white rounded-2xl shadow shadow-indigo-600/15">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">AI 실시간 식생활 대시보드</h3>
                  <p className="text-[9px] text-slate-400 font-medium">
                    {isServerAI ? "Gemini 3.5 영양 진단 보고서" : "실시간 백엔드 영양 조율 제안"}
                  </p>
                </div>
              </div>
              <button
                onClick={loadDailyMealData}
                disabled={isLoadingAnalysis}
                className="p-2 bg-white hover:bg-slate-50 text-indigo-650 rounded-xl border border-indigo-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
                title="AI 분석 재시도"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalysis ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* AI Loading state or loaded card */}
            {isLoadingAnalysis ? (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-indigo-100 border-t-indigo-600 mb-3"></div>
                <p className="text-xs font-bold text-indigo-600">식단 데이터 기반 실시간 분석 중...</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4 flex-grow flex flex-col justify-between overflow-y-auto max-h-[460px] pr-1 custom-scrollbar animate-fade-in">
                
                {/* One line assessment block */}
                <div className="bg-indigo-600/5 border border-indigo-100 p-4 rounded-2xl">
                  <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                    <Award className="w-4 h-4 text-indigo-650" />
                    <span>★ AI 한줄 평가</span>
                  </h4>
                  <p className="text-xs font-black text-slate-800 leading-relaxed italic">
                    {analysis.oneLineReview}
                  </p>
                </div>

                {/* Analytical comments panels */}
                <div className="space-y-3 text-[11.5px] text-slate-600 leading-relaxed">
                  
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-indigo-700 block mb-1">■ 종합 영양 균형</span>
                    <p>{analysis.detailedReview.nutritionBalance}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-amber-700 block mb-1">■ 아미노 단백질 수준</span>
                    <p>{analysis.detailedReview.proteinLevel}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-emerald-700 block mb-1">■ 채소 무기질 섭취</span>
                    <p>{analysis.detailedReview.vegetableLevel}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-purple-700 block mb-1">■ 성장 적격 요건</span>
                    <p>{analysis.detailedReview.growthSuitability}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-teal-700 block mb-1">■ 신체 피지컬 활력 제안</span>
                    <p>{analysis.detailedReview.exerciseRecommendation}</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                    <span className="font-extrabold text-amber-600 block mb-1">■ 다이어트 혈당 조율</span>
                    <p>{analysis.detailedReview.dietRecommendation}</p>
                  </div>

                </div>

              </div>
            ) : (
              <div className="py-24 text-center text-xs text-slate-400 italic font-semibold">
                급식 식단 정보를 연동해 대시보드 영양 지수를 즉시 분석할 수 있습니다.
              </div>
            )}

          </div>

        </div>

        {/* Row 3: Weekly Calendar Horizontal Strip */}
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarDays className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  🗓️ 주간 급식 계획 (Weekly Meal Plan)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  요일 카드를 클릭하여 해당 일자의 영양 정보와 분석 결과를 바로 확인할 수 있습니다.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold rounded-lg">
              주간 중식·석식
            </span>
          </div>

          {/* Horizontal Grid container */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3.5 pb-1">
            {isLoadingWeekly ? (
              <div className="col-span-7 py-8 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-100 border-t-indigo-600"></div>
                <span>주간 식단 타임라인 구성 중...</span>
              </div>
            ) : (
              weekdayButtons.map((day) => renderWeeklyPlanForCard(day))
            )}
          </div>
        </div>

      </div>

      {/* ========================================== */}
      {/* 2. MOBILE VIEW LAYOUT (< 1024px) */}
      {/* ========================================== */}
      <div className="block lg:hidden pb-28 animate-fade-in relative mx-auto max-w-lg w-full">
        
        {/* Mobile Custom App Bar */}
        <div className="px-4 py-3.5 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-150/50 mb-4 mx-4 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] font-black text-indigo-600 block">실시간 학교 급식</span>
            <h2 className="text-sm font-black text-slate-800 truncate mt-1">
              {school.schoolName}
            </h2>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[10px] font-extrabold text-slate-600 hover:text-indigo-600 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-500" />
            <span>학교 변경</span>
          </button>
        </div>

        {/* Date display bar on Mobile */}
        <div className="px-5 pb-3.5 border-b border-slate-100 mb-4 flex items-center justify-between">
          <span className="text-xs font-black text-slate-600 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
            {formattedDate}
          </span>
          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-mono font-extrabold rounded-lg">
            {activeYmd}
          </span>
        </div>

        {/* ======================================================== */}
        {/* TAB PANE 1: [급식] (Meals) */}
        {/* ======================================================== */}
        {mobileTab === "meals" && (
          <div className="px-4 space-y-5 animate-fade-in">
            
            {/* Weekday Picker */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  요일 선택
                </span>
                <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-750 px-2 py-0.5 rounded-lg font-bold">
                  {weekOffset === 0 ? "이번 주" : weekOffset === 1 ? "다음 주" : "다다음 주"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevWeek}
                  disabled={weekOffset <= 0}
                  className="p-2.5 bg-white shadow-sm hover:bg-slate-50 border border-slate-150 text-slate-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl transition-all cursor-pointer"
                  title="이전 주"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex-grow bg-white rounded-2xl p-1.5 shadow-sm border border-slate-100 flex items-center gap-1 overflow-x-auto custom-scrollbar">
                  {weekdayButtons.map((day) => (
                    <button
                      key={day}
                      onClick={() => setCurrentWeekday(day)}
                      className={`flex-1 py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                        day === currentWeekday
                          ? "bg-indigo-600 text-white shadow shadow-indigo-600/15"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleNextWeek}
                  disabled={weekOffset >= 2}
                  className="p-2.5 bg-white shadow-sm hover:bg-slate-50 border border-slate-150 text-slate-500 disabled:opacity-30 disabled:pointer-events-none rounded-xl transition-all cursor-pointer"
                  title="다음 주"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Meals Cards display with highly readable fonts */}
            <div className="space-y-4">
              
              {/* LUNCH CARD */}
              <div className="bg-white rounded-3xl p-6 shadow bg-gradient-to-br from-white to-amber-50/5 border border-amber-100 flex flex-col justify-between min-h-48 relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <span className="px-3.5 py-1.5 bg-amber-500 text-white font-black text-xs rounded-xl tracking-wide uppercase shadow shadow-amber-500/10">
                      중식 LUNCH
                    </span>
                    <span className="text-sm font-mono font-black text-slate-600">
                      {lunch ? lunch.calories : "- kcal"}
                    </span>
                  </div>
                  <div className="py-2 px-1 select-text">
                    {isLoadingMeals ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-300 border-t-amber-600"></div>
                    ) : lunch ? (
                      <p className="text-[15px] font-black text-slate-850 leading-relaxed tracking-tight break-keep whitespace-pre-line">
                        {lunch.menu}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">오늘은 급식이 없습니다.</p>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold mt-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    <span>안전 인증 식재료 사용</span>
                  </span>
                  <span>정부 표준 규격</span>
                </div>
              </div>

              {/* DINNER CARD */}
              <div className="bg-white rounded-3xl p-6 shadow bg-gradient-to-br from-white to-indigo-50/5 border border-indigo-100 flex flex-col justify-between min-h-48 relative overflow-hidden">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <span className="px-3.5 py-1.5 bg-indigo-600 text-white font-black text-xs rounded-xl tracking-wide uppercase shadow shadow-indigo-600/10">
                      석식 DINNER
                    </span>
                    <span className="text-sm font-mono font-black text-slate-600">
                      {dinner ? dinner.calories : "- kcal"}
                    </span>
                  </div>
                  <div className="py-2 px-1 select-text">
                    {isLoadingMeals ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-300 border-t-indigo-600"></div>
                    ) : dinner ? (
                      <p className="text-[15px] font-black text-slate-850 leading-relaxed tracking-tight break-keep whitespace-pre-line">
                        {dinner.menu}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">오늘은 급식이 없습니다.</p>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold mt-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                    <span>식약처 가이드 기준</span>
                  </span>
                  <span>영양 균형 보정식</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB PANE 2: [AI분석] (AI Analysis) */}
        {/* ======================================================== */}
        {mobileTab === "ai" && (
          <div className="px-4 space-y-4 animate-fade-in">
            
            {isLoadingAnalysis ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-indigo-150 border-t-indigo-600 mb-3"></div>
                <p className="text-xs font-extrabold text-indigo-600">급식 영양 균형 분석 중...</p>
              </div>
            ) : analysis ? (
              <>
                <div className="bg-gradient-to-br from-indigo-50 to-pink-50/25 border border-indigo-100/90 p-5 rounded-3xl shadow-sm">
                  <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                    <Award className="w-4 h-4 text-indigo-650 animate-pulse" />
                    <span>★ AI 한줄 평가</span>
                  </h4>
                  <p className="text-xs font-black text-slate-800 leading-relaxed italic">
                    {analysis.oneLineReview}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-indigo-600 block mb-2">■ 종합 영양 균형</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.nutritionBalance}</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-amber-700 block mb-2">■ 아미노 단백질 수준</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.proteinLevel}</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-emerald-700 block mb-2">■ 채소 무기질 섭취</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.vegetableLevel}</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-purple-700 block mb-2">■ 성장 적격 요건</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.growthSuitability}</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-teal-700 block mb-2">■ 신체 피지컬 활력 제안</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.exerciseRecommendation}</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm">
                    <span className="text-xs font-black text-amber-600 block mb-2">■ 다이어트 혈당 조율</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{analysis.detailedReview.dietRecommendation}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 italic">
                분석에 사용될 급식 자료가 수급되지 않았습니다.
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB PANE 3: [영양] (Nutrition Dashboard) */}
        {/* ======================================================== */}
        {mobileTab === "nutrition" && (
          <div className="px-4 space-y-4 animate-fade-in">
            
            {/* Total Calories Counter Card */}
            <div className="bg-white rounded-3xl p-5.5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 animate-fade-in">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Flame className="w-4.5 h-4.5 text-rose-500" />
                  <span>칼로리 섭취 진단</span>
                </span>
                <span className="text-[9px] font-mono bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md font-black">
                  1600 kcal 기준
                </span>
              </div>

              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <span className="text-2xl font-black text-indigo-650 font-display">
                    {totalKcal > 0 ? `${totalKcal} kcal` : "0 kcal"}
                  </span>
                  <span className="block text-[9px] text-slate-400 font-bold mt-0.5">
                    하루 누적 열량 (중식+석식)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-mono font-black text-indigo-600">
                    {progressRatio.toFixed(2)}%
                  </span>
                  <span className="block text-[9px] text-slate-400 font-bold mt-0.5">
                    권장 수치선 도달율
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-teal-400 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressRatio}%` }}
                ></div>
              </div>
            </div>

            {/* Concentric Activity Rings Card */}
            <div className="bg-white rounded-3xl p-5.5 shadow-sm border border-slate-100">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-3 border-b border-slate-100 mb-4">
                <PieChart className="w-4.5 h-4.5 text-indigo-600" />
                <span>탄단지(C-P-F) 활력 비율</span>
              </span>

              <div className="grid grid-cols-3 gap-3 justify-center text-center">
                
                {/* Carb SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-slate-50 rounded-2xl p-1">
                    <svg className="absolute w-full h-full" viewBox="0 0 64 64">
                      <g transform="rotate(-90 32 32)">
                        <circle cx="32" cy="32" r="26" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="32" cy="32" r="26"
                          className="stroke-indigo-600 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="163"
                          strokeDashoffset={analysis ? carbOffsetMobile : 163}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-xs font-black text-indigo-600 font-mono">
                      {carbPercent}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1.5">탄수화물</span>
                </div>

                {/* Protein SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-slate-50 rounded-2xl p-1">
                    <svg className="absolute w-full h-full" viewBox="0 0 64 64">
                      <g transform="rotate(-90 32 32)">
                        <circle cx="32" cy="32" r="26" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="32" cy="32" r="26"
                          className="stroke-amber-500 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="163"
                          strokeDashoffset={analysis ? protOffsetMobile : 163}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-xs font-black text-amber-500 font-mono">
                      {protPercent}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1.5">단백질</span>
                </div>

                {/* Lipid SVG Ring */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 flex items-center justify-center bg-slate-50 rounded-2xl p-1">
                    <svg className="absolute w-full h-full" viewBox="0 0 64 64">
                      <g transform="rotate(-90 32 32)">
                        <circle cx="32" cy="32" r="26" className="stroke-slate-100 fill-none" strokeWidth="4.5"></circle>
                        <circle
                          cx="32" cy="32" r="26"
                          className="stroke-rose-500 fill-none"
                          strokeWidth="4.5"
                          strokeDasharray="163"
                          strokeDashoffset={analysis ? fatOffsetMobile : 163}
                          strokeLinecap="round"
                          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
                        ></circle>
                      </g>
                    </svg>
                    <span className="text-xs font-black text-rose-500 font-mono">
                      {fatPercent}%
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1.5">지방</span>
                </div>

              </div>
            </div>

            {/* Distribution stacks and ratings */}
            <div className="bg-white rounded-3xl p-5.5 shadow-sm border border-slate-100 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                  <span>탄단지 실제 흡수 조합도</span>
                  <span className="text-indigo-650 font-mono font-black">{carbPercent} : {protPercent} : {fatPercent}</span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex animate-fade-in">
                  <div className="bg-indigo-505 h-full bg-indigo-500 transition-all duration-500" style={{ width: `${carbPercent}%` }}></div>
                  <div className="bg-amber-450 h-full bg-amber-500 transition-all duration-500" style={{ width: `${protPercent}%` }}></div>
                  <div className="bg-rose-455 h-full bg-rose-400 transition-all duration-500" style={{ width: `${fatPercent}%` }}></div>
                </div>
              </div>

              {/* Legend row */}
              <div className="grid grid-cols-3 gap-2 justify-center text-center text-[10px] font-semibold text-slate-400 pb-1">
                <span className="flex items-center justify-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block text-indigo-500"></span>
                  <span>탄수화물</span>
                </span>
                <span className="flex items-center justify-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block text-amber-500"></span>
                  <span>단백질</span>
                </span>
                <span className="flex items-center justify-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block text-rose-400"></span>
                  <span>지방</span>
                </span>
              </div>

              {/* Comprehensive AI health rating inside mobile sheet */}
              <div className="p-4 bg-indigo-50/25 rounded-2xl border border-indigo-100/50 flex items-center gap-4">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="absolute w-full h-full" viewBox="0 0 48 48">
                    <g transform="rotate(-90 24 24)">
                      <circle cx="24" cy="24" r="19" className="stroke-slate-200 fill-none" strokeWidth="3"></circle>
                      <circle
                        cx="24" cy="24" r="19"
                        className="stroke-indigo-600 fill-none"
                        strokeWidth="3"
                        strokeDasharray="119"
                        strokeDashoffset={analysis ? scoreOffsetMobile : 119}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1s ease-out" }}
                      ></circle>
                    </g>
                  </svg>
                  <span className="text-xs font-black text-indigo-650 font-mono">{scoreVal || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-700 block uppercase tracking-wide">
                    AI 종합 식단 균형지수
                  </span>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    식생활 다양성 및 칼로리 밸런스 평점
                  </p>
                </div>
              </div>

              {/* Tags Row */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-50 shrink-0">
                {analysis?.tags?.map((tag) => (
                  <span key={tag} className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-md">
                    {tag}
                  </span>
                ))}
              </div>

            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB PANE 4: [주간] (Weekly list) */}
        {/* ======================================================== */}
        {mobileTab === "weekly" && (
          <div className="px-4 space-y-4 animate-fade-in animate-fade-in">
            
            <div className="px-1.5">
              <h4 className="text-xs font-black text-slate-800">🏫 주간 식생활 분석 타임라인</h4>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                요일별 급식 카드를 클릭하면 해당 일자의 상세 영양 분석 및 AI 조합도로 즉시 이동합니다.
              </p>
            </div>

            <div className="space-y-3.5">
              {isLoadingWeekly ? (
                <div className="py-8 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-100 border-t-indigo-600"></div>
                  <span>주간 식단 불러오는 중...</span>
                </div>
              ) : (
                weekdayButtons.map((day) => renderWeeklyVerticalCardForMobile(day))
              )}
            </div>

          </div>
        )}

        {/* FIXED BOTTOM TAB BAR FOR MOBILE COMPONENT */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-150 shadow-2xl z-50 pb-safe">
          <div className="max-w-md mx-auto h-18 px-3 flex items-center justify-between">
            
            {/* Tab 1: Meals */}
            <button
              onClick={() => setMobileTab("meals")}
              className={`mobile-tab-btn flex-1 flex flex-col items-center justify-center py-2 relative gap-1 text-center cursor-pointer ${
                mobileTab === "meals" ? "text-indigo-600" : "text-slate-400 hover:text-slate-650"
              }`}
            >
              <Utensils className="w-5 h-5 transition-transform duration-200" />
              <span className="text-[10px] tracking-tight font-black">급식</span>
              <span
                className={`absolute bottom-0 w-8 h-1 bg-indigo-600 rounded-full transition-all duration-300 ${
                  mobileTab === "meals" ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`}
              ></span>
            </button>

            {/* Tab 2: AI analysis */}
            <button
              onClick={() => setMobileTab("ai")}
              className={`mobile-tab-btn flex-1 flex flex-col items-center justify-center py-2 relative gap-1 text-center cursor-pointer ${
                mobileTab === "ai" ? "text-indigo-600" : "text-slate-400 hover:text-slate-650"
              }`}
            >
              <Sparkles className="w-5 h-5 transition-transform duration-200" />
              <span className="text-[10px] tracking-tight font-black">AI분석</span>
              <span
                className={`absolute bottom-0 w-8 h-1 bg-indigo-600 rounded-full transition-all duration-300 ${
                  mobileTab === "ai" ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`}
              ></span>
            </button>

            {/* Tab 3: Nutrition metrics */}
            <button
              onClick={() => setMobileTab("nutrition")}
              className={`mobile-tab-btn flex-1 flex flex-col items-center justify-center py-2 relative gap-1 text-center cursor-pointer ${
                mobileTab === "nutrition" ? "text-indigo-600" : "text-slate-400 hover:text-slate-650"
              }`}
            >
              <TrendingUp className="w-5 h-5 transition-transform duration-200" />
              <span className="text-[10px] tracking-tight font-black">영양</span>
              <span
                className={`absolute bottom-0 w-8 h-1 bg-indigo-600 rounded-full transition-all duration-300 ${
                  mobileTab === "nutrition" ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`}
              ></span>
            </button>

            {/* Tab 4: Weekly List */}
            <button
              onClick={() => setMobileTab("weekly")}
              className={`mobile-tab-btn flex-1 flex flex-col items-center justify-center py-2 relative gap-1 text-center cursor-pointer ${
                mobileTab === "weekly" ? "text-indigo-600" : "text-slate-400 hover:text-slate-650"
              }`}
            >
              <Calendar className="w-5 h-5 transition-transform duration-200" />
              <span className="text-[10px] tracking-tight font-black">주간</span>
              <span
                className={`absolute bottom-0 w-8 h-1 bg-indigo-600 rounded-full transition-all duration-300 ${
                  mobileTab === "weekly" ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                }`}
              ></span>
            </button>

          </div>
        </div>

      </div>

    </div>
  );
}
