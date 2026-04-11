/**
 * @fileoverview Tenant API Routes
 * @description HTTP endpoints for tenant management following REST conventions
 */

import { Router, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import TenantService from '../../services/tenant';
import logger from '../../utils/logger';
import { BaseError } from '../../utils/errors';

const route = Router();

export default (app: Router) => {
  app.use('/tenants', route);

  const tenantService = Container.get(TenantService);

  /**
   * POST /tenants
   * Create a new tenant
   */
  route.post('/', async (req: any, res: Response, next: NextFunction) => {
    try {
      const dto = tenantService.buildTenantDto(req);
      const { data } = await tenantService.createTenant(dto);
      logger.info(`✌️ Tenant created successfully`);
      return res.status(201).json(data);
    } catch (e) {
      logger.error('🔥 error creating tenant: %o', e);
      return next(e);
    }
  });

  /**
   * GET /tenants
   * List all tenants
   */
  route.get('/', async (req: any, res: Response, next: NextFunction) => {
    try {
      const { data } = await tenantService.listTenants();
      return res.status(200).json(data);
    } catch (e) {
      logger.error('🔥 error listing tenants: %o', e);
      return next(e);
    }
  });

  /**
   * GET /tenants/:id
   * Get tenant by ID
   */
  route.get('/:id', async (req: any, res: Response, next: NextFunction) => {
    try {
      const dto = tenantService.buildTenantDto(req);
      const { data } = await tenantService.getTenant(dto.tenantId);
      return res.status(200).json(data);
    } catch (e) {
      logger.error('🔥 error getting tenant: %o', e);
      return next(e);
    }
  });

  /**
   * PUT /tenants/:id
   * Update tenant
   */
  route.put('/:id', async (req: any, res: Response, next: NextFunction) => {
    try {
      const dto = tenantService.buildTenantDto(req);
      const { data } = await tenantService.updateTenant(dto);
      logger.info(`✌️ Tenant updated successfully`);
      return res.status(200).json(data);
    } catch (e) {
      logger.error('🔥 error updating tenant: %o', e);
      return next(e);
    }
  });

  /**
   * DELETE /tenants/:id
   * Delete tenant
   */
  route.delete('/:id', async (req: any, res: Response, next: NextFunction) => {
    try {
      const dto = tenantService.buildTenantDto(req);
      await tenantService.deleteTenant(dto);
      logger.info(`✌️ Tenant deleted successfully`);
      return res.status(204).send();
    } catch (e) {
      logger.error('🔥 error deleting tenant: %o', e);
      return next(e);
    }
  });

  /**
   * GET /tenants/verify/api-key
   * Verify tenant by API key
   */
  route.get('/verify/api-key', async (req: any, res: Response, next: NextFunction) => {
    try {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        throw new BaseError('API key is required', 400);
      }
      
      const { data } = await tenantService.getTenantByApiKey(apiKey);
      return res.status(200).json(data);
    } catch (e) {
      logger.error('🔥 error verifying API key: %o', e);
      return next(e);
    }
  });
};
