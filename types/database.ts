export type PaymentType = "cash" | "mtn_momo" | "airtel_money" | "fuel_card" | "credit" | "lpo" | "bank_pos";
export type ProductType = "fuel" | "lubricant" | "lpg" | "adblue" | "car_wash" | "shop_item";
export type ProductUnit = "litres" | "pieces" | "kg" | "service";
export type OwnershipModel = "COCO" | "CODO" | "DODO" | "DOCO";
export type ShiftType = "morning" | "afternoon" | "night";
export type ShiftStatus = "open" | "closed" | "reconciled";
export type DipReadingType = "shift_opening" | "shift_closing" | "pre_delivery" | "post_delivery" | "spot_check";
export type DeliveryStatus = "pending" | "received" | "disputed" | "resolved";
export type ReconciliationStatus = "pending" | "approved" | "queried";
export type ExpenseCategory =
  | "salaries" | "nssf" | "paye" | "withholding_tax" | "income_tax"
  | "rent" | "electricity" | "water" | "internet_airtime" | "security"
  | "generator_fuel" | "maintenance_pumps" | "maintenance_other"
  | "lubricant_purchase" | "shop_stock" | "car_wash_supplies"
  | "uniforms" | "stationery" | "insurance" | "licence_fees"
  | "banking_charges" | "transport" | "cleaning" | "advertising" | "other";
export type CreditEntryType = "charge" | "payment" | "adjustment" | "opening";

export interface Omc {
  id: string; name: string; brand_name: string | null;
  contact_person: string | null; contact_phone: string | null;
  email: string | null; address: string | null;
  notes: string | null; is_active: boolean;
  created_at: string; updated_at: string;
}
export interface Station {
  id: string; name: string; location: string | null;
  region: string | null; district: string | null;
  contact_person: string | null; contact_phone: string | null;
  omc_id: string | null; ownership_model: OwnershipModel | null;
  is_main_branch: boolean; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
  omc?: Omc;
}
export interface Product {
  id: string; name: string; product_code: string | null;
  product_type: ProductType; unit: ProductUnit;
  is_fuel: boolean; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
}
export interface Tank {
  id: string; station_id: string; product_id: string;
  tank_name: string; tank_number: number; capacity_litres: number;
  is_active: boolean; installation_date: string | null;
  last_inspected: string | null; notes: string | null;
  created_at: string; updated_at: string;
  product?: Product; station?: Station;
}
export interface Pump {
  id: string; station_id: string; pump_name: string;
  pump_number: number; pump_model: string | null;
  installation_date: string | null; last_calibrated: string | null;
  calibration_expires: string | null; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
}
export interface Nozzle {
  id: string; pump_id: string; station_id: string;
  product_id: string; tank_id: string; nozzle_label: string;
  nozzle_number: number; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
  pump?: Pump; product?: Product; tank?: Tank;
}
export interface Shift {
  id: string; station_id: string; shift_date: string;
  shift_type: ShiftType; start_time: string | null; end_time: string | null;
  supervisor_name: string | null; cashier_name: string | null;
  status: ShiftStatus; notes: string | null;
  entered_by: string | null; created_at: string; updated_at: string;
  station?: Station;
}
export interface MeterReading {
  id: string; shift_id: string; station_id: string; nozzle_id: string;
  reading_type: "opening" | "closing"; meter_value: number;
  recorded_at: string; notes: string | null; nozzle?: Nozzle;
}
export interface DipReading {
  id: string; station_id: string; tank_id: string;
  shift_id: string | null; reading_type: DipReadingType;
  dip_cm: number; volume_litres: number | null;
  water_dip_cm: number | null; temperature_c: number | null;
  recorded_at: string; notes: string | null; created_at: string;
  tank?: Tank;
}
export interface FuelDelivery {
  id: string; station_id: string; omc_id: string;
  tank_id: string; product_id: string; delivery_date: string;
  delivery_time: string | null; waybill_number: string | null;
  invoice_number: string | null; tanker_plate: string | null;
  tanker_driver_name: string | null; seal_numbers: string | null;
  quantity_on_waybill: number; pre_delivery_dip_id: string | null;
  post_delivery_dip_id: string | null; quantity_received: number | null;
  quantity_variance: number | null; unit_cost_ugx: number;
  total_cost_ugx: number | null; vat_amount_ugx: number | null;
  status: DeliveryStatus; seals_intact: boolean | null;
  short_delivery_claimed: boolean; dispute_notes: string | null;
  entered_by: string | null; notes: string | null;
  created_at: string; updated_at: string;
  omc?: Omc; tank?: Tank; product?: Product; station?: Station;
}
export interface CreditCustomer {
  id: string; name: string; contact_person: string | null;
  phone: string | null; email: string | null; address: string | null;
  tin_number: string | null; credit_limit_ugx: number;
  payment_terms_days: number; stations_allowed: string[] | null;
  is_active: boolean; notes: string | null;
  created_at: string; updated_at: string;
}
export interface SalesTransaction {
  id: string; station_id: string; shift_id: string | null;
  product_id: string; nozzle_id: string | null;
  transaction_date: string; transaction_time: string | null;
  quantity: number; unit_price_ugx: number;
  total_amount_ugx: number | null; discount_ugx: number;
  net_amount_ugx: number | null; payment_type: PaymentType;
  momo_reference: string | null; fuel_card_number: string | null;
  lpo_number: string | null; bank_pos_reference: string | null;
  credit_customer_id: string | null; vehicle_reg: string | null;
  driver_name: string | null; efd_receipt_number: string | null;
  entered_by: string | null; notes: string | null; created_at: string;
  product?: Product; station?: Station; credit_customer?: CreditCustomer;
}
export interface CreditAccountTransaction {
  id: string; credit_customer_id: string; station_id: string;
  transaction_date: string; entry_type: CreditEntryType;
  amount_ugx: number; sales_tx_id: string | null;
  payment_method: string | null; payment_reference: string | null;
  balance_after_ugx: number | null; entered_by: string | null;
  notes: string | null; created_at: string;
}
export interface Expense {
  id: string; station_id: string; expense_date: string;
  category: ExpenseCategory; sub_description: string | null;
  amount_ugx: number; payment_method: string | null;
  payee: string | null; receipt_reference: string | null;
  shift_id: string | null; entered_by: string | null;
  approved_by: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface VwOwnerDashboard {
  transaction_date: string; stations_active: number;
  total_revenue_all_stations: number; total_litres_all_stations: number;
  total_cash: number; total_momo: number;
  total_credit_sales: number; total_lpo_sales: number;
}
export interface VwDailyStationSummary {
  station_id: string; station_name: string; transaction_date: string;
  total_revenue_ugx: number; total_litres_sold: number;
  cash_revenue: number; momo_revenue: number; airtel_revenue: number;
  credit_revenue: number; lpo_revenue: number; fuel_card_revenue: number;
}
export interface VwCreditBalance {
  credit_customer_id: string; customer_name: string;
  credit_limit_ugx: number; payment_terms_days: number;
  outstanding_balance_ugx: number; available_credit_ugx: number;
}
export interface VwOmcAccountBalance {
  omc_id: string; station_id: string; omc_name: string;
  station_name: string; opening_balance_ugx: number;
  total_deliveries: number; total_payments: number;
  current_balance_ugx: number;
}