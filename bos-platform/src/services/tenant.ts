/**
 * @fileoverview Tenant Service - Business Logic Layer
 * @description Handles all tenant-related operations with dependency injection
 */

import { Service, Inject } from 'typedi';
import { Container } from 'typedi';
import { ITenant, TenantInputDto, CreateTenantDto, UpdateTenantDto } from '../interfaces/ITenant';
import HelperService from '../utils/helpers/HelperService';
import logger from '../utils/logger';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

@Service()
export default class TenantService {
  private helperService: HelperService;

  constructor(@Inject('tenantModel') private readonly tenantModel: any) {
    this.helperService = Container.get(HelperService);
  }

  /**
   * Transforms raw request data into a typed DTO
   */
  public buildTenantDto(req: any): TenantInputDto {
    const dto = new TenantInputDto();
    
    // Extract tenant ID from claims or params
    if (req.claims?.tid) {
      dto.tenantId = this.helperService.decodeHash(req.claims.tid);
    } else if (req.params.id) {
      dto.tenantId = this.helperService.decodeHash(req.params.id);
    } else {
      dto.tenantId = 0; // Will be generated for new tenants
    }
    
    // Extract API key from headers
    dto.apiKey = req.headers['x-api-key'];
    
    // Build payload for create/update operations
    if (req.body) {
      dto.payload = {
        name: req.body.name,
        apiKey: req.body.apiKey,
        config: req.body.config,
        isActive: req.body.isActive,
      } as CreateTenantDto | UpdateTenantDto;
    }
    
    return dto;
  }

  /**
   * Create a new tenant
   */
  public async createTenant(dto: TenantInputDto): Promise<{ data: ITenant }> {
    logger.debug('Creating new tenant');
    
    if (!dto.payload || !(dto.payload as CreateTenantDto).name) {
      throw new ValidationError('Tenant name is required');
    }
    
    const createPayload = dto.payload as CreateTenantDto;
    
    // Generate unique tenant ID
    const lastTenant = await this.tenantModel.findOne().sort({ tenantId: -1 });
    const newTenantId = lastTenant ? lastTenant.tenantId + 1 : 1;
    
    // Check for API key uniqueness
    if (createPayload.apiKey) {
      const existing = await this.tenantModel.findOne({ apiKey: createPayload.apiKey });
      if (existing) {
        throw new ConflictError('API key already exists');
      }
    }
    
    const tenant = await this.tenantModel.create({
      name: createPayload.name,
      tenantId: newTenantId,
      apiKey: createPayload.apiKey || `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config: createPayload.config || {},
      isActive: true,
    });
    
    logger.info(`✌️ Tenant created: ${tenant.name} (ID: ${tenant.tenantId})`);
    
    return { data: tenant.toObject() };
  }

  /**
   * Get tenant by ID
   */
  public async getTenant(tenantId: number): Promise<{ data: ITenant }> {
    logger.debug(`Getting tenant: ${tenantId}`);
    
    const tenant = await this.tenantModel.findOne({ tenantId });
    
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }
    
    return { data: tenant.toObject() };
  }

  /**
   * Get tenant by API key
   */
  public async getTenantByApiKey(apiKey: string): Promise<{ data: ITenant }> {
    logger.debug('Getting tenant by API key');
    
    const tenant = await this.tenantModel.findOne({ apiKey });
    
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }
    
    if (!tenant.isActive) {
      throw new ValidationError('Tenant is not active');
    }
    
    return { data: tenant.toObject() };
  }

  /**
   * Update tenant
   */
  public async updateTenant(dto: TenantInputDto): Promise<{ data: ITenant }> {
    logger.debug(`Updating tenant: ${dto.tenantId}`);
    
    if (!dto.payload) {
      throw new ValidationError('No update payload provided');
    }
    
    const updatePayload = dto.payload as UpdateTenantDto;
    
    const tenant = await this.tenantModel.findOneAndUpdate(
      { tenantId: dto.tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    );
    
    if (!tenant) {
      throw new NotFoundError('Tenant');
    }
    
    logger.info(`✌️ Tenant updated: ${tenant.name}`);
    
    return { data: tenant.toObject() };
  }

  /**
   * Delete tenant
   */
  public async deleteTenant(dto: TenantInputDto): Promise<{ success: boolean }> {
    logger.debug(`Deleting tenant: ${dto.tenantId}`);
    
    const result = await this.tenantModel.deleteOne({ tenantId: dto.tenantId });
    
    if (result.deletedCount === 0) {
      throw new NotFoundError('Tenant');
    }
    
    logger.info(`✌️ Tenant deleted: ${dto.tenantId}`);
    
    return { success: true };
  }

  /**
   * List all tenants
   */
  public async listTenants(): Promise<{ data: ITenant[] }> {
    logger.debug('Listing all tenants');
    
    const tenants = await this.tenantModel.find().select('-apiKey');
    
    return { data: tenants.map((t: any) => t.toObject()) };
  }

  /**
   * Build DTO for deletion (helper method)
   */
  public buildDeleteCacheDto(tenantId: number): TenantInputDto {
    const dto = new TenantInputDto();
    dto.tenantId = tenantId;
    return dto;
  }
}
