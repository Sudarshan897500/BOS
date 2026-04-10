/**
 * @fileoverview Tenant Interfaces and DTOs
 * @description Defines data structures for multi-tenant operations
 */

import { Document } from 'mongoose';

// Database Interface for Tenant
export interface ITenant {
  _id: string;
  name: string;
  tenantId: number;
  apiKey: string;
  isActive: boolean;
  config?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// DTO for creating a tenant
export class CreateTenantDto {
  name!: string;
  apiKey!: string;
  config?: Record<string, any>;
}

// DTO for updating a tenant
export class UpdateTenantDto {
  name?: string;
  isActive?: boolean;
  config?: Record<string, any>;
}

// Input DTO for service operations
export class TenantInputDto {
  tenantId!: number;
  payload?: CreateTenantDto | UpdateTenantDto;
  apiKey?: string;
}

// Output DTO for API responses
export class TenantOutputDto {
  _id!: string;
  name!: string;
  tenantId!: number;
  isActive!: boolean;
  createdAt?: Date;
}
