import { Service, Inject, Container } from 'typedi';
import mongoose from 'mongoose';
import logger from '../../utils/logger';
import { TransactionManager } from '../../transactions/TransactionManager';
import { PluginCollaborator } from '../PluginCollaborator';

export type Logger = typeof logger;

/**
 * E-commerce Product Schema
 */
const ProductSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    inventory: { type: Number, default: 0 },
    sku: { type: String, required: true },
    categories: [{ type: String }],
    images: [{ type: String }],
    status: { 
      type: String, 
      enum: ['draft', 'active', 'archived'], 
      default: 'draft' 
    },
    metadata: { type: Map, of: String }
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, status: 1 });

export interface IProduct extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  inventory: number;
  sku: string;
  categories: string[];
  images: string[];
  status: 'draft' | 'active' | 'archived';
  metadata?: Map<string, string>;
}

export const ProductModel = mongoose.model<IProduct>('EcommerceProduct', ProductSchema);

/**
 * E-commerce Cart Schema
 */
const CartSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    items: [{
      productId: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true },
      metadata: { type: Map, of: String }
    }],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'abandoned', 'converted'],
      default: 'active'
    }
  },
  { timestamps: true }
);

CartSchema.index({ tenantId: 1, userId: 1, status: 1 });

export interface ICartItem {
  productId: string;
  quantity: number;
  price: number;
  metadata?: Map<string, string>;
}

export interface ICart extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  userId: string;
  items: ICartItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'active' | 'abandoned' | 'converted';
}

export const CartModel = mongoose.model<ICart>('EcommerceCart', CartSchema);

/**
 * E-commerce Order Schema
 */
const OrderSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, unique: true },
    items: [{
      productId: { type: String, required: true },
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true }
    }],
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, required: true }
    },
    shippingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String
    },
    billingAddress: {
      name: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },
    payment: {
      method: { type: String, enum: ['card', 'paypal', 'bank_transfer', 'cod'] },
      status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'] },
      transactionId: String,
      paidAt: Date
    },
    fulfillment: {
      status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] },
      trackingNumber: String,
      carrier: String,
      shippedAt: Date,
      deliveredAt: Date
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

OrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, userId: 1, status: 1 });
OrderSchema.index({ 'payment.status': 1 });
OrderSchema.index({ 'fulfillment.status': 1 });

export interface IOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface IOrder extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  userId: string;
  orderNumber: string;
  items: IOrderItem[];
  pricing: {
    subtotal: number;
    discount: number;
    tax: number;
    shipping: number;
    total: number;
  };
  shippingAddress?: any;
  billingAddress?: any;
  payment: {
    method: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    transactionId?: string;
    paidAt?: Date;
  };
  fulfillment: {
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    trackingNumber?: string;
    carrier?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
}

export const OrderModel = mongoose.model<IOrder>('EcommerceOrder', OrderSchema);

@Service()
export class EcommerceService {
  private readonly logger: Logger;
  private transactionManager: TransactionManager;
  private pluginCollaborator: PluginCollaborator;

  constructor(
    @Inject('logger') logger: Logger,
    @Inject('transactionManager') transactionManager: TransactionManager,
    @Inject('pluginCollaborator') pluginCollaborator: PluginCollaborator
  ) {
    this.logger = logger;
    this.transactionManager = transactionManager;
    this.pluginCollaborator = pluginCollaborator;
  }

  /**
   * Create Product with inventory check
   */
  async createProduct(data: Partial<IProduct>, tenantId: string): Promise<IProduct> {
    this.logger.info(`🛍️ Creating product: ${data.name}`);
    
    const product = await ProductModel.create({
      ...data,
      tenantId,
      status: data.status || 'draft'
    });

    // Emit event for other plugins (e.g., Search, Analytics)
    await this.pluginCollaborator.emitEvent({
      sourcePlugin: 'ecommerce',
      eventType: 'product.created',
      payload: { productId: product._id, sku: product.sku },
      tenantId
    });

    return product;
  }

  /**
   * Add to Cart with inventory validation
   */
  async addToCart(userId: string, productId: string, quantity: number, tenantId: string): Promise<ICart> {
    this.logger.info(`🛒 Adding to cart: User ${userId}, Product ${productId}, Qty ${quantity}`);

    return await this.transactionManager.executeInTransaction(async (session: mongoose.ClientSession) => {
      // Get product
      const product = await ProductModel.findOne({ _id: productId, tenantId }).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      if (product.status !== 'active') {
        throw new Error('Product is not active');
      }

      if (product.inventory < quantity) {
        throw new Error(`Insufficient inventory. Available: ${product.inventory}`);
      }

      // Get or create cart
      let cart = await CartModel.findOne({ userId, tenantId, status: 'active' }).session(session);
      
      if (!cart) {
        const carts = await CartModel.create([{
          userId,
          tenantId,
          status: 'active',
          items: []
        }], { session });
        cart = carts[0];
      }

      // Add or update item
      const existingItemIndex = cart.items.findIndex(item => item.productId === productId);
      
      if (existingItemIndex > -1) {
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        cart.items.push({
          productId,
          quantity,
          price: product.price,
          metadata: new Map()
        });
      }

      // Recalculate totals
      cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      cart.total = cart.subtotal - cart.discount;

      await cart.save({ session });

      return cart;
    });
  }

  /**
   * Checkout - Create Order with full transaction
   */
  async checkout(userId: string, cartId: string, checkoutData: any, tenantId: string): Promise<IOrder> {
    this.logger.info(`💳 Checkout initiated: User ${userId}, Cart ${cartId}`);

    return await this.transactionManager.executeInTransaction(async (session: mongoose.ClientSession) => {
      // Get cart
      const cart = await CartModel.findOne({ _id: cartId, userId, tenantId, status: 'active' }).session(session);
      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty or not found');
      }

      // Generate order number
      const orderNumber = `ORD-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Build order items
      const orderItems: IOrderItem[] = [];
      for (const item of cart.items) {
        const product = await ProductModel.findOne({ _id: item.productId, tenantId }).session(session);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        
        if (product.inventory < item.quantity) {
          throw new Error(`Insufficient inventory for ${product.name}`);
        }

        // Deduct inventory
        product.inventory -= item.quantity;
        await product.save({ session });

        orderItems.push({
          productId: product._id.toString(),
          productName: product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity
        });
      }

      // Calculate pricing
      const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.1; // 10% tax (configurable)
      const shipping = checkoutData.shippingMethod === 'express' ? 15 : 5;
      const total = subtotal + tax + shipping - cart.discount;

      // Create order
      const orders = await OrderModel.create([{
        tenantId,
        userId,
        orderNumber,
        items: orderItems,
        pricing: {
          subtotal,
          discount: cart.discount,
          tax,
          shipping,
          total
        },
        shippingAddress: checkoutData.shippingAddress,
        billingAddress: checkoutData.billingAddress,
        payment: {
          method: checkoutData.paymentMethod,
          status: 'pending'
        },
        fulfillment: {
          status: 'pending'
        },
        status: 'pending'
      }], { session });

      // Mark cart as converted
      cart.status = 'converted';
      await cart.save({ session });

      const createdOrder = orders[0];

      // Emit events for other plugins
      await this.pluginCollaborator.emitEvent({
        sourcePlugin: 'ecommerce',
        eventType: 'order.created',
        payload: { 
          orderId: createdOrder._id, 
          orderNumber: createdOrder.orderNumber,
          total: createdOrder.pricing.total,
          userId 
        },
        tenantId
      });

      this.logger.info(`✅ Order created: ${orderNumber}`);
      return createdOrder;
    });
  }

  /**
   * Process Payment (integrates with Payment plugin)
   */
  async processPayment(orderId: string, paymentDetails: any, tenantId: string): Promise<IOrder> {
    this.logger.info(`💰 Processing payment for order: ${orderId}`);

    return await this.transactionManager.executeInTransaction(async (session: mongoose.ClientSession) => {
      const order = await OrderModel.findOne({ _id: orderId, tenantId }).session(session);
      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'pending') {
        throw new Error('Order is not in pending status');
      }

      // Request payment processing from Payment plugin
      try {
        const paymentResult = await this.pluginCollaborator.requestResponse(
          'ecommerce',
          'payments',
          'process',
          {
            orderId: order._id,
            amount: order.pricing.total,
            currency: 'USD',
            ...paymentDetails
          },
          tenantId,
          10000
        );

        // Update order with payment success
        order.payment.status = 'paid';
        order.payment.transactionId = paymentResult.transactionId;
        order.payment.paidAt = new Date();
        order.status = 'confirmed';
        
        await order.save({ session });

        // Emit payment success event
        await this.pluginCollaborator.emitEvent({
          sourcePlugin: 'ecommerce',
          eventType: 'payment.completed',
          payload: { 
            orderId: order._id, 
            transactionId: paymentResult.transactionId 
          },
          tenantId
        });

        this.logger.info(`✅ Payment successful: ${paymentResult.transactionId}`);
        return order;

      } catch (error: any) {
        this.logger.error(`❌ Payment failed: ${error.message}`);
        
        order.payment.status = 'failed';
        order.status = 'cancelled';
        await order.save({ session });

        // Restore inventory
        for (const item of order.items) {
          await ProductModel.updateOne(
            { _id: item.productId, tenantId },
            { $inc: { inventory: item.quantity } }
          ).session(session);
        }

        throw new Error(`Payment processing failed: ${error.message}`);
      }
    });
  }

  /**
   * Get Orders with filtering
   */
  async getOrders(filters: any, tenantId: string): Promise<IOrder[]> {
    const query: any = { tenantId };
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.paymentStatus) query['payment.status'] = filters.paymentStatus;
    if (filters.fulfillmentStatus) query['fulfillment.status'] = filters.fulfillmentStatus;

    return await OrderModel.find(query).sort({ createdAt: -1 });
  }

  /**
   * Update Order Fulfillment
   */
  async updateFulfillment(
    orderId: string, 
    fulfillmentData: { status: string, trackingNumber?: string, carrier?: string }, 
    tenantId: string
  ): Promise<IOrder> {
    this.logger.info(`📦 Updating fulfillment for order: ${orderId}`);

    const order = await OrderModel.findOne({ _id: orderId, tenantId });
    if (!order) {
      throw new Error('Order not found');
    }

    order.fulfillment.status = fulfillmentData.status as any;
    
    if (fulfillmentData.trackingNumber) {
      order.fulfillment.trackingNumber = fulfillmentData.trackingNumber;
    }
    
    if (fulfillmentData.carrier) {
      order.fulfillment.carrier = fulfillmentData.carrier;
    }

    if (fulfillmentData.status === 'shipped') {
      order.fulfillment.shippedAt = new Date();
      order.status = 'shipped';
      
      // Emit shipping event
      await this.pluginCollaborator.emitEvent({
        sourcePlugin: 'ecommerce',
        eventType: 'order.shipped',
        payload: { 
          orderId: order._id, 
          trackingNumber: fulfillmentData.trackingNumber 
        },
        tenantId: order.tenantId
      });
    }

    if (fulfillmentData.status === 'delivered') {
      order.fulfillment.deliveredAt = new Date();
      order.status = 'delivered';
      
      // Emit delivery event
      await this.pluginCollaborator.emitEvent({
        sourcePlugin: 'ecommerce',
        eventType: 'order.delivered',
        payload: { orderId: order._id },
        tenantId: order.tenantId
      });
    }

    await order.save();
    return order;
  }
}
