import type { ProductEntity } from '../entities/product.entity';

export interface IProductRepository {
  listActive(): Promise<ProductEntity[]>;
  findById(id: string): Promise<ProductEntity | null>;
  findByCode(productCode: string): Promise<ProductEntity | null>;
}
