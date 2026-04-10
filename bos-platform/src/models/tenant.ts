/**
 * @fileoverview Tenant Model - MongoDB Schema
 * @description Defines the structure of tenant data in MongoDB
 */

import mongoose from 'mongoose';
import { ITenant } from '../interfaces/ITenant';

const TenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tenantId: { type: Number, required: true, unique: true },
    apiKey: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true, required: true },
    config: { type: Object, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for faster lookups
TenantSchema.index({ tenantId: 1 });
TenantSchema.index({ apiKey: 1 });

export default mongoose.model<ITenant & mongoose.Document>('Tenant', TenantSchema);
