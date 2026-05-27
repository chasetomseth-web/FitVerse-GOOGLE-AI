
const BASE_URL = 'https://world.openfoodfacts.org';

export interface OFFProduct {
  _id: string;
  product_name: string;
  brands?: string;
  image_url?: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    'energy-kcal_serving'?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
  };
  serving_size?: string;
}

export interface OFFSearchResult {
  count: number;
  page: number;
  page_size: number;
  products: OFFProduct[];
}

export const searchOFFFoods = async (query: string, pageSize: number = 10): Promise<OFFSearchResult> => {
  try {
    const response = await fetch(
      `/api/off/search?q=${encodeURIComponent(query)}&page_size=${pageSize}`
    );

    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching Open Food Facts:', error);
    return { count: 0, page: 1, page_size: pageSize, products: [] };
  }
};

export const getOFFProductByBarcode = async (barcode: string): Promise<OFFProduct | null> => {
  try {
    const response = await fetch(`/api/off/product/${barcode}`);
    if (!response.ok) throw new Error('Failed to fetch product by barcode');
    const data = await response.json();
    return data.status === 1 ? data.product : null;
  } catch (error) {
    console.error('Error fetching OFF product:', error);
    return null;
  }
};

export const extractOFFMacros = (product: OFFProduct) => {
  const n = product.nutriments;
  
  // Prefer serving values if available, otherwise fallback to 100g
  // Note: 100g is usually more reliable in OFF
  const calories = n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0;
  const protein = n.proteins_serving ?? n.proteins_100g ?? 0;
  const carbs = n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0;
  const fat = n.fat_serving ?? n.fat_100g ?? 0;

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat)
  };
};
