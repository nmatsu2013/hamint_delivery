export interface IPriceRepository {
  resolveCustomerUnitPrice(
    customerId: string,
    productId: string,
    targetDate: string,
  ): Promise<number | null>;
  resolveStandardUnitPrice(productId: string, targetDate: string): Promise<number | null>;
  resolveSupplierCost(
    productId: string,
    targetDate: string,
  ): Promise<{ cost: number; currency: string } | null>;
}
