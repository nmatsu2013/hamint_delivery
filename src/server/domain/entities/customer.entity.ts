export interface CustomerEntity {
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

export interface CustomerAddressEntity {
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
