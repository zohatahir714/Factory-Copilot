import { z } from "zod";
import { fail, ok } from "@/lib/responses";
import {
  CheckInventorySchema,
  CreateProductSchema,
} from "./schemas";
import * as productsSvc from "@/lib/services/products";
import { getStore } from "@/lib/services/store";
import { fromService, toParameters, withPendingPreview, type ToolDefinition } from "./kit";

/** INVENTORY TOOLS (PRD §13 inventory; brief-zoha: tools/inventory.ts). */

export const inventoryTools: ToolDefinition[] = [
  {
    name: "check_inventory",
    description: "Check available stock for a product by name or SKU. Read-only.",
    domain: "inventory",
    mutates: false,
    zodSchema: CheckInventorySchema,
    parameters: toParameters(CheckInventorySchema),
    run: async (args) => fromService("check_inventory", CheckInventorySchema, productsSvc.lookupProduct, args),
  },
  {
    name: "create_product",
    description: "Create a new product. Write action — returns a preview; commits only after user confirmation.",
    domain: "inventory",
    mutates: true,
    zodSchema: CreateProductSchema,
    parameters: toParameters(CreateProductSchema),
    run: async (args, _ctx, mode) => {
      const input = CreateProductSchema.parse(args);
      if (mode === "preview") {
        const store = getStore();
        const duplicate =
          (await store.productBySku(input.sku)) ||
          (await store.productByName(input.name));
        if (duplicate) {
          return fail("create_product", "VALIDATION_ERROR", `Product or SKU already exists: ${input.name} / ${input.sku}`);
        }
        return withPendingPreview("create_product", `Create product "${input.name}" (SKU ${input.sku}, unit ${input.unit})`, input);
      }
      return productsSvc.createProduct(args);
    },
  },
];
