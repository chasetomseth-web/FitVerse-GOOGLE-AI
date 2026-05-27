
const FDC_API_KEY = import.meta.env.VITE_FDC_API_KEY;
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

export interface FDCFoodSearchCriteria {
  query: string;
  dataType?: string[];
  pageSize?: number;
  pageNumber?: number;
  sortBy?: string;
  sortOrder?: string;
  brandOwner?: string;
}

export interface FDCFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  derivationCode: string;
  derivationDescription: string;
  value: number;
}

export interface FDCSearchResultFood {
  fdcId: number;
  dataType: string;
  description: string;
  foodCode?: string;
  foodNutrients: FDCFoodNutrient[];
  publicationDate: string;
  scientificName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  ingredients?: string;
  ndbNumber?: string;
  additionalDescriptions?: string;
  allHighlightFields?: string;
  score: number;
}

export interface FDCSearchResult {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: FDCSearchResultFood[];
}

export const searchFoods = async (query: string, pageSize: number = 10): Promise<FDCSearchResult> => {
  if (!FDC_API_KEY) {
    console.warn('FDC API Key is missing. Please add VITE_FDC_API_KEY to your environment variables.');
    return { totalHits: 0, currentPage: 0, totalPages: 0, foods: [] };
  }

  try {
    const response = await fetch(`${BASE_URL}/foods/search?api_key=${FDC_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        pageSize,
        dataType: ["Branded", "Foundation", "Survey (FNDDS)", "SR Legacy"]
      }),
    });

    if (!response.ok) {
      throw new Error(`FDC API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching FDC foods:', error);
    return { totalHits: 0, currentPage: 0, totalPages: 0, foods: [] };
  }
};

export const getFoodDetails = async (fdcId: number): Promise<any> => {
  if (!FDC_API_KEY) return null;

  try {
    const response = await fetch(`${BASE_URL}/food/${fdcId}?api_key=${FDC_API_KEY}`);
    if (!response.ok) throw new Error('Failed to fetch food details');
    return await response.json();
  } catch (error) {
    console.error('Error fetching food details:', error);
    return null;
  }
};

export const extractMacros = (food: FDCSearchResultFood) => {
  const nutrients = food.foodNutrients;
  
  // FDC Nutrient IDs:
  // 1008: Calories (kcal)
  // 1003: Protein (g)
  // 1005: Carbohydrate (g)
  // 1004: Total lipid (fat) (g)
  
  const getNutrientValue = (id: number) => {
    const nutrient = nutrients.find(n => n.nutrientId === id);
    return nutrient ? nutrient.value : 0;
  };

  return {
    calories: Math.round(getNutrientValue(1008)),
    protein: Math.round(getNutrientValue(1003)),
    carbs: Math.round(getNutrientValue(1005)),
    fat: Math.round(getNutrientValue(1004))
  };
};
