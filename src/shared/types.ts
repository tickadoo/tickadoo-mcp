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
}

export interface StructuredDataDatePrice {
  date: string;
  endDate: string;
  minPrice: number;
  variantName: string;
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
}

export interface SearchPage {
  path: string;
  title: string;
}

export interface ResolvedProduct {
  bookingPath: string;
  product: Product;
}
