// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface OtpSendResponse {
  success: boolean;
  sessionId: string;
  channel: 'whatsapp' | 'sms';
  resendAfterSeconds?: number;
  error?: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  /** Session bearer token. Absent when the caller was already signed in
   * (the OTP then only proved ownership of a number). */
  token?: string;
  isNewUser?: boolean;
  hasName?: boolean;
  error?: string;
}

export interface MobileSignInResponse {
  success: boolean;
  token: string;
  hasName: boolean;
  error?: string;
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface Profile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: 'customer' | 'delivery_partner';
}

export interface ProfileResponse {
  success: boolean;
  profile: Profile | null;
}

// ─── Addresses ────────────────────────────────────────────────────────────────
export interface DeliveryAddress {
  id: string;
  label: string | null;
  full_address: string;
  area: string;
  city: string;
  state: string;
  pincode: string | null;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AddressesResponse {
  success: boolean;
  data: DeliveryAddress[];
}

export interface AddressResponse {
  success: boolean;
  data: DeliveryAddress;
}

export interface AddressPayload {
  label?: string | null;
  full_address: string;
  area: string;
  city?: string;
  state?: string;
  pincode?: string | null;
  landmark?: string | null;
  is_default?: boolean;
}

// ─── Passes ───────────────────────────────────────────────────────────────────
export interface PassPlan {
  id: string;
  name: string;
  category: string;
  passes_count: number;
  price_paise: number;
}

export interface PassPurchase {
  id: string;
  user_id: string;
  status: string;
  paid_at: string | null;
  passes_purchased: number;
  price_paise: number;
  order_id: string | null;
  pass_plans: PassPlan | null;
}

export interface PassesResponse {
  success: boolean;
  data: PassPurchase[];
  meta: {
    count: number;
    balance: { total_purchased: number; total_used: number; remaining: number };
  };
}

// ─── Delivery Schedules ───────────────────────────────────────────────────────
export interface DeliverySchedule {
  id: string;
  user_id: string;
  delivery_address_id: string | null;
  label: string;
  preferred_days: string[];
  delivery_slot: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Delivery Logs ────────────────────────────────────────────────────────────
export type DeliveryStatus =
  | 'scheduled'
  | 'out_for_delivery'
  | 'delivered'
  | 'missed'
  | 'skipped';

export interface DeliveryLog {
  id: string;
  user_id: string | null;
  delivery_date: string;
  delivery_slot: string;
  status: DeliveryStatus;
  delivered_at: string | null;
  quantity: number;
  created_at: string;
  delivery_schedule_id?: string | null;
}

export interface DeliveryLogsResponse {
  success: boolean;
  data: DeliveryLog[];
  meta: { count: number };
}

export interface PreferredDaysResponse {
  success: boolean;
  preferred_days: string[];
  logs_regenerated: number;
  error?: string;
}

// ─── Plans ────────────────────────────────────────────────────────────────────
export interface Plan {
  id: string;
  slug?: string;
  name: string;
  category: 'salad' | 'fruit' | 'combo';
  duration: string;
  total_meals: number;
  price_paise: number;
  price_per_meal_paise?: number;
  description?: string | null;
  features: string[];
  is_popular?: boolean;
}

export interface PlansResponse {
  success: boolean;
  data: Plan[];
  meta: { count: number };
}

// ─── Slots ────────────────────────────────────────────────────────────────────
export interface TimeSlot {
  id: string;
  label: string;
  time_range: string;
  icon: string | null;
}

export interface SlotsResponse {
  success: boolean;
  data: TimeSlot[];
}

// ─── Dietary options ──────────────────────────────────────────────────────────
export interface DietaryOption {
  key: string;
  label: string;
}

export interface DietaryOptionsResponse {
  success: boolean;
  data: DietaryOption[];
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export interface CreateOrderPayload {
  planId: string;
  timeSlotId: string;
  name: string;
  mobile: string;
  area: string;
  address: string;
  preferredDays: string[];
  extraMeals?: number;
  specialInstructions?: string;
  dietaryPreferences?: string[];
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  error?: string;
}

// ─── Payments ─────────────────────────────────────────────────────────────────
export interface CreateRazorpayOrderResponse {
  success: boolean;
  data: {
    razorpayOrderId: string;
    finalAmountPaise: number;
    discountPaise: number;
    appliedCouponCode: string | null;
  };
  error?: string;
}

export interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  orderId: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  error?: string;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
export interface Invoice {
  id: string;
  invoice_number: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  total_paise: number;
  subtotal_paise: number;
  discount_paise: number;
  tax_paise: number;
  cgst_paise?: number;
  sgst_paise?: number;
  igst_paise?: number;
  status: string;
  issued_at: string;
  order_id: string | null;
  version?: number;
  revision_of?: string | null;
  superseded_at?: string | null;
  has_pdf?: boolean;
  email_sent_at?: string | null;
  /** Null when the invoice has no plan snapshot. */
  plan_label?: string | null;
}

export interface InvoicesResponse {
  success: boolean;
  data: Invoice[];
}

// Detail view — includes snapshot, line items, related profile, revision linkage
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price_paise: number;
  amount_paise: number;
  item_type: string;
}

export interface InvoiceBillingSnapshot {
  seller?: {
    legalName?: string;
    addressLines?: string[];
    city?: string;
    state?: string;
    stateCode?: string;
    pincode?: string;
    gstin?: string;
    fssai?: string;
    email?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
  };
  buyer?: {
    name?: string;
    legalName?: string;
    email?: string;
    phone?: string;
    gstin?: string;
    addressLines?: string[];
    city?: string;
    state?: string;
    pincode?: string;
  };
  plan?: { name?: string; passesCount?: number; hsnSac?: string };
}

export interface InvoiceDetail extends Invoice {
  taxable_value_paise: number;
  gst_rate_bps: number;
  place_of_supply: string | null;
  supersede_reason: string | null;
  billing_snapshot: InvoiceBillingSnapshot | null;
  due_date: string | null;
  notes: string | null;
  has_pdf: boolean;
}

export interface InvoiceDetailResponse {
  success: boolean;
  data: {
    invoice: InvoiceDetail;
    lineItems: InvoiceLineItem[];
    profile: { full_name: string | null; phone: string | null; email: string | null } | null;
    orderRef: string | null;
    revisionOf: { id: string; invoice_number: string; issued_at: string } | null;
    supersededBy: { id: string; invoice_number: string; issued_at: string } | null;
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: AppNotification[];
  unread_count: number;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────
export interface MenuMeal {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  calories: number | null;
  protein_g: number | null;
  fiber_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  ingredients: string[] | null;
  category: string;
}

export interface NutritionFlags {
  calories: boolean;
  protein: boolean;
  fiber: boolean;
  carbs: boolean;
  fat: boolean;
}

export interface MenuResponse {
  success: boolean;
  data: {
    meals: MenuMeal[];
    showFruits: boolean;
    nutritionFlags: NutritionFlags;
  };
}

// ─── Videos ───────────────────────────────────────────────────────────────────
export type VideoCategoryId = 'yoga' | 'fitness' | 'nutrition' | 'wellness';

export interface VideoCategory {
  id: VideoCategoryId;
  label: string;
}

export interface Video {
  id: string;
  title: string;
  description: string | null;
  category: VideoCategoryId;
  source: 'youtube' | 'upload' | 'instagram';
  youtubeId: string | null;
  /** Permalink of an Instagram reel. */
  instagramUrl?: string | null;
  /** Embeddable page for YouTube and Instagram; null for uploads. */
  embedUrl?: string | null;
  /** Root-relative /media path for uploads; null otherwise. */
  videoUrl: string | null;
  orientation?: 'landscape' | 'portrait';
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  isFeatured: boolean;
  publishedAt: string;
}

export interface VideosResponse {
  success: boolean;
  data: {
    categories: VideoCategory[];
    videos: Video[];
  };
}

// ─── Delivery History ─────────────────────────────────────────────────────────
export interface DeliveryHistoryLog {
  id: string;
  delivery_date: string;
  delivery_slot: string;
  status: string;
  delivered_at: string | null;
  quantity: number;
}

export interface DeliveryHistoryResponse {
  success: boolean;
  data: {
    logs: DeliveryHistoryLog[];
  };
}

// ─── Init (combined screen data) ──────────────────────────────────────────────
export interface InitMeal {
  name: string;
  image_url: string | null;
}

export interface DeliveriesInitResponse {
  success: boolean;
  data: {
    purchase: PassPurchase | null;
    balance: { total_purchased: number; total_used: number } | null;
    addresses: DeliveryAddress[];
    meals: InitMeal[];
    schedules: DeliverySchedule[];
    slots: TimeSlot[];
    logs: DeliveryLog[];
    /** Their deliveries are on hold; nothing is booked until we resume them. */
    deliveriesPaused?: boolean;
  };
}

export interface DeliveriesActionResponse extends DeliveriesInitResponse {
  homeData: {
    purchase: { id: string; plan_name: string | null } | null;
    balance: { total_purchased: number; total_used: number } | null;
    schedule: { preferred_days: string[]; delivery_slot: string } | null;
    logs: HomeCriticalLog[];
  };
}

export interface HomeCriticalLog {
  id: string;
  delivery_date: string;
  delivery_slot: string;
  status: DeliveryStatus;
  quantity: number;
  delivered_at: string | null;
  meal_id: string | null;
}

export interface HomeCriticalResponse {
  success: boolean;
  data: {
    purchase: { id: string; plan_name: string | null } | null;
    balance: { total_purchased: number; total_used: number } | null;
    schedule: { preferred_days: string[]; delivery_slot: string } | null;
    logs: HomeCriticalLog[];
  };
}

export interface HomeStaticResponse {
  success: boolean;
  data: {
    meals: InitMeal[];
    slots: TimeSlot[];
  };
}

export interface AppSettings {
  privacyPolicyUrl:   string | null;
  termsUrl:           string | null;
  refundPolicyUrl:    string | null;
  deliveryPolicyUrl:  string | null;
  appStoreUrl:        string | null;
  playStoreUrl:       string | null;
  supportPhone:       string | null;
  supportWhatsappUrl: string | null;
  supportEmail:       string | null;
  instagramUrl?:      string | null;
  facebookUrl?:       string | null;
  youtubeUrl?:        string | null;
  linkedinUrl?:       string | null;
  showBuiltByCard:    boolean;
}

export interface AppSettingsResponse {
  success: boolean;
  data: AppSettings;
}

