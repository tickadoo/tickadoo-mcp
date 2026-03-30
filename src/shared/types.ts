export interface City {
  id: string;
  name: string;
  slug: string | null;
  location: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface Product {
  id: string;
  cityId: string;
  slug: string;
  title: string;
  description: string | null;
  desktopFeatureImageUrl: string | null;
  verticalImageUrl: string | null;
  provider: string;
  providerId: string;
  averageRating: number | null;
  currency: string;
  address: string | null;
  minPrice: number | null;
  featured?: boolean;
  mcpProduct?: McpProduct;
}

export interface McpProductVariant {
  niceId: number;
  name: string;
  duration: string | null;
  ageMinimum: number | null;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  cancellationPolicy: "Unknown" | "Never" | "BeforeTimeslot" | "BeforeDate";
  cancellationPeriod: string | null;
}

export interface McpProduct {
  niceId: number;
  name: string;
  url: string;
  minPrice: number;
  reviewRating: number | null;
  reviewCount: number | null;
  indoorOutdoor: "Indoor" | "Outdoor" | "Mixed" | null;
  physicalLevel: "Easy" | "Moderate" | "Demanding" | null;
  audience: string[];
  tags: string[];
  wheelchairAccessible: boolean | null;
  strollerFriendly: boolean | null;
  languageOptions: string[];
  variants: McpProductVariant[];
}

export interface StructuredDataDatePrice {
  date: string;
  endDate: string;
  minPrice: number;
  variantName: string;
  time?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  ticketsRemaining?: number | null;
  tickets_remaining?: number | null;
  inventoryLevel?: number | null;
  inventory_level?: number | null;
  availabilityStatus?: string | null;
  availability_status?: string | null;
}

export interface StructuredDataResponse {
  desktopFeatureImageUrl: string;
  mobileFeatureImageUrl: string;
  currencyCode: string;
  address: string | null;
  locationWithAddress: {
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  };
  dates: StructuredDataDatePrice[];
  mcpProduct?: McpProduct;
}

export interface SearchPage {
  path: string;
  title: string;
}

export interface ResolvedProduct {
  bookingPath: string;
  product: Product;
}
