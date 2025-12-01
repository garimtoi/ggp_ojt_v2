// OJT Master v2.3.0 - Database Utilities (Dexie.js)

import Dexie from 'dexie';

// Initialize Dexie database
export const localDb = new Dexie('OJT_LocalDB');

// Schema with compound indexes for optimized queries
localDb.version(2).stores({
  users: 'id, name, role, department',
  ojt_docs: 'id, team, step, author_id, updated_at, [team+step], [author_id+updated_at]',
  learning_records: 'id, user_id, doc_id, completed_at, [user_id+doc_id], [user_id+completed_at]',
  sync_queue: '++id, table, action, created_at',
});

// Sync queue processing flag
let isSyncQueueProcessing = false;

// Default timeout for Supabase queries
const SUPABASE_QUERY_TIMEOUT = 10000; // 10 seconds

/**
 * Wrap a promise with a timeout
 */
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Get all records from a table with optional filter
 * @param {string} table - Table name
 * @param {Object} filter - Optional filter object
 * @returns {Promise<Array>} - Array of records
 */
export async function dbGetAll(table, filter = null) {
  try {
    const localData = await localDb[table].toArray();

    // Return local data if no supabase connection
    if (!window.supabase) {
      return localData;
    }

    // Build Supabase query
    let query = window.supabase.from(table).select('*');

    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        // Convert camelCase to snake_case for Supabase
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        query = query.eq(snakeKey, value);
      });
    }

    // Execute with timeout to prevent infinite loading
    const { data: remoteData, error } = await withTimeout(query, SUPABASE_QUERY_TIMEOUT);

    if (error) {
      console.warn(`Supabase error for ${table}:`, error);
      return localData;
    }

    // Sync local cache with remote data
    if (remoteData && remoteData.length > 0) {
      await Promise.all(remoteData.map((item) => localDb[table].put(item)));

      // Remove items that no longer exist on remote (for filtered queries)
      if (filter) {
        const remoteIds = new Set(remoteData.map((item) => item.id));
        const toDelete = localData.filter((item) => !remoteIds.has(item.id));
        if (toDelete.length > 0) {
          await Promise.all(toDelete.map((item) => localDb[table].delete(item.id)));
        }
      }

      return remoteData;
    }

    return localData;
  } catch (error) {
    console.error(`dbGetAll error for ${table}:`, error);
    return [];
  }
}

/**
 * Save a record to both local and remote database
 * @param {string} table - Table name
 * @param {Object} data - Data to save
 * @returns {Promise<Object>} - Saved data
 */
export async function dbSave(table, data) {
  try {
    // Save to local first
    await localDb[table].put(data);

    // Try to save to remote
    if (window.supabase) {
      const { data: savedData, error } = await window.supabase
        .from(table)
        .upsert(data)
        .select()
        .single();

      if (error) {
        // Queue for later sync
        await addToSyncQueue(table, 'upsert', data);
        console.warn(`Queued ${table} for sync:`, error);
      } else {
        return savedData;
      }
    } else {
      // Queue for later sync
      await addToSyncQueue(table, 'upsert', data);
    }

    return data;
  } catch (error) {
    console.error(`dbSave error for ${table}:`, error);
    throw error;
  }
}

/**
 * Delete a record from both local and remote database
 * @param {string} table - Table name
 * @param {string} id - Record ID
 */
export async function dbDelete(table, id) {
  try {
    // Delete from local first
    await localDb[table].delete(id);

    // Try to delete from remote
    if (window.supabase) {
      const { error } = await window.supabase.from(table).delete().eq('id', id);

      if (error) {
        // Queue for later sync
        await addToSyncQueue(table, 'delete', { id });
        console.warn(`Queued delete for ${table}:`, error);
      }
    } else {
      // Queue for later sync
      await addToSyncQueue(table, 'delete', { id });
    }
  } catch (error) {
    console.error(`dbDelete error for ${table}:`, error);
    throw error;
  }
}

/**
 * Add an action to the sync queue
 */
async function addToSyncQueue(table, action, data) {
  await localDb.sync_queue.add({
    table,
    action,
    data,
    created_at: Date.now(),
  });
}

/**
 * Process the sync queue
 */
export async function processSyncQueue() {
  // Prevent concurrent processing
  if (isSyncQueueProcessing) return;
  isSyncQueueProcessing = true;

  try {
    const queue = await localDb.sync_queue.toArray();

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          const { error } = await window.supabase.from(item.table).upsert(item.data);
          if (!error) {
            await localDb.sync_queue.delete(item.id);
          }
        } else if (item.action === 'delete') {
          const { error } = await window.supabase.from(item.table).delete().eq('id', item.data.id);
          if (!error) {
            await localDb.sync_queue.delete(item.id);
          }
        }
      } catch (error) {
        console.error('Sync queue item error:', error);
        // Keep item in queue for retry
      }
    }
  } finally {
    isSyncQueueProcessing = false;
  }
}

/**
 * Clear all local cache
 */
export async function clearAllCache() {
  await localDb.users.clear();
  await localDb.ojt_docs.clear();
  await localDb.learning_records.clear();
  await localDb.sync_queue.clear();
  console.log('All cache cleared');
}

// Auto-process sync queue when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', processSyncQueue);
}
