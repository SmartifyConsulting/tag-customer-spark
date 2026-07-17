// Predefined taxonomy hierarchies for common retail/wholesale sectors, used
// to give a new profile a sensible starting point instead of a blank slate.
// Levels use the same attribute_key shape as a saved taxonomy_levels row
// (`custom:<slug>` for attributes that aren't in ATTRIBUTE_CATALOG).

export type TaxonomyTemplateLevel = { attribute_key: string; label: string };

export type TaxonomyTemplate = {
  id: string;
  name: string;
  group: "Retail" | "Wholesale";
  description: string;
  levels: TaxonomyTemplateLevel[];
};

export const TAXONOMY_TEMPLATES: TaxonomyTemplate[] = [
  {
    id: "fashion-apparel",
    name: "Fashion & Apparel",
    group: "Retail",
    description: "Clothing, footwear and accessories retailers.",
    levels: [
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "gender", label: "Gender" },
      { attribute_key: "size", label: "Size" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "grocery-supermarket",
    name: "Grocery & Supermarket",
    group: "Retail",
    description: "Food, beverage and household FMCG retailers.",
    levels: [
      { attribute_key: "department", label: "Department" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "pharmacy-health",
    name: "Pharmacy & Health",
    group: "Retail",
    description: "Pharmacies, health and wellness stores.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:dosage_form", label: "Dosage Form" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "electronics-appliances",
    name: "Electronics & Appliances",
    group: "Retail",
    description: "Consumer electronics, computing and appliances.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:model_number", label: "Model Number" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "home-diy-hardware",
    name: "Home, DIY & Hardware",
    group: "Retail",
    description: "Hardware stores, home improvement and building supplies.",
    levels: [
      { attribute_key: "department", label: "Department" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "sporting-outdoor",
    name: "Sporting Goods & Outdoor",
    group: "Retail",
    description: "Sporting equipment, camping and outdoor apparel.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "gender", label: "Gender" },
      { attribute_key: "size", label: "Size" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "beauty-cosmetics",
    name: "Beauty & Cosmetics",
    group: "Retail",
    description: "Cosmetics, skincare and haircare retailers.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:skin_hair_type", label: "Skin / Hair Type" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "liquor-bottle-store",
    name: "Liquor & Bottle Store",
    group: "Retail",
    description: "Beer, wine and spirits retailers.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:volume", label: "Volume" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "automotive-parts",
    name: "Automotive Parts",
    group: "Retail",
    description: "Auto parts, accessories and consumables.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:vehicle_fitment", label: "Vehicle Fitment" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "toys-games",
    name: "Toys & Games",
    group: "Retail",
    description: "Toy stores and games retailers.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:age_group", label: "Age Group" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "furniture-homeware",
    name: "Furniture & Homeware",
    group: "Retail",
    description: "Furniture, decor and homeware retailers.",
    levels: [
      { attribute_key: "department", label: "Department" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "pet-supplies",
    name: "Pet Supplies",
    group: "Retail",
    description: "Pet food, accessories and supplies.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:pet_type", label: "Pet Type" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "baby-kids",
    name: "Baby & Kids",
    group: "Retail",
    description: "Baby products, kidswear and nursery retailers.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "custom:age_range", label: "Age Range" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "convenience-forecourt",
    name: "Convenience / Forecourt",
    group: "Retail",
    description: "Convenience stores, garage shops and kiosks.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "books-stationery-office",
    name: "Books, Stationery & Office",
    group: "Retail",
    description: "Bookstores, stationers and office supply retailers.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "general-merchandise",
    name: "General Merchandise",
    group: "Retail",
    description:
      "Department stores and mixed-category retailers spanning multiple sectors (electronics, groceries, appliances, toys, outdoor, etc.) — the fallback when a catalogue doesn't fit one narrow vertical.",
    levels: [
      { attribute_key: "department", label: "Department" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "brand", label: "Brand" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "wholesale-cash-carry",
    name: "Wholesale / Cash & Carry",
    group: "Wholesale",
    description: "Bulk wholesalers and cash-and-carry retailers (e.g. Makro-style trade stores).",
    levels: [
      { attribute_key: "department", label: "Department" },
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "custom:pack_size", label: "Pack Size" },
      { attribute_key: "custom:unit_of_measure", label: "Unit of Measure" },
      { attribute_key: "product", label: "Product" },
    ],
  },
  {
    id: "wholesale-foodservice",
    name: "Wholesale Foodservice",
    group: "Wholesale",
    description: "Catering and foodservice wholesalers/distributors.",
    levels: [
      { attribute_key: "category", label: "Category" },
      { attribute_key: "subcategory", label: "Sub-category" },
      { attribute_key: "supplier", label: "Supplier" },
      { attribute_key: "custom:pack_size", label: "Pack Size" },
      { attribute_key: "product", label: "Product" },
    ],
  },
];
