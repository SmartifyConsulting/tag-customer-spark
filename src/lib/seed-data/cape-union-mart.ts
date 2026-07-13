// Representative demo catalogue for reseeding a retailer as "Cape Union Mart" —
// a South African outdoor/travel retail chain. This is synthetic sample data
// (plausible product names/prices/branch list) for demo purposes, not a feed
// of real inventory or a verified current store directory.

export const CAPE_UNION_MART_STORES: { name: string; city: string; province: string; address: string }[] = [
  { name: "Cape Union Mart V&A Waterfront", city: "Cape Town", province: "Western Cape", address: "Victoria Wharf Shopping Centre, V&A Waterfront" },
  { name: "Cape Union Mart Canal Walk", city: "Cape Town", province: "Western Cape", address: "Canal Walk Shopping Centre, Century City" },
  { name: "Cape Union Mart Tyger Valley", city: "Bellville", province: "Western Cape", address: "Tyger Valley Shopping Centre" },
  { name: "Cape Union Mart N1 City", city: "Cape Town", province: "Western Cape", address: "N1 City Mall" },
  { name: "Cape Union Mart Garden Route Mall", city: "George", province: "Western Cape", address: "Garden Route Mall" },
  { name: "Cape Union Mart Sandton City", city: "Sandton", province: "Gauteng", address: "Sandton City Shopping Centre" },
  { name: "Cape Union Mart Rosebank Mall", city: "Johannesburg", province: "Gauteng", address: "The Zone @ Rosebank" },
  { name: "Cape Union Mart Eastgate", city: "Johannesburg", province: "Gauteng", address: "Eastgate Shopping Centre" },
  { name: "Cape Union Mart Menlyn Park", city: "Pretoria", province: "Gauteng", address: "Menlyn Park Shopping Centre" },
  { name: "Cape Union Mart Brooklyn Mall", city: "Pretoria", province: "Gauteng", address: "Brooklyn Mall" },
  { name: "Cape Union Mart Gateway", city: "Umhlanga", province: "KwaZulu-Natal", address: "Gateway Theatre of Shopping" },
  { name: "Cape Union Mart Pavilion", city: "Durban", province: "KwaZulu-Natal", address: "The Pavilion Shopping Centre" },
  { name: "Cape Union Mart Bay West", city: "Gqeberha", province: "Eastern Cape", address: "Bay West Mall" },
  { name: "Cape Union Mart Mimosa Mall", city: "Bloemfontein", province: "Free State", address: "Mimosa Mall" },
  { name: "Cape Union Mart Riverside Mall", city: "Nelspruit", province: "Mpumalanga", address: "Riverside Mall" },
];

export const CAPE_UNION_MART_BRANDS: string[] = [
  "K-Way",
  "Capestorm",
  "Old Khaki",
  "Salomon",
  "Merrell",
  "The North Face",
  "Columbia",
  "First Ascent",
];

export const CAPE_UNION_MART_CATEGORY_TREE: { name: string; children: string[] }[] = [
  { name: "Men's Apparel", children: ["Jackets & Fleeces", "Shirts & Tops", "Pants & Shorts", "Thermals & Base Layers"] },
  { name: "Women's Apparel", children: ["Jackets & Fleeces", "Shirts & Tops", "Pants & Shorts", "Thermals & Base Layers"] },
  { name: "Kids' Apparel", children: ["Jackets", "Tops & Bottoms"] },
  { name: "Footwear", children: ["Hiking Boots", "Trail Shoes", "Sandals"] },
  { name: "Camping & Outdoor", children: ["Tents", "Sleeping Bags", "Cookware", "Backpacks"] },
  { name: "Travel & Luggage", children: ["Suitcases", "Duffel Bags", "Travel Accessories"] },
  { name: "Accessories", children: ["Headwear", "Gloves & Socks", "Water Bottles & Hydration"] },
];

export type SeedProduct = { department: string; subcategory: string; brand: string; name: string; priceRand: number };

export const CAPE_UNION_MART_PRODUCTS: SeedProduct[] = [
  // Men's Apparel
  { department: "Men's Apparel", subcategory: "Jackets & Fleeces", brand: "K-Way", name: "K-Way Men's Alpine Softshell Jacket", priceRand: 1899 },
  { department: "Men's Apparel", subcategory: "Jackets & Fleeces", brand: "Capestorm", name: "Capestorm Men's Trailblazer Fleece", priceRand: 799 },
  { department: "Men's Apparel", subcategory: "Jackets & Fleeces", brand: "The North Face", name: "The North Face Men's Resolve Rain Jacket", priceRand: 1599 },
  { department: "Men's Apparel", subcategory: "Shirts & Tops", brand: "Old Khaki", name: "Old Khaki Men's Pique Golfer", priceRand: 399 },
  { department: "Men's Apparel", subcategory: "Shirts & Tops", brand: "K-Way", name: "K-Way Men's Quick-Dry Hiking Shirt", priceRand: 549 },
  { department: "Men's Apparel", subcategory: "Shirts & Tops", brand: "Columbia", name: "Columbia Men's Silver Ridge Shirt", priceRand: 699 },
  { department: "Men's Apparel", subcategory: "Pants & Shorts", brand: "K-Way", name: "K-Way Men's Convertible Hiking Pants", priceRand: 899 },
  { department: "Men's Apparel", subcategory: "Pants & Shorts", brand: "Capestorm", name: "Capestorm Men's Cargo Shorts", priceRand: 499 },
  { department: "Men's Apparel", subcategory: "Pants & Shorts", brand: "First Ascent", name: "First Ascent Men's Trail Running Tights", priceRand: 649 },
  { department: "Men's Apparel", subcategory: "Thermals & Base Layers", brand: "K-Way", name: "K-Way Men's Merino Base Layer Top", priceRand: 699 },
  { department: "Men's Apparel", subcategory: "Thermals & Base Layers", brand: "Capestorm", name: "Capestorm Men's Thermal Long-Sleeve", priceRand: 399 },

  // Women's Apparel
  { department: "Women's Apparel", subcategory: "Jackets & Fleeces", brand: "K-Way", name: "K-Way Women's Alpine Softshell Jacket", priceRand: 1899 },
  { department: "Women's Apparel", subcategory: "Jackets & Fleeces", brand: "Capestorm", name: "Capestorm Women's Trailblazer Fleece", priceRand: 799 },
  { department: "Women's Apparel", subcategory: "Jackets & Fleeces", brand: "The North Face", name: "The North Face Women's Resolve Rain Jacket", priceRand: 1599 },
  { department: "Women's Apparel", subcategory: "Shirts & Tops", brand: "Old Khaki", name: "Old Khaki Women's Pique Golfer", priceRand: 399 },
  { department: "Women's Apparel", subcategory: "Shirts & Tops", brand: "K-Way", name: "K-Way Women's Quick-Dry Hiking Shirt", priceRand: 549 },
  { department: "Women's Apparel", subcategory: "Shirts & Tops", brand: "Columbia", name: "Columbia Women's Silver Ridge Shirt", priceRand: 699 },
  { department: "Women's Apparel", subcategory: "Pants & Shorts", brand: "K-Way", name: "K-Way Women's Convertible Hiking Pants", priceRand: 899 },
  { department: "Women's Apparel", subcategory: "Pants & Shorts", brand: "Capestorm", name: "Capestorm Women's Cargo Shorts", priceRand: 499 },
  { department: "Women's Apparel", subcategory: "Pants & Shorts", brand: "First Ascent", name: "First Ascent Women's Trail Running Tights", priceRand: 649 },
  { department: "Women's Apparel", subcategory: "Thermals & Base Layers", brand: "K-Way", name: "K-Way Women's Merino Base Layer Top", priceRand: 699 },
  { department: "Women's Apparel", subcategory: "Thermals & Base Layers", brand: "Capestorm", name: "Capestorm Women's Thermal Long-Sleeve", priceRand: 399 },

  // Kids' Apparel
  { department: "Kids' Apparel", subcategory: "Jackets", brand: "K-Way", name: "K-Way Kids' Puffer Jacket", priceRand: 999 },
  { department: "Kids' Apparel", subcategory: "Jackets", brand: "Capestorm", name: "Capestorm Kids' Rain Jacket", priceRand: 699 },
  { department: "Kids' Apparel", subcategory: "Tops & Bottoms", brand: "Old Khaki", name: "Old Khaki Kids' Graphic Tee", priceRand: 249 },
  { department: "Kids' Apparel", subcategory: "Tops & Bottoms", brand: "K-Way", name: "K-Way Kids' Fleece Pants", priceRand: 449 },

  // Footwear
  { department: "Footwear", subcategory: "Hiking Boots", brand: "Merrell", name: "Merrell Moab 3 Mid Hiking Boot", priceRand: 2399 },
  { department: "Footwear", subcategory: "Hiking Boots", brand: "Salomon", name: "Salomon X Ultra 4 Mid GTX", priceRand: 2999 },
  { department: "Footwear", subcategory: "Hiking Boots", brand: "K-Way", name: "K-Way Trailblazer Boot", priceRand: 1799 },
  { department: "Footwear", subcategory: "Trail Shoes", brand: "Salomon", name: "Salomon Speedcross 5", priceRand: 2199 },
  { department: "Footwear", subcategory: "Trail Shoes", brand: "Merrell", name: "Merrell Trail Glove 6", priceRand: 1899 },
  { department: "Footwear", subcategory: "Sandals", brand: "Merrell", name: "Merrell Kahuna Sandal", priceRand: 899 },
  { department: "Footwear", subcategory: "Sandals", brand: "K-Way", name: "K-Way Amphibian Sandal", priceRand: 599 },

  // Camping & Outdoor
  { department: "Camping & Outdoor", subcategory: "Tents", brand: "K-Way", name: "K-Way Dome 3-Person Tent", priceRand: 1999 },
  { department: "Camping & Outdoor", subcategory: "Tents", brand: "Capestorm", name: "Capestorm Nomad 2-Person Tent", priceRand: 1499 },
  { department: "Camping & Outdoor", subcategory: "Tents", brand: "K-Way", name: "K-Way Basecamp 6-Person Tent", priceRand: 3999 },
  { department: "Camping & Outdoor", subcategory: "Sleeping Bags", brand: "K-Way", name: "K-Way Adventurer 3-Season Sleeping Bag", priceRand: 899 },
  { department: "Camping & Outdoor", subcategory: "Sleeping Bags", brand: "Capestorm", name: "Capestorm Compact Sleeping Bag", priceRand: 699 },
  { department: "Camping & Outdoor", subcategory: "Cookware", brand: "K-Way", name: "K-Way Camp Stove Set", priceRand: 549 },
  { department: "Camping & Outdoor", subcategory: "Cookware", brand: "Capestorm", name: "Capestorm Aluminium Cookware Set", priceRand: 399 },
  { department: "Camping & Outdoor", subcategory: "Backpacks", brand: "K-Way", name: "K-Way Trailhead 40L Backpack", priceRand: 1299 },
  { department: "Camping & Outdoor", subcategory: "Backpacks", brand: "Salomon", name: "Salomon Trailblazer 30L", priceRand: 1599 },
  { department: "Camping & Outdoor", subcategory: "Backpacks", brand: "Capestorm", name: "Capestorm Summit 65L Backpack", priceRand: 1899 },

  // Travel & Luggage
  { department: "Travel & Luggage", subcategory: "Suitcases", brand: "K-Way", name: "K-Way Voyager 65L Hardshell Suitcase", priceRand: 1899 },
  { department: "Travel & Luggage", subcategory: "Suitcases", brand: "Capestorm", name: "Capestorm Trekker 75L Softshell Case", priceRand: 1599 },
  { department: "Travel & Luggage", subcategory: "Duffel Bags", brand: "K-Way", name: "K-Way Expedition Duffel 90L", priceRand: 999 },
  { department: "Travel & Luggage", subcategory: "Duffel Bags", brand: "Capestorm", name: "Capestorm Weekender Duffel 50L", priceRand: 699 },
  { department: "Travel & Luggage", subcategory: "Travel Accessories", brand: "K-Way", name: "K-Way Packing Cube Set", priceRand: 299 },
  { department: "Travel & Luggage", subcategory: "Travel Accessories", brand: "Capestorm", name: "Capestorm Travel Pillow & Blanket Set", priceRand: 199 },

  // Accessories
  { department: "Accessories", subcategory: "Headwear", brand: "K-Way", name: "K-Way Adventure Cap", priceRand: 249 },
  { department: "Accessories", subcategory: "Headwear", brand: "Capestorm", name: "Capestorm Beanie", priceRand: 199 },
  { department: "Accessories", subcategory: "Headwear", brand: "Old Khaki", name: "Old Khaki Bucket Hat", priceRand: 229 },
  { department: "Accessories", subcategory: "Gloves & Socks", brand: "K-Way", name: "K-Way Merino Hiking Socks 2-Pack", priceRand: 199 },
  { department: "Accessories", subcategory: "Gloves & Socks", brand: "Capestorm", name: "Capestorm Fleece Gloves", priceRand: 149 },
  { department: "Accessories", subcategory: "Water Bottles & Hydration", brand: "K-Way", name: "K-Way 1L Steel Water Bottle", priceRand: 249 },
  { department: "Accessories", subcategory: "Water Bottles & Hydration", brand: "Salomon", name: "Salomon Hydration Vest 5L", priceRand: 1299 },
];
