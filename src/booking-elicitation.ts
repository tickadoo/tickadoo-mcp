import type { ElicitRequestFormParams, ElicitResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Optional booking elicitation for the stdio bridge.
 *
 * Asks only for date, party, and seat properties the tool schema accepts.
 * Dismissing that form forwards the original arguments. Dismissing or
 * rejecting the held-price confirmation returns a clear error and does not
 * start checkout. This module does not calculate or rewrite a price.
 */

export type BookingRole = "search" | "hold" | "checkout";

export type HeldPrice = {
  amount: string;
  currency: string;
};

export type MissingField = {
  argument: string;
  kind: "date" | "party" | "seat";
  title: string;
  description: string;
  minimum?: number;
  maximum?: number;
};

export type ToolInputSchema = {
  properties: Record<string, JsonSchemaProperty>;
};

type JsonSchemaProperty = {
  type?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  enum?: unknown;
};

export type ElicitationForm = {
  message: string;
  requestedSchema: ElicitRequestFormParams["requestedSchema"];
};

export type BookingCallDecision =
  | {
      type: "forward";
      args: Record<string, unknown>;
      role: BookingRole | undefined;
    }
  | {
      type: "result";
      result: {
        content: Array<{ type: "text"; text: string }>;
        isError: true;
        structuredContent: Record<string, unknown>;
      };
    };

const SEARCH_TOOLS = new Set(["search", "search_experiences", "booking_search"]);
const HOLD_TOOLS = new Set(["hold", "booking_hold"]);
const CHECKOUT_TOOLS = new Set(["checkout_handoff", "checkout-handoff"]);

const DATE_FIELDS = [
  {
    argument: "date",
    kind: "date",
    title: "Date",
    description: "Date for this booking, as YYYY-MM-DD.",
  },
  {
    argument: "date_from",
    kind: "date",
    title: "Start date",
    description: "First date to check, as YYYY-MM-DD.",
  },
  {
    argument: "date_to",
    kind: "date",
    title: "End date",
    description: "Last date to check, as YYYY-MM-DD.",
  },
] as const satisfies readonly MissingField[];

const PARTY_FIELDS = [
  {
    argument: "party_size",
    kind: "party",
    title: "Party size",
    description: "Number of guests.",
  },
  {
    argument: "pax",
    kind: "party",
    title: "Party size",
    description: "Number of guests.",
  },
  {
    argument: "quantity",
    kind: "party",
    title: "Party size",
    description: "Number of guests.",
  },
] as const satisfies readonly MissingField[];

const SEAT_FIELDS = [
  {
    argument: "seat_preference",
    kind: "seat",
    title: "Seat preference",
    description: "For example stalls, dress circle, balcony, best available, or no preference.",
  },
] as const satisfies readonly MissingField[];

type Elicit = (form: ElicitationForm) => Promise<ElicitResult>;

export function clientSupportsFormElicitation(
  capabilities: { elicitation?: { form?: unknown } } | undefined,
): boolean {
  const form = capabilities?.elicitation?.form;
  return typeof form === "object" && form !== null;
}

export function bookingToolRole(name: string): BookingRole | undefined {
  if (SEARCH_TOOLS.has(name)) return "search";
  if (HOLD_TOOLS.has(name)) return "hold";
  if (CHECKOUT_TOOLS.has(name)) return "checkout";
  return undefined;
}

export function schemasFromToolsList(result: unknown): Map<string, ToolInputSchema> {
  const schemas = new Map<string, ToolInputSchema>();
  if (!result || typeof result !== "object") return schemas;

  const tools = (result as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) return schemas;

  for (const tool of tools) {
    if (!tool || typeof tool !== "object") continue;
    const name = (tool as { name?: unknown }).name;
    const inputSchema = (tool as { inputSchema?: unknown }).inputSchema;
    if (typeof name !== "string" || !inputSchema || typeof inputSchema !== "object") continue;
    const properties = (inputSchema as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) continue;
    schemas.set(name, { properties: properties as ToolInputSchema["properties"] });
  }

  return schemas;
}

export function readHeldPriceFromToolResult(result: unknown): HeldPrice | undefined {
  if (!result || typeof result !== "object") return undefined;
  const record = result as { isError?: unknown; structuredContent?: unknown };
  if (record.isError === true) return undefined;
  if (!record.structuredContent || typeof record.structuredContent !== "object") return undefined;
  return readPriceRecord(record.structuredContent as Record<string, unknown>);
}

export function readHeldPriceFromArguments(
  args: Record<string, unknown>,
): HeldPrice | undefined {
  return readPriceRecord(args);
}

export async function resolveBookingToolCall(input: {
  toolName: string;
  args: Record<string, unknown>;
  schema: ToolInputSchema | undefined;
  heldPrice: HeldPrice | undefined;
  elicit: Elicit;
}): Promise<BookingCallDecision> {
  const role = bookingToolRole(input.toolName);
  if (!role) return { type: "forward", args: input.args, role: undefined };

  let args = input.args;
  const missing = missingBookingFields(input.schema, args);
  if (missing.length > 0) {
    const elicited = await elicitOrUndefined(input.elicit, buildDetailsForm(missing));
    if (elicited?.action === "accept") {
      args = applyAcceptedDetails(args, missing, elicited.content);
    }
  }

  if (role === "checkout") {
    const price = input.heldPrice ?? readHeldPriceFromArguments(args);
    if (price) {
      let elicited: ElicitResult | undefined;
      try {
        elicited = await input.elicit(buildPriceForm(price));
      } catch (error) {
        if (isAbortError(error)) throw error;
        return { type: "forward", args, role };
      }

      const confirmed =
        elicited.action === "accept" && elicited.content?.confirm_held_price === true;
      if (!confirmed) {
        // A dismissed confirmation is not approval. The clear error is the
        // fallback; forwarding here would guess that the user confirmed.
        const action = elicited.action === "accept" ? "reject" : elicited.action;
        return { type: "result", result: priceConfirmationDeclined(price, action) };
      }
    }
  }

  return { type: "forward", args, role };
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  if (name === "AbortError") return true;
  const message = "message" in error ? String(error.message) : "";
  return message.includes("AbortError") || message.includes("This operation was aborted");
}

function missingBookingFields(
  schema: ToolInputSchema | undefined,
  args: Record<string, unknown>,
): MissingField[] {
  if (!schema) return [];

  const missing: MissingField[] = [];
  for (const field of DATE_FIELDS) {
    if (schemaHas(schema, field.argument, "string") && isBlank(args[field.argument])) {
      missing.push(field);
    }
  }
  for (const field of PARTY_FIELDS) {
    if (schemaHas(schema, field.argument, "number") && isBlank(args[field.argument])) {
      const property = schema.properties[field.argument];
      missing.push({
        ...field,
        ...(typeof property?.minimum === "number" ? { minimum: property.minimum } : { minimum: 1 }),
        ...(typeof property?.maximum === "number" ? { maximum: property.maximum } : {}),
      });
    }
  }
  for (const field of SEAT_FIELDS) {
    if (schemaHas(schema, field.argument, "string") && isBlank(args[field.argument])) {
      missing.push(field);
    }
  }
  return missing;
}

function schemaHas(
  schema: ToolInputSchema,
  argument: string,
  expected: "string" | "number",
): boolean {
  const property = schema.properties[argument];
  if (!property) return false;
  const type = propertyType(property);
  if (expected === "string") return type === undefined || type === "string";
  return type === undefined || type === "integer" || type === "number";
}

function propertyType(property: JsonSchemaProperty): string | undefined {
  const { type } = property;
  if (typeof type === "string") return type;
  if (!Array.isArray(type)) return undefined;
  const nonNull = type.find(item => item !== "null");
  return typeof nonNull === "string" ? nonNull : undefined;
}

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return typeof value === "string" && value.trim() === "";
}

function buildDetailsForm(fields: MissingField[]): ElicitationForm {
  const properties: ElicitationForm["requestedSchema"]["properties"] = {};
  for (const field of fields) {
    if (field.kind === "party") {
      properties[field.argument] = {
        type: "integer",
        title: field.title,
        description: field.description,
        minimum: field.minimum ?? 1,
        ...(field.maximum === undefined ? {} : { maximum: field.maximum }),
      };
      continue;
    }

    properties[field.argument] = {
      type: "string",
      title: field.title,
      description: field.description,
      ...(field.kind === "date" ? { format: "date" as const } : {}),
    };
  }

  const labels = fields.map(field => field.title.toLowerCase()).join(", ");
  return {
    message: `Please provide the missing ${labels} for this booking. If you dismiss this, the request continues without a guessed value.`,
    requestedSchema: {
      type: "object",
      properties,
      required: fields.map(field => field.argument),
    },
  };
}

function buildPriceForm(price: HeldPrice): ElicitationForm {
  return {
    message: `Confirm the held price of ${price.amount} ${price.currency} before the checkout handoff. This does not charge anything. Confirm only if that held price is right.`,
    requestedSchema: {
      type: "object",
      properties: {
        confirm_held_price: {
          type: "boolean",
          title: "Confirm held price",
          description: `Confirm ${price.amount} ${price.currency} to continue to checkout.`,
        },
      },
      required: ["confirm_held_price"],
    },
  };
}

function applyAcceptedDetails(
  args: Record<string, unknown>,
  fields: MissingField[],
  content: ElicitResult["content"],
): Record<string, unknown> {
  if (!content) return args;

  const next = { ...args };
  let changed = false;
  for (const field of fields) {
    const value = content[field.argument];
    if (!isUsableAnswer(field, value)) continue;
    next[field.argument] = field.kind === "seat" && typeof value === "string" ? value.trim() : value;
    changed = true;
  }
  return changed ? next : args;
}

function isUsableAnswer(field: MissingField, value: unknown): boolean {
  if (field.kind === "date") {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
  if (field.kind === "seat") {
    return typeof value === "string" && value.trim().length > 0;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (value < (field.minimum ?? 1)) return false;
  return field.maximum === undefined || value <= field.maximum;
}

function priceConfirmationDeclined(price: HeldPrice, action: string) {
  const message = `Checkout handoff was not confirmed (${action}). No checkout was started for the held price of ${price.amount} ${price.currency}.`;
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
    structuredContent: {
      error_type: "price_confirmation_declined",
      action,
      amount: price.amount,
      currency: price.currency,
      message,
    },
  };
}

async function elicitOrUndefined(elicit: Elicit, form: ElicitationForm): Promise<ElicitResult | undefined> {
  try {
    return await elicit(form);
  } catch (error) {
    if (isAbortError(error)) throw error;
    return undefined;
  }
}

function readPriceRecord(record: Record<string, unknown>): HeldPrice | undefined {
  for (const key of ["held_price", "price"]) {
    const nested = record[key];
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
    const price = amountAndCurrency(nested as Record<string, unknown>);
    if (price) return price;
  }
  return amountAndCurrency(record);
}

function amountAndCurrency(record: Record<string, unknown>): HeldPrice | undefined {
  const currency = textValue(record.currency) ?? textValue(record.currency_code);
  const amount =
    scalarValue(record.amount) ??
    scalarValue(record.total_amount) ??
    scalarValue(record.totalAmount);
  if (!currency || amount === undefined) return undefined;
  return { amount, currency };
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function scalarValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return textValue(value);
}
