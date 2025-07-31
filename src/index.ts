#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';

interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

class ShopifyMCPServer {
  private server: Server;
  private shopify: AxiosInstance;
  private config: ShopifyConfig;

  constructor() {
    this.server = new Server(
      {
        name: 'shopify-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || '',
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
    };

    this.shopify = axios.create({
      baseURL: `https://${this.config.shopDomain}/admin/api/${this.config.apiVersion}`,
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Product Management
        {
          name: 'get_products',
          description: 'Retrieve products from Shopify store with filtering options',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of products to retrieve (max 250)' },
              page_info: { type: 'string', description: 'Page info for pagination' },
              status: { type: 'string', enum: ['active', 'archived', 'draft'] },
              vendor: { type: 'string', description: 'Filter by vendor' },
              product_type: { type: 'string', description: 'Filter by product type' },
              collection_id: { type: 'string', description: 'Filter by collection ID' },
            },
          },
        },
        {
          name: 'create_product',
          description: 'Create a new product in Shopify',
          inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string', description: 'Product title' },
              body_html: { type: 'string', description: 'Product description (HTML)' },
              vendor: { type: 'string', description: 'Product vendor' },
              product_type: { type: 'string', description: 'Product type' },
              status: { type: 'string', enum: ['active', 'archived', 'draft'], default: 'draft' },
              tags: { type: 'string', description: 'Comma-separated tags' },
              variants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    price: { type: 'string', description: 'Variant price' },
                    compare_at_price: { type: 'string', description: 'Compare at price' },
                    sku: { type: 'string', description: 'SKU' },
                    inventory_quantity: { type: 'number', description: 'Inventory quantity' },
                    weight: { type: 'number', description: 'Weight in grams' },
                    option1: { type: 'string', description: 'First option value' },
                    option2: { type: 'string', description: 'Second option value' },
                    option3: { type: 'string', description: 'Third option value' },
                  },
                },
              },
              images: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    src: { type: 'string', description: 'Image URL' },
                    alt: { type: 'string', description: 'Alt text' },
                  },
                },
              },
            },
          },
        },
        {
          name: 'update_product',
          description: 'Update an existing product',
          inputSchema: {
            type: 'object',
            required: ['product_id'],
            properties: {
              product_id: { type: 'string', description: 'Product ID to update' },
              title: { type: 'string', description: 'Product title' },
              body_html: { type: 'string', description: 'Product description (HTML)' },
              vendor: { type: 'string', description: 'Product vendor' },
              product_type: { type: 'string', description: 'Product type' },
              status: { type: 'string', enum: ['active', 'archived', 'draft'] },
              tags: { type: 'string', description: 'Comma-separated tags' },
            },
          },
        },
        {
          name: 'delete_product',
          description: 'Delete a product from Shopify',
          inputSchema: {
            type: 'object',
            required: ['product_id'],
            properties: {
              product_id: { type: 'string', description: 'Product ID to delete' },
            },
          },
        },
        
        // Order Management
        {
          name: 'get_orders',
          description: 'Retrieve orders from Shopify store',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of orders to retrieve (max 250)' },
              status: { type: 'string', enum: ['open', 'closed', 'cancelled', 'any'] },
              financial_status: { type: 'string', enum: ['authorized', 'pending', 'paid', 'partially_paid', 'refunded', 'voided', 'partially_refunded', 'any'] },
              fulfillment_status: { type: 'string', enum: ['shipped', 'partial', 'unshipped', 'any'] },
              created_at_min: { type: 'string', description: 'ISO 8601 date' },
              created_at_max: { type: 'string', description: 'ISO 8601 date' },
              updated_at_min: { type: 'string', description: 'ISO 8601 date' },
              updated_at_max: { type: 'string', description: 'ISO 8601 date' },
            },
          },
        },
        {
          name: 'get_order',
          description: 'Get a specific order by ID',
          inputSchema: {
            type: 'object',
            required: ['order_id'],
            properties: {
              order_id: { type: 'string', description: 'Order ID' },
            },
          },
        },
        {
          name: 'update_order',
          description: 'Update order properties',
          inputSchema: {
            type: 'object',
            required: ['order_id'],
            properties: {
              order_id: { type: 'string', description: 'Order ID to update' },
              note: { type: 'string', description: 'Order note' },
              tags: { type: 'string', description: 'Comma-separated tags' },
              email: { type: 'string', description: 'Customer email' },
            },
          },
        },
        {
          name: 'cancel_order',
          description: 'Cancel an order',
          inputSchema: {
            type: 'object',
            required: ['order_id'],
            properties: {
              order_id: { type: 'string', description: 'Order ID to cancel' },
              amount: { type: 'string', description: 'Refund amount' },
              restock: { type: 'boolean', description: 'Whether to restock items' },
              reason: { type: 'string', enum: ['customer', 'inventory', 'fraud', 'declined', 'other'] },
              email: { type: 'boolean', description: 'Whether to send cancellation email' },
            },
          },
        },

        // Customer Management
        {
          name: 'get_customers',
          description: 'Retrieve customers from Shopify store',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of customers to retrieve (max 250)' },
              created_at_min: { type: 'string', description: 'ISO 8601 date' },
              created_at_max: { type: 'string', description: 'ISO 8601 date' },
              updated_at_min: { type: 'string', description: 'ISO 8601 date' },
              updated_at_max: { type: 'string', description: 'ISO 8601 date' },
            },
          },
        },
        {
          name: 'search_customers',
          description: 'Search customers by query',
          inputSchema: {
            type: 'object',
            required: ['query'],
            properties: {
              query: { type: 'string', description: 'Search query (email, name, etc.)' },
              limit: { type: 'number', description: 'Number of results to return' },
            },
          },
        },
        {
          name: 'create_customer',
          description: 'Create a new customer',
          inputSchema: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string', description: 'Customer email' },
              first_name: { type: 'string', description: 'First name' },
              last_name: { type: 'string', description: 'Last name' },
              phone: { type: 'string', description: 'Phone number' },
              tags: { type: 'string', description: 'Comma-separated tags' },
              accepts_marketing: { type: 'boolean', description: 'Accepts marketing emails' },
              password: { type: 'string', description: 'Customer password' },
              password_confirmation: { type: 'string', description: 'Password confirmation' },
              send_email_invite: { type: 'boolean', description: 'Send email invitation' },
            },
          },
        },
        {
          name: 'update_customer',
          description: 'Update customer information',
          inputSchema: {
            type: 'object',
            required: ['customer_id'],
            properties: {
              customer_id: { type: 'string', description: 'Customer ID' },
              email: { type: 'string', description: 'Customer email' },
              first_name: { type: 'string', description: 'First name' },
              last_name: { type: 'string', description: 'Last name' },
              phone: { type: 'string', description: 'Phone number' },
              tags: { type: 'string', description: 'Comma-separated tags' },
              accepts_marketing: { type: 'boolean', description: 'Accepts marketing emails' },
            },
          },
        },

        // Inventory Management
        {
          name: 'get_inventory_levels',
          description: 'Get inventory levels for products',
          inputSchema: {
            type: 'object',
            properties: {
              inventory_item_ids: { type: 'string', description: 'Comma-separated inventory item IDs' },
              location_ids: { type: 'string', description: 'Comma-separated location IDs' },
              limit: { type: 'number', description: 'Number of results (max 250)' },
            },
          },
        },
        {
          name: 'adjust_inventory',
          description: 'Adjust inventory levels',
          inputSchema: {
            type: 'object',
            required: ['location_id', 'inventory_item_id', 'available_adjustment'],
            properties: {
              location_id: { type: 'string', description: 'Location ID' },
              inventory_item_id: { type: 'string', description: 'Inventory item ID' },
              available_adjustment: { type: 'number', description: 'Quantity adjustment (positive or negative)' },
            },
          },
        },
        {
          name: 'set_inventory',
          description: 'Set inventory level to specific quantity',
          inputSchema: {
            type: 'object',
            required: ['location_id', 'inventory_item_id', 'available'],
            properties: {
              location_id: { type: 'string', description: 'Location ID' },
              inventory_item_id: { type: 'string', description: 'Inventory item ID' },
              available: { type: 'number', description: 'New inventory quantity' },
            },
          },
        },

        // Analytics & Reports
        {
          name: 'get_analytics_reports',
          description: 'Get analytics reports data',
          inputSchema: {
            type: 'object',
            properties: {
              report_type: { 
                type: 'string', 
                enum: ['sales_over_time', 'sessions_over_time', 'top_products', 'top_pages', 'top_referrers'],
                description: 'Type of analytics report'
              },
              date_min: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
              date_max: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              limit: { type: 'number', description: 'Number of results' },
            },
          },
        },
        
        // Collections
        {
          name: 'get_collections',
          description: 'Get product collections',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of collections to retrieve' },
              collection_type: { type: 'string', enum: ['smart', 'custom'], description: 'Collection type' },
            },
          },
        },
        {
          name: 'create_collection',
          description: 'Create a new collection',
          inputSchema: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string', description: 'Collection title' },
              body_html: { type: 'string', description: 'Collection description' },
              sort_order: { type: 'string', enum: ['alpha-asc', 'alpha-desc', 'best-selling', 'created', 'created-desc', 'manual', 'price-asc', 'price-desc'] },
              published: { type: 'boolean', description: 'Whether collection is published' },
            },
          },
        },

        // Discounts & Price Rules
        {
          name: 'get_price_rules',
          description: 'Get discount price rules',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of price rules to retrieve' },
            },
          },
        },
        {
          name: 'create_discount_code',
          description: 'Create a discount code',
          inputSchema: {
            type: 'object',
            required: ['price_rule_id', 'code'],
            properties: {
              price_rule_id: { type: 'string', description: 'Price rule ID' },
              code: { type: 'string', description: 'Discount code' },
              usage_limit: { type: 'number', description: 'Usage limit for the code' },
            },
          },
        },

        // Fulfillment
        {
          name: 'create_fulfillment',
          description: 'Create a fulfillment for an order',
          inputSchema: {
            type: 'object',
            required: ['order_id', 'line_items'],
            properties: {
              order_id: { type: 'string', description: 'Order ID' },
              location_id: { type: 'string', description: 'Location ID' },
              tracking_number: { type: 'string', description: 'Tracking number' },
              tracking_company: { type: 'string', description: 'Shipping company' },
              tracking_url: { type: 'string', description: 'Tracking URL' },
              notify_customer: { type: 'boolean', description: 'Send notification to customer' },
              line_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'Line item ID' },
                    quantity: { type: 'number', description: 'Quantity to fulfill' },
                  },
                },
              },
            },
          },
        },

        // Webhooks
        {
          name: 'get_webhooks',
          description: 'Get configured webhooks',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of webhooks to retrieve' },
            },
          },
        },
        {
          name: 'create_webhook',
          description: 'Create a new webhook',
          inputSchema: {
            type: 'object',
            required: ['topic', 'address'],
            properties: {
              topic: { type: 'string', description: 'Webhook topic (e.g., orders/create, products/update)' },
              address: { type: 'string', description: 'Webhook URL endpoint' },
              format: { type: 'string', enum: ['json', 'xml'], default: 'json' },
            },
          },
        },

        // Store Information
        {
          name: 'get_shop_info',
          description: 'Get shop information and settings',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_locations',
          description: 'Get store locations',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of locations to retrieve' },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_products':
            return await this.getProducts(args);
          case 'create_product':
            return await this.createProduct(args);
          case 'update_product':
            return await this.updateProduct(args);
          case 'delete_product':
            return await this.deleteProduct(args);
          case 'get_orders':
            return await this.getOrders(args);
          case 'get_order':
            return await this.getOrder(args);
          case 'update_order':
            return await this.updateOrder(args);
          case 'cancel_order':
            return await this.cancelOrder(args);
          case 'get_customers':
            return await this.getCustomers(args);
          case 'search_customers':
            return await this.searchCustomers(args);
          case 'create_customer':
            return await this.createCustomer(args);
          case 'update_customer':
            return await this.updateCustomer(args);
          case 'get_inventory_levels':
            return await this.getInventoryLevels(args);
          case 'adjust_inventory':
            return await this.adjustInventory(args);
          case 'set_inventory':
            return await this.setInventory(args);
          case 'get_analytics_reports':
            return await this.getAnalyticsReports(args);
          case 'get_collections':
            return await this.getCollections(args);
          case 'create_collection':
            return await this.createCollection(args);
          case 'get_price_rules':
            return await this.getPriceRules(args);
          case 'create_discount_code':
            return await this.createDiscountCode(args);
          case 'create_fulfillment':
            return await this.createFulfillment(args);
          case 'get_webhooks':
            return await this.getWebhooks(args);
          case 'create_webhook':
            return await this.createWebhook(args);
          case 'get_shop_info':
            return await this.getShopInfo(args);
          case 'get_locations':
            return await this.getLocations(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Shopify API error: ${error.response?.data?.errors || error.message}`
          );
        }
        throw error;
      }
    });
  }

  // Product Management Methods
  private async getProducts(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());
    if (args.page_info) params.append('page_info', args.page_info);
    if (args.status) params.append('status', args.status);
    if (args.vendor) params.append('vendor', args.vendor);
    if (args.product_type) params.append('product_type', args.product_type);
    if (args.collection_id) params.append('collection_id', args.collection_id);

    const response = await this.shopify.get(`/products.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createProduct(args: any) {
    const response = await this.shopify.post('/products.json', { product: args });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async updateProduct(args: any) {
    const { product_id, ...productData } = args;
    const response = await this.shopify.put(`/products/${product_id}.json`, { product: productData });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async deleteProduct(args: any) {
    await this.shopify.delete(`/products/${args.product_id}.json`);
    return {
      content: [
        {
          type: 'text',
          text: `Product ${args.product_id} deleted successfully`,
        },
      ],
    };
  }

  // Order Management Methods
  private async getOrders(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());
    if (args.status) params.append('status', args.status);
    if (args.financial_status) params.append('financial_status', args.financial_status);
    if (args.fulfillment_status) params.append('fulfillment_status', args.fulfillment_status);
    if (args.created_at_min) params.append('created_at_min', args.created_at_min);
    if (args.created_at_max) params.append('created_at_max', args.created_at_max);
    if (args.updated_at_min) params.append('updated_at_min', args.updated_at_min);
    if (args.updated_at_max) params.append('updated_at_max', args.updated_at_max);

    const response = await this.shopify.get(`/orders.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async getOrder(args: any) {
    const response = await this.shopify.get(`/orders/${args.order_id}.json`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async updateOrder(args: any) {
    const { order_id, ...orderData } = args;
    const response = await this.shopify.put(`/orders/${order_id}.json`, { order: orderData });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async cancelOrder(args: any) {
    const { order_id, ...cancelData } = args;
    const response = await this.shopify.post(`/orders/${order_id}/cancel.json`, cancelData);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Customer Management Methods
  private async getCustomers(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());
    if (args.created_at_min) params.append('created_at_min', args.created_at_min);
    if (args.created_at_max) params.append('created_at_max', args.created_at_max);
    if (args.updated_at_min) params.append('updated_at_min', args.updated_at_min);
    if (args.updated_at_max) params.append('updated_at_max', args.updated_at_max);

    const response = await this.shopify.get(`/customers.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async searchCustomers(args: any) {
    const params = new URLSearchParams();
    params.append('query', args.query);
    if (args.limit) params.append('limit', args.limit.toString());

    const response = await this.shopify.get(`/customers/search.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createCustomer(args: any) {
    const response = await this.shopify.post('/customers.json', { customer: args });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async updateCustomer(args: any) {
    const { customer_id, ...customerData } = args;
    const response = await this.shopify.put(`/customers/${customer_id}.json`, { customer: customerData });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Inventory Management Methods
  private async getInventoryLevels(args: any) {
    const params = new URLSearchParams();
    if (args.inventory_item_ids) params.append('inventory_item_ids', args.inventory_item_ids);
    if (args.location_ids) params.append('location_ids', args.location_ids);
    if (args.limit) params.append('limit', args.limit.toString());

    const response = await this.shopify.get(`/inventory_levels.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async adjustInventory(args: any) {
    const response = await this.shopify.post('/inventory_levels/adjust.json', args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async setInventory(args: any) {
    const response = await this.shopify.post('/inventory_levels/set.json', args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Analytics Methods
  private async getAnalyticsReports(args: any) {
    const params = new URLSearchParams();
    if (args.date_min) params.append('date_min', args.date_min);
    if (args.date_max) params.append('date_max', args.date_max);
    if (args.limit) params.append('limit', args.limit.toString());

    const endpoint = args.report_type ? `/reports/${args.report_type}.json` : '/reports.json';
    const response = await this.shopify.get(`${endpoint}?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Collection Methods
  private async getCollections(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());

    const endpoint = args.collection_type === 'smart' ? '/smart_collections.json' : '/custom_collections.json';
    const response = await this.shopify.get(`${endpoint}?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createCollection(args: any) {
    const endpoint = args.rules ? '/smart_collections.json' : '/custom_collections.json';
    const collectionType = args.rules ? 'smart_collection' : 'custom_collection';
    const response = await this.shopify.post(endpoint, { [collectionType]: args });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Price Rules Methods
  private async getPriceRules(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());

    const response = await this.shopify.get(`/price_rules.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createDiscountCode(args: any) {
    const { price_rule_id, ...codeData } = args;
    const response = await this.shopify.post(`/price_rules/${price_rule_id}/discount_codes.json`, {
      discount_code: codeData,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Fulfillment Methods
  private async createFulfillment(args: any) {
    const { order_id, ...fulfillmentData } = args;
    const response = await this.shopify.post(`/orders/${order_id}/fulfillments.json`, {
      fulfillment: fulfillmentData,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Webhook Methods
  private async getWebhooks(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());

    const response = await this.shopify.get(`/webhooks.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async createWebhook(args: any) {
    const response = await this.shopify.post('/webhooks.json', { webhook: args });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  // Shop Info Methods
  private async getShopInfo(args: any) {
    const response = await this.shopify.get('/shop.json');
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async getLocations(args: any) {
    const params = new URLSearchParams();
    if (args.limit) params.append('limit', args.limit.toString());

    const response = await this.shopify.get(`/locations.json?${params}`);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Shopify MCP server running on stdio');
  }
}

const server = new ShopifyMCPServer();
server.run().catch(console.error);