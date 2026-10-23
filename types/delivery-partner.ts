export interface PartnerDeliveryItem {
  id: string;
  delivery_date: string;
  delivery_slot: string;
  status: string;
  delivered_at: string | null;
  /** Your own remark from the road ("customer not home"), not the kitchen's. */
  delivery_notes: string | null;
  /**
   * An admin's note for this one delivery. Despite the name it often holds
   * rider instructions too ("leave at reception", "gate code 4471").
   */
  kitchen_note: string | null;
  quantity: number;
  user_id: string | null;
  assigned_partner_id: string | null;
  priority: number | null;
  area: string | null;
  special_instructions: string | null;
  dietary_preferences: string[];
  /** False when this item is only included because "All Deliveries" scope
   * was requested — it's assigned to a different partner or outside this
   * partner's zone, so status-update actions on it are rejected server-side. */
  visible_to_partner: boolean;
  profiles: {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    delivery_address_id: string | null;
    delivery_addresses: {
      full_address: string;
      area: string;
      landmark: string | null;
      pincode: string | null;
      lat: number | null;
      lng: number | null;
      gmap_url: string | null;
    } | null;
  } | null;
}

export interface PartnerDeliveriesResponse {
  success: boolean;
  data: PartnerDeliveryItem[];
}
