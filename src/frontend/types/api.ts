export interface Actor {
  id?: string;
  userId: string;
  name?: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface DashboardKpis {
  todayOrdersCount: number;
  pendingOrdersCount: number;
  inTransitOrdersCount: number;
  unpaidInvoicesCount: number;
  currentMonthOrdersCount: number;
  totalOrdersCount: number;
  statusCounts: Record<string, number>;
  businessDate: string;
}

export interface SalesOrderLine {
  id: string;
  salesOrderId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  modelNo?: string;
  specNote?: string | null;
  supplierId?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineStatus: string;
  shippedQuantity: number;
  isActive: boolean;
}

export interface SalesOrderSummary {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName: string;
  shipToId: string;
  shipToName: string;
  requestedDate: string | null;
  status: string;
  totalAmount: number;
  currency: string;
  quantity: number;
  mainProductName: string;
  lineCount: number;
  paymentStatus: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName?: string;
  shipToId: string;
  shipToName?: string;
  requestedDate: string | null;
  status: string;
  totalAmount: number;
  currency: string;
  note: string | null;
  isActive: boolean;
  lines: SalesOrderLine[];
  paymentStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productCode?: string;
  productName?: string;
  modelNo?: string;
  quantity: number;
  unitCost?: number;
  currency: string;
  salesOrderLineId: string | null;
  appliedHsCode: string | null;
  dutyRate?: number | null;
  dutyAmount?: number | null;
  dutyCurrency: string;
  receivedDate: string | null;
  inspectorId: string | null;
  goodQty: number | null;
  defectQty: number | null;
  damagedQty: number | null;
  claimStatus: string | null;
  claimNote: string | null;
  isActive: boolean;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierId: string;
  supplierName?: string;
  orderedDate: string;
  promisedDate: string | null;
  currency: string;
  totalAmount: number;
  status: string;
  note: string | null;
  isActive: boolean;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderSummary {
  id: string;
  poNo: string;
  supplierName: string;
  orderedDate: string;
  promisedDate: string | null;
  currency: string;
  totalAmount: number;
  status: string;
  lineCount: number;
  totalQuantity: number;
}

export interface ImportDocument {
  id: string;
  applicationId: string;
  documentName: string;
  filePath: string | null;
  submittedDate: string | null;
  isActive: boolean;
}

export interface ImportApplication {
  id: string;
  applicationNo: string;
  purchaseOrderId: string;
  purchaseOrderNo?: string;
  applicationType: string;
  appliedDate: string | null;
  status: string;
  confirmedDate: string | null;
  assigneeId: string | null;
  note: string | null;
  customsBroker: string | null;
  importPermitDate: string | null;
  declarationNo: string | null;
  taxableValue?: number | null;
  dutyTotal?: number | null;
  importConsumptionTax?: number | null;
  customsFee?: number | null;
  otherCosts?: number | null;
  currency: string;
  isActive: boolean;
  documents: ImportDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentLine {
  id: string;
  shipmentId: string;
  salesOrderLineId: string | null;
  purchaseOrderLineId: string | null;
  lotId: string | null;
  quantity: number;
  lotNo?: string;
  productName?: string;
  isActive: boolean;
}

export interface Shipment {
  id: string;
  shipmentNo: string;
  direction: 'domestic' | 'international';
  salesOrderId: string | null;
  shipToId: string | null;
  purchaseOrderId: string | null;
  shippedDate: string | null;
  carrier: string | null;
  trackingNo: string | null;
  deliveredDate: string | null;
  status: string;
  transportMode: string | null;
  blAwbNo: string | null;
  etd: string | null;
  eta: string | null;
  isActive: boolean;
  lines: ShipmentLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentSummary {
  id: string;
  shipmentNo: string;
  direction: 'domestic' | 'international';
  directionLabel: string;
  status: string;
  shippedDate: string | null;
  deliveredDate: string | null;
  carrier: string | null;
  trackingNo: string | null;
  orderNo?: string;
  poNo?: string;
  totalQuantity: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  paidDate: string;
  paidAmount: number;
  currency: string;
  method: string | null;
  fee: number | null;
  isActive: boolean;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  salesOrderLineId: string | null;
  shipmentLineId: string | null;
  amount: number;
  currency: string;
  productName?: string;
  quantity?: number;
  isActive: boolean;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: string;
  isActive: boolean;
  lines: InvoiceLine[];
  payments: Payment[];
  paidAmount: number;
  unpaidAmount: number;
  salesOrderIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNo: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: string;
  paidAmount: number;
  unpaidAmount: number;
  orderNos: string[];
}

export interface ProgressStep {
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
}

export interface SalesOrderDetail {
  order: SalesOrder;
  purchaseOrders: PurchaseOrder[];
  importApplications: ImportApplication[];
  shipments: Shipment[];
  invoices: Invoice[];
  progress: ProgressStep[];
}

export interface Customer {
  id: string;
  customerCode: string;
  clinicName: string;
  clinicNameKana: string | null;
  postalCode: string;
  address: string;
  tel: string | null;
  fax: string | null;
  email: string | null;
  closingDay: number | null;
  paymentTerms: string | null;
  licenseInfo: string | null;
  note: string | null;
  isActive: boolean;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  shipToName: string;
  postalCode: string;
  address: string;
  recipient: string | null;
  tel: string;
  deliveryNote: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface Product {
  id: string;
  productCode: string;
  productName: string;
  productNameKr: string | null;
  productNameEn: string | null;
  modelNo: string;
  supplierId: string;
  supplierName?: string;
  category: string | null;
  material: string | null;
  thickness: string | null;
  lengthMm: number | null;
  specNote: string | null;
  usage: string | null;
  priorityClass: string | null;
  packQty: number;
  unit: string;
  isLotManaged: boolean;
  isExpiryManaged: boolean;
  hsCode: string | null;
  regulatoryInfo: string | null;
  storageCondition: string | null;
  isActive: boolean;
}

export interface Lot {
  id: string;
  productId: string;
  productCode?: string;
  productName?: string;
  lotNo: string;
  expiryDate: string;
  manufacturedDate: string | null;
  purchaseOrderLineId: string | null;
  receivedQty: number;
  onHandQty: number;
  status: string;
  isActive: boolean;
}

export interface TraceabilityDelivery {
  lotNo: string;
  productName: string;
  customerName: string;
  shipToName: string;
  address: string;
  shippedDate: string;
  quantity: number;
  trackingNo: string;
  carrier: string;
}

export interface TraceabilityResponse {
  lotNo: string;
  deliveries: TraceabilityDelivery[];
}

export interface CreateSalesOrderPayload {
  customerId: string;
  shipToId: string;
  requestedDate?: string;
  note?: string;
  lines: Array<{ productId: string; quantity: number }>;
}

export interface CreateDomesticShipmentPayload {
  salesOrderId: string;
  carrier: string;
  trackingNo: string;
  shippedDate: string;
  fifoOverrideReason?: string;
  lines: Array<{ salesOrderLineId: string; lotId: string; quantity: number }>;
}

export interface CreateInternationalShipmentPayload {
  purchaseOrderId: string;
  carrier: string;
  blAwbNo: string;
  shippedDate: string;
  transportMode?: string;
  etd?: string;
  eta?: string;
}

