import { getDatabase } from "./db";
import type {
  Receipt,
  ReceiptWithUnit,
  ReceiptTotals,
  LBAUnit,
  ReceiptItem,
  ReceiptGroupedByLBA,
  ReceiptHistory,
} from "@/types";

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's a database lock error and we have retries left, wait and retry
      if (
        errorMessage.includes("database is locked") &&
        attempt < maxRetries - 1
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * (attempt + 1)),
        );
        continue;
      }

      // If it's not a lock error or we're out of retries, throw immediately
      throw error;
    }
  }

  throw lastError || new Error("Operation failed after retries");
}

export async function createLBAUnit(
  unit: Omit<LBAUnit, "id" | "created_at">,
): Promise<number> {
  const db = await getDatabase();

  try {
    // Insert LBA unit (auto-committed)
    const result = await db.execute(
      `INSERT INTO lba_units (unit, lba_name, crop, season, unit_head, qci_name, lba_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        unit.unit,
        unit.lba_name,
        unit.crop,
        unit.season,
        unit.unit_head,
        unit.qci_name,
        unit.lba_code,
      ],
    );

    // Initialize totals for this unit (auto-committed)
    await db.execute(
      `INSERT INTO receipt_totals (lba_unit_id, cumulative_credit, cumulative_debit, cumulative_mts, cumulative_bags)
       VALUES ($1, 0, 0, 0, 0)`,
      [result.lastInsertId],
    );

    return result.lastInsertId as number;
  } catch (error) {
    console.error("Error creating LBA unit:", error);
    throw error;
  }
}

export async function getAllLBAUnits(): Promise<LBAUnit[]> {
  const db = await getDatabase();
  return await db.select<LBAUnit[]>(
    "SELECT * FROM lba_units ORDER BY created_at DESC",
  );
}

export interface PaginatedLBAUnitsParams {
  limit: number;
  offset: number;
}

export interface PaginatedLBAUnitsResponse {
  data: LBAUnit[];
  hasMore: boolean;
  total: number;
}

export async function getLBAUnitsPaginated(
  params: PaginatedLBAUnitsParams,
): Promise<PaginatedLBAUnitsResponse> {
  const db = await getDatabase();
  const { limit, offset } = params;

  // Get total count
  const countResult = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM lba_units",
  );
  const total = countResult[0]?.count || 0;

  // Get paginated data
  const units = await db.select<LBAUnit[]>(
    "SELECT * FROM lba_units ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );

  return {
    data: units,
    hasMore: offset + units.length < total,
    total,
  };
}

export async function getLBAUnitById(id: number): Promise<LBAUnit | null> {
  const db = await getDatabase();
  const result = await db.select<LBAUnit[]>(
    "SELECT * FROM lba_units WHERE id = $1",
    [id],
  );
  return result.length > 0 ? result[0] : null;
}

export async function updateLBAUnit(
  id: number,
  unit: Omit<LBAUnit, "id" | "created_at">,
): Promise<void> {
  console.log("updateLBAUnit called with id:", id, "unit:", unit);
  const db = await getDatabase();
  const result = await db.execute(
    `UPDATE lba_units SET
      unit = $1,
      lba_name = $2,
      crop = $3,
      season = $4,
      unit_head = $5,
      qci_name = $6,
      lba_code = $7
    WHERE id = $8`,
    [
      unit.unit,
      unit.lba_name,
      unit.crop,
      unit.season,
      unit.unit_head,
      unit.qci_name,
      unit.lba_code,
      id,
    ],
  );
  console.log("updateLBAUnit result:", result);
}

// Get previous balance for an LBA (balance from the most recent receipt before this date)
export async function getPreviousBalance(
  lbaUnitId: number,
  currentDate: string,
): Promise<number> {
  const db = await getDatabase();

  const result = await db.select<{ balance_ghc: number }[]>(
    `
    SELECT balance_ghc 
    FROM receipts 
    WHERE lba_unit_id = $1 AND date < $2
    ORDER BY date DESC, created_at DESC
    LIMIT 1
  `,
    [lbaUnitId, currentDate],
  );

  return result.length > 0 ? result[0].balance_ghc : 0;
}

/**
 * Save a snapshot of receipt data before update
 */
async function saveReceiptSnapshot(
  receiptId: number,
  receipt: ReceiptWithUnit,
  changeSummary?: string,
): Promise<void> {
  const db = await getDatabase();
  try {
    const snapshotData = JSON.stringify({
      receipt: {
        id: receipt.id,
        lba_unit_id: receipt.lba_unit_id,
        date: receipt.date,
        whr_number: receipt.whr_number,
        description: receipt.description,
        credit_amount: receipt.credit_amount,
        debit_amount: receipt.debit_amount,
        weight: receipt.weight,
        balance_ghc: receipt.balance_ghc,
        previous_balance: receipt.previous_balance,
        mts: receipt.mts,
        bags: receipt.bags,
        created_at: receipt.created_at,
      },
      items: receipt.items || [],
      unit_info: {
        unit: receipt.unit,
        lba_code: receipt.lba_code,
        crop: receipt.crop,
        season: receipt.season,
        unit_head: receipt.unit_head,
        qci_name: receipt.qci_name,
      },
    });

    await db.execute(
      `INSERT INTO receipt_history (receipt_id, snapshot_data, change_summary, updated_at)
       VALUES ($1, $2, $3, datetime('now'))`,
      [receiptId, snapshotData, changeSummary || null],
    );
  } catch (error) {
    // Log but don't fail the update if snapshot save fails
    console.error("Error saving receipt snapshot:", error);
  }
}

export async function createReceipt(
  receipt: Omit<Receipt, "id" | "created_at">,
  items?: Omit<ReceiptItem, "id" | "receipt_id" | "created_at">[],
): Promise<number> {
  console.log("createReceipt called with:", {
    receipt,
    itemsCount: items?.length || 0,
  });

  // Get previous balance
  let previousBalance = receipt.previous_balance;
  if (previousBalance === undefined || previousBalance === null) {
    console.log("Getting previous balance...");
    previousBalance = await getPreviousBalance(
      receipt.lba_unit_id,
      receipt.date,
    );
    console.log("Previous balance:", previousBalance);
  }

  // Get current totals
  const db = await getDatabase();
  console.log("Got database connection");

  const totalsResult = await db.select<ReceiptTotals[]>(
    "SELECT * FROM receipt_totals WHERE lba_unit_id = $1",
    [receipt.lba_unit_id],
  );

  const currentTotals =
    totalsResult.length > 0
      ? totalsResult[0]
      : {
          lba_unit_id: receipt.lba_unit_id,
          cumulative_credit: 0,
          cumulative_debit: 0,
          cumulative_mts: 0,
          cumulative_bags: 0,
        };

  console.log("Current totals:", currentTotals);

  // Execute all operations without explicit transactions
  // SQLite will auto-commit each statement, and Tauri SQL plugin handles concurrency
  try {
    console.log("Starting receipt insertion...");
    // Insert receipt
    const result = await db.execute(
      `INSERT INTO receipts (
        lba_unit_id, lba_name, date, whr_number, description, credit_amount, debit_amount,
        weight, balance_ghc, previous_balance, mts, bags, signature
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        receipt.lba_unit_id,
        receipt.lba_name,
        receipt.date,
        receipt.whr_number,
        receipt.description,
        receipt.credit_amount,
        receipt.debit_amount,
        receipt.weight,
        receipt.balance_ghc,
        previousBalance,
        receipt.mts,
        receipt.bags,
        receipt.signature,
      ],
    );

    const receiptId = result.lastInsertId as number;
    console.log("Receipt inserted with ID:", receiptId);

    // Insert receipt items if provided
    if (items && items.length > 0) {
      console.log(`Inserting ${items.length} receipt items...`);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        console.log(`Inserting item ${i + 1}/${items.length}...`);
        await db.execute(
          `INSERT INTO receipt_items (
            receipt_id, description, credit_amount, debit_amount, weight, mts, bags, item_order, signature
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            receiptId,
            item.description,
            item.credit_amount,
            item.debit_amount,
            item.weight,
            item.mts,
            item.bags,
            item.item_order || i,
            item.signature || null,
          ],
        );
      }
    }

    // Update cumulative totals
    console.log("Updating cumulative totals...");
    await db.execute(
      `INSERT INTO receipt_totals (lba_unit_id, cumulative_credit, cumulative_debit, cumulative_mts, cumulative_bags, last_updated)
       VALUES ($1, $2, $3, $4, $5, datetime('now'))
       ON CONFLICT(lba_unit_id) DO UPDATE SET
         cumulative_credit = cumulative_credit + $6,
         cumulative_debit = cumulative_debit + $7,
         cumulative_mts = cumulative_mts + $8,
         cumulative_bags = cumulative_bags + $9,
         last_updated = datetime('now')`,
      [
        receipt.lba_unit_id,
        currentTotals.cumulative_credit + receipt.credit_amount,
        currentTotals.cumulative_debit + receipt.debit_amount,
        currentTotals.cumulative_mts + receipt.mts,
        currentTotals.cumulative_bags + receipt.bags,
        receipt.credit_amount,
        receipt.debit_amount,
        receipt.mts,
        receipt.bags,
      ],
    );
    console.log("Cumulative totals updated successfully");

    console.log("createReceipt completed successfully, receiptId:", receiptId);
    return receiptId;
  } catch (error) {
    console.error("Error in createReceipt:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    console.error("Receipt data:", receipt);
    console.error("Items:", items);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create receipt: ${errorMessage}`);
  }
}

export async function getAllReceipts(): Promise<ReceiptWithUnit[]> {
  const db = await getDatabase();
  return await db.select<ReceiptWithUnit[]>(`
    SELECT 
      r.*,
      (SELECT GROUP_CONCAT(signature, ', ') FROM (SELECT signature FROM receipt_items WHERE receipt_id = r.id AND signature IS NOT NULL AND signature != '' GROUP BY signature)) as item_signatures,
      u.unit,
      u.lba_name,
      u.lba_code,
      u.crop,
      u.season,
      u.unit_head,
      u.qci_name
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    ORDER BY r.date DESC, r.created_at DESC
  `);
}

export interface PaginatedReceiptsParams {
  limit: number;
  offset: number;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    lbaUnitId?: number;
    lbaName?: string;
    crop?: string;
  };
}

export interface PaginatedReceiptsResponse {
  data: ReceiptWithUnit[];
  hasMore: boolean;
  total: number;
}

export async function getReceiptsPaginated(
  params: PaginatedReceiptsParams,
): Promise<PaginatedReceiptsResponse> {
  const db = await getDatabase();
  const { limit, offset, filters } = params;

  // Build WHERE clause
  const whereConditions: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (filters?.dateFrom) {
    whereConditions.push(`r.date >= $${paramIndex++}`);
    queryParams.push(filters.dateFrom);
  }
  if (filters?.dateTo) {
    whereConditions.push(`r.date <= $${paramIndex++}`);
    queryParams.push(filters.dateTo);
  }
  if (filters?.lbaUnitId) {
    whereConditions.push(`r.lba_unit_id = $${paramIndex++}`);
    queryParams.push(filters.lbaUnitId);
  }
  if (filters?.lbaName) {
    whereConditions.push(`r.lba_name = $${paramIndex++}`);
    queryParams.push(filters.lbaName);
  }
  if (filters?.crop) {
    whereConditions.push(`u.crop LIKE $${paramIndex++}`);
    queryParams.push(`%${filters.crop}%`);
  }

  const whereClause =
    whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // Get total count
  const countResult = await db.select<{ count: number }[]>(
    `
    SELECT COUNT(*) as count
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    ${whereClause}
  `,
    queryParams,
  );
  const total = countResult[0]?.count || 0;

  // Get paginated data
  queryParams.push(limit, offset);
  const receipts = await db.select<ReceiptWithUnit[]>(
    `
    SELECT 
      r.*,
      (SELECT GROUP_CONCAT(signature, ', ') FROM (SELECT signature FROM receipt_items WHERE receipt_id = r.id AND signature IS NOT NULL AND signature != '' GROUP BY signature)) as item_signatures,
      u.unit,
      u.lba_name,
      u.lba_code,
      u.crop,
      u.season,
      u.unit_head,
      u.qci_name
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    ${whereClause}
    ORDER BY r.date DESC, r.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `,
    queryParams,
  );

  return {
    data: receipts,
    hasMore: offset + receipts.length < total,
    total,
  };
}

export async function getReceiptById(
  id: number,
): Promise<ReceiptWithUnit | null> {
  const db = await getDatabase();
  const result = await db.select<ReceiptWithUnit[]>(
    `
    SELECT 
      r.*,
      (SELECT GROUP_CONCAT(signature, ', ') FROM (SELECT signature FROM receipt_items WHERE receipt_id = r.id AND signature IS NOT NULL AND signature != '' GROUP BY signature)) as item_signatures,
      u.unit,
      u.lba_name,
      u.lba_code,
      u.crop,
      u.season,
      u.unit_head,
      u.qci_name
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    WHERE r.id = $1
  `,
    [id],
  );

  if (result.length === 0) {
    return null;
  }

  const receipt = result[0];

  // Get receipt items
  const items = await db.select<ReceiptItem[]>(
    `
    SELECT * FROM receipt_items 
    WHERE receipt_id = $1 
    ORDER BY item_order ASC, id ASC
  `,
    [id],
  );
  receipt.items = items;
  return receipt;
}

export async function getReceiptsByUnitId(
  lbaUnitId: number,
): Promise<ReceiptWithUnit[]> {
  const db = await getDatabase();
  return await db.select<ReceiptWithUnit[]>(
    `
    SELECT 
      r.*,
      (SELECT GROUP_CONCAT(signature, ', ') FROM (SELECT signature FROM receipt_items WHERE receipt_id = r.id AND signature IS NOT NULL AND signature != '' GROUP BY signature)) as item_signatures,
      u.unit,
      u.lba_name,
      u.lba_code,
      u.crop,
      u.season,
      u.unit_head,
      u.qci_name
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    WHERE r.lba_unit_id = $1
    ORDER BY r.date DESC, r.created_at DESC
  `,
    [lbaUnitId],
  );
}

export async function getReceiptTotals(
  lbaUnitId: number,
): Promise<ReceiptTotals | null> {
  const db = await getDatabase();

  const result = await db.select<ReceiptTotals[]>(
    "SELECT * FROM receipt_totals WHERE lba_unit_id = $1",
    [lbaUnitId],
  );
  return result.length > 0 ? result[0] : null;
}

export async function getDashboardStats(): Promise<{
  totalCredit: number;
  totalDebit: number;
  totalBalance: number;
  totalWeight: number;
  totalBags: number;
  totalMTS: number;
}> {
  const db = await getDatabase();
  const result = await db.select<
    {
      total_credit: number;
      total_debit: number;
      total_balance: number;
      total_weight: number;
      total_bags: number;
      total_mts: number;
    }[]
  >(`
    SELECT 
      COALESCE(SUM(credit_amount), 0) as total_credit,
      COALESCE(SUM(debit_amount), 0) as total_debit,
      COALESCE(SUM(balance_ghc), 0) as total_balance,
      COALESCE(SUM(weight), 0) as total_weight,
      COALESCE(SUM(bags), 0) as total_bags,
      COALESCE(SUM(mts), 0) as total_mts
    FROM receipts
  `);

  const stats = result[0] || {
    total_credit: 0,
    total_debit: 0,
    total_balance: 0,
    total_weight: 0,
    total_bags: 0,
    total_mts: 0,
  };

  return {
    totalCredit: stats.total_credit,
    totalDebit: stats.total_debit,
    totalBalance: stats.total_balance,
    totalWeight: stats.total_weight,
    totalBags: stats.total_bags,
    totalMTS: stats.total_mts,
  };
}

export async function updateReceipt(
  id: number,
  receipt: Omit<Receipt, "id" | "created_at" | "lba_unit_id">,
  items?: Omit<ReceiptItem, "id" | "receipt_id" | "created_at">[],
): Promise<void> {
  await executeWithRetry(
    async () => {
      const db = await getDatabase();

      // Get old receipt to calculate differences
      const oldReceipt = await db.select<Receipt[]>(
        "SELECT * FROM receipts WHERE id = $1",
        [id],
      );

      if (oldReceipt.length === 0) {
        throw new Error("Receipt not found");
      }

      const old = oldReceipt[0];

      // Get full receipt with items and unit info for snapshot
      const fullReceipt = await getReceiptById(id);
      if (!fullReceipt) {
        throw new Error("Receipt not found");
      }

      // Create change summary
      const changes: string[] = [];
      if (old.date !== receipt.date)
        changes.push(`Date: ${old.date} → ${receipt.date}`);
      if (old.whr_number !== receipt.whr_number)
        changes.push(`WHR Number: ${old.whr_number} → ${receipt.whr_number}`);
      if (old.description !== receipt.description)
        changes.push(`Description changed`);
      if (old.credit_amount !== receipt.credit_amount)
        changes.push(`Credit: ${old.credit_amount} → ${receipt.credit_amount}`);
      if (old.debit_amount !== receipt.debit_amount)
        changes.push(`Debit: ${old.debit_amount} → ${receipt.debit_amount}`);
      if (old.mts !== receipt.mts)
        changes.push(`MTS: ${old.mts} → ${receipt.mts}`);
      if (old.bags !== receipt.bags)
        changes.push(`Bags: ${old.bags} → ${receipt.bags}`);
      if (old.balance_ghc !== receipt.balance_ghc)
        changes.push(`Balance: ${old.balance_ghc} → ${receipt.balance_ghc}`);

      const oldItemsCount = fullReceipt.items?.length || 0;
      const newItemsCount = items?.length || 0;
      if (oldItemsCount !== newItemsCount) {
        changes.push(`Items count: ${oldItemsCount} → ${newItemsCount}`);
      }

      const changeSummary =
        changes.length > 0 ? changes.join("; ") : "Minor updates";

      // Save snapshot before updating (outside transaction to ensure it's saved even if update fails)
      await saveReceiptSnapshot(id, fullReceipt, changeSummary);

      // Get previous balance if not provided (do this before transaction to reduce lock time)
      let previousBalance = receipt.previous_balance;
      if (previousBalance === undefined || previousBalance === null) {
        previousBalance = await getPreviousBalance(
          old.lba_unit_id,
          receipt.date,
        );
      }

      // Tauri SQL plugin uses a connection pool; each execute() may use a different
      // connection, so BEGIN/COMMIT/ROLLBACK cause "cannot commit - no transaction is active".
      // Run each statement in auto-commit mode. If one fails, earlier ones may have committed.
      // The edit UI refetches from DB on error so the user sees current state.

      console.log("Executing UPDATE receipts with:", {
        id,
        lba_name: receipt.lba_name,
        date: receipt.date,
        whr_number: receipt.whr_number,
        description: receipt.description,
        credit_amount: receipt.credit_amount,
        debit_amount: receipt.debit_amount,
        weight: receipt.weight,
        balance_ghc: receipt.balance_ghc,
        previous_balance: previousBalance,
        mts: receipt.mts,
        bags: receipt.bags,
      });

      const updateResult = await db.execute(
        `UPDATE receipts SET
          lba_name = $1,
          date = $2,
          whr_number = $3,
          description = $4,
          credit_amount = $5,
          debit_amount = $6,
          weight = $7,
          balance_ghc = $8,
          previous_balance = $9,
          mts = $10,
          bags = $11,
          signature = $12
        WHERE id = $13`,
        [
          receipt.lba_name,
          receipt.date,
          receipt.whr_number,
          receipt.description,
          receipt.credit_amount,
          receipt.debit_amount,
          receipt.weight,
          receipt.balance_ghc,
          previousBalance,
          receipt.mts,
          receipt.bags,
          receipt.signature,
          id,
        ],
      );

      console.log("UPDATE receipts result:", updateResult);

      const totalsCheck = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM receipt_totals WHERE lba_unit_id = $1",
        [old.lba_unit_id],
      );

      if (totalsCheck[0]?.count === 0) {
        await db.execute(
          `INSERT INTO receipt_totals (lba_unit_id, cumulative_credit, cumulative_debit, cumulative_mts, cumulative_bags, last_updated)
           VALUES ($1, 0, 0, 0, 0, datetime('now'))`,
          [old.lba_unit_id],
        );
      }

      await db.execute(
        `UPDATE receipt_totals SET
          cumulative_credit = cumulative_credit - $1 + $2,
          cumulative_debit = cumulative_debit - $3 + $4,
          cumulative_mts = cumulative_mts - $5 + $6,
          cumulative_bags = cumulative_bags - $7 + $8,
          last_updated = datetime('now')
        WHERE lba_unit_id = $9`,
        [
          old.credit_amount,
          receipt.credit_amount,
          old.debit_amount,
          receipt.debit_amount,
          old.mts,
          receipt.mts,
          old.bags,
          receipt.bags,
          old.lba_unit_id,
        ],
      );

      if (items !== undefined) {
        await db.execute("DELETE FROM receipt_items WHERE receipt_id = $1", [
          id,
        ]);

        if (items.length > 0) {
          const BATCH_SIZE = 50;
          for (
            let batchStart = 0;
            batchStart < items.length;
            batchStart += BATCH_SIZE
          ) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, items.length);
            const batch = items.slice(batchStart, batchEnd);

            const valuePlaceholders: string[] = [];
            const params: unknown[] = [];
            let paramCounter = 1;

            batch.forEach((item, i) => {
              const baseIndex = batchStart + i;
              valuePlaceholders.push(
                `($${paramCounter}, $${paramCounter + 1}, $${paramCounter + 2}, $${paramCounter + 3}, $${paramCounter + 4}, $${paramCounter + 5}, $${paramCounter + 6}, $${paramCounter + 7}, $${paramCounter + 8})`,
              );
              params.push(
                id,
                item.description,
                item.credit_amount,
                item.debit_amount,
                item.weight,
                item.mts,
                item.bags,
                item.item_order ?? baseIndex,
                item.signature || null,
              );
              paramCounter += 9;
            });

            try {
              await db.execute(
                `INSERT INTO receipt_items (
                  receipt_id, description, credit_amount, debit_amount, weight, mts, bags, item_order, signature
                ) VALUES ${valuePlaceholders.join(", ")}`,
                params,
              );
            } catch (bulkError) {
              const bulkErrorMsg =
                bulkError instanceof Error
                  ? bulkError.message
                  : String(bulkError);
              if (
                bulkErrorMsg.includes("constraint") ||
                bulkErrorMsg.includes("UNIQUE") ||
                bulkErrorMsg.includes("FOREIGN KEY") ||
                bulkErrorMsg.includes("NOT NULL")
              ) {
                throw bulkError;
              }
              console.warn(
                "Bulk insert failed, using individual inserts:",
                bulkError,
              );
              for (const item of batch) {
                const baseIndex = batchStart + batch.indexOf(item);
                await db.execute(
                  `INSERT INTO receipt_items (
                    receipt_id, description, credit_amount, debit_amount, weight, mts, bags, item_order, signature
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                  [
                    id,
                    item.description,
                    item.credit_amount,
                    item.debit_amount,
                    item.weight,
                    item.mts,
                    item.bags,
                    item.item_order ?? baseIndex,
                    item.signature || null,
                  ],
                );
              }
            }
          }
        }
      }
    },
    3,
    150,
  );
}

export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDatabase();

  const receipt = await db.select<Receipt[]>(
    "SELECT * FROM receipts WHERE id = $1",
    [id],
  );

  if (receipt.length === 0) {
    throw new Error("Receipt not found");
  }

  const rec = receipt[0];

  // No explicit transaction - Tauri SQL plugin uses a connection pool;
  // BEGIN/COMMIT on different connections cause "no transaction is active".
  await db.execute("DELETE FROM receipt_items WHERE receipt_id = $1", [id]);
  await db.execute("DELETE FROM receipts WHERE id = $1", [id]);
  await db.execute(
    `UPDATE receipt_totals SET
      cumulative_credit = cumulative_credit - $1,
      cumulative_debit = cumulative_debit - $2,
      cumulative_mts = cumulative_mts - $3,
      cumulative_bags = cumulative_bags - $4,
      last_updated = datetime('now')
    WHERE lba_unit_id = $5`,
    [rec.credit_amount, rec.debit_amount, rec.mts, rec.bags, rec.lba_unit_id],
  );
}

// Get receipts grouped by LBA with outstanding balance
export async function getReceiptsGroupedByLBA(): Promise<
  ReceiptGroupedByLBA[]
> {
  const db = await getDatabase();

  // Get all receipts with unit info
  const receipts = await db.select<ReceiptWithUnit[]>(`
    SELECT 
      r.*,
      (SELECT GROUP_CONCAT(signature, ', ') FROM (SELECT signature FROM receipt_items WHERE receipt_id = r.id AND signature IS NOT NULL AND signature != '' GROUP BY signature)) as item_signatures,
      u.lba_name,
      u.lba_code,
      u.crop,
      u.season,
      u.unit_head,
      u.qci_name
    FROM receipts r
    INNER JOIN lba_units u ON r.lba_unit_id = u.id
    ORDER BY r.date DESC, r.created_at DESC
  `);

  // Get items for all receipts
  const receiptIds = receipts
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined);
  let items: ReceiptItem[] = [];
  if (receiptIds.length > 0) {
    items = await db.select<ReceiptItem[]>(
      `
      SELECT * FROM receipt_items 
      WHERE receipt_id IN (${receiptIds.map(() => "?").join(",")})
      ORDER BY receipt_id, item_order ASC, id ASC
    `,
      receiptIds,
    );
  }

  // Attach items to receipts
  const itemsByReceiptId = new Map<number, ReceiptItem[]>();
  items.forEach((item) => {
    if (!itemsByReceiptId.has(item.receipt_id)) {
      itemsByReceiptId.set(item.receipt_id, []);
    }
    itemsByReceiptId.get(item.receipt_id)!.push(item);
  });

  receipts.forEach((receipt) => {
    if (receipt.id) {
      receipt.items = itemsByReceiptId.get(receipt.id) || [];
    }
  });

  // Group by NAME OF LBA (lba_name field in receipts)
  const grouped = new Map<string, ReceiptGroupedByLBA>();

  receipts.forEach((receipt) => {
    // Use lba_name from receipt
    const lbaName = receipt.lba_name;
    if (!lbaName) return;

    if (!grouped.has(lbaName)) {
      grouped.set(lbaName, {
        lba_name: lbaName,
        lba_unit_id: receipt.lba_unit_id,
        unit: lbaName,
        lba_code: receipt.lba_code || "",
        crop: receipt.crop,
        season: receipt.season,
        receipts: [],
        outstanding_balance: 0,
      });
    }

    const group = grouped.get(lbaName)!;
    group.receipts.push(receipt);
  });

  // Calculate outstanding balance and sort by Name
  const result = Array.from(grouped.values()).sort((a, b) =>
    (a.unit || "").localeCompare(b.unit || ""),
  );
  result.forEach((group) => {
    if (group.receipts.length > 0) {
      // Most recent receipt's balance is the outstanding balance
      group.outstanding_balance = group.receipts[0].balance_ghc || 0;
    }
  });

  return result;
}

// Autocomplete functions for suggestions
export async function searchLBAUnits(
  query: string,
  limit: number = 10,
): Promise<LBAUnit[]> {
  const db = await getDatabase();
  const searchTerm = `%${query}%`;

  // Search units from lba_units table by unit or lba_name
  const units = await db.select<LBAUnit[]>(
    `
    SELECT * FROM lba_units 
    WHERE unit LIKE $1 OR lba_name LIKE $1
    ORDER BY lba_name ASC
    LIMIT $2
  `,
    [searchTerm, limit],
  );

  // If we have space, also look for unique lba_names in receipts that might be slightly different
  if (units.length < limit) {
    const remainingLimit = limit - units.length;
    const placeholders =
      units.length > 0 ? units.map((_, i) => `$${i + 2}`).join(",") : "''";
    const namesResult = await db.select<{ lba_name: string }[]>(
      `SELECT DISTINCT lba_name FROM receipts 
       WHERE lba_name LIKE $1 
       AND lba_name NOT IN (${placeholders})
       LIMIT $${units.length + 2}`,
      [searchTerm, ...units.map((u) => u.lba_name), remainingLimit],
    );

    // Map these names to partial LBAUnit objects
    const additionalUnits: LBAUnit[] = namesResult.map((r) => ({
      unit: r.lba_name,
      lba_name: r.lba_name,
      crop: "",
      season: "",
      unit_head: "",
      qci_name: "",
      lba_code: "",
    }));

    return [...units, ...additionalUnits];
  }

  return units;
}

export async function searchWHRNumbers(
  query: string,
  limit: number = 10,
): Promise<string[]> {
  const db = await getDatabase();
  const searchTerm = `%${query}%`;
  const results = await db.select<{ whr_number: string }[]>(
    `
    SELECT DISTINCT whr_number 
    FROM receipts 
    WHERE whr_number LIKE $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [searchTerm, limit],
  );
  return results.map((r) => r.whr_number);
}

export async function searchReceiptDescriptions(
  query: string,
  limit: number = 10,
): Promise<string[]> {
  const db = await getDatabase();
  const searchTerm = `%${query}%`;
  const results = await db.select<{ description: string }[]>(
    `
    SELECT DISTINCT description 
    FROM receipts 
    WHERE description LIKE $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [searchTerm, limit],
  );
  return results.map((r) => r.description);
}

export async function searchItemDescriptions(
  query: string,
  limit: number = 10,
): Promise<string[]> {
  const db = await getDatabase();
  const searchTerm = `%${query}%`;
  const results = await db.select<{ description: string }[]>(
    `
    SELECT DISTINCT description 
    FROM receipt_items 
    WHERE description LIKE $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    [searchTerm, limit],
  );
  return results.map((r) => r.description);
}

/**
 * Get receipt history/activity log for a receipt
 */
export async function getReceiptHistory(
  receiptId: number,
): Promise<ReceiptHistory[]> {
  const db = await getDatabase();
  return await db.select<ReceiptHistory[]>(
    `
    SELECT * FROM receipt_history 
    WHERE receipt_id = $1 
    ORDER BY updated_at DESC
  `,
    [receiptId],
  );
}

/**
 * Get a specific history snapshot by ID
 */
export async function getReceiptHistorySnapshot(
  historyId: number,
): Promise<ReceiptHistory | null> {
  const db = await getDatabase();
  const results = await db.select<ReceiptHistory[]>(
    `
    SELECT * FROM receipt_history 
    WHERE id = $1
  `,
    [historyId],
  );
  return results.length > 0 ? results[0] : null;
}
