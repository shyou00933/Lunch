export interface School {
  schoolName: string;
  officeCode: string;
  schoolCode: string;
  officeName: string;
}

export interface DayMeal {
  menu: string;
  calories: string;
}

export interface WeeklyMeal {
  lunch: DayMeal | null;
  dinner: DayMeal | null;
}

export interface AIAnalysis {
  score: number;
  ratioCarb: number;
  ratioProt: number;
  ratioFat: number;
  oneLineReview: string;
  tags: string[];
  detailedReview: {
    nutritionBalance: string;
    proteinLevel: string;
    vegetableLevel: string;
    growthSuitability: string;
    exerciseRecommendation: string;
    dietRecommendation: string;
  };
  isAI?: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "warn" | "error" | "info";
}
