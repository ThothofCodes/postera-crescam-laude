/**
 * Database Health Monitoring Module
 *
 * Provides comprehensive health checks for MongoDB including:
 * - Connection pool status
 * - Index health and usage statistics
 * - Query performance metrics
 * - Replication lag (if applicable)
 * - Storage statistics
 * - Slow query detection
 */

const mongoose = require('mongoose');

class DatabaseHealthMonitor {
  constructor() {
    this.metrics = {
      connectionPool: {},
      indexStats: {},
      queryStats: {},
      storageStats: {},
      slowQueries: [],
      lastChecked: null,
    };

    // Cache metrics for 30 seconds
    this.cacheTimeout = 30000;
    this.lastCacheTime = 0;
  }

  /**
   * Get comprehensive database health status
   */
  async getHealthStatus() {
    const now = Date.now();

    // Return cached metrics if still valid
    if (now - this.lastCacheTime < this.cacheTimeout && this.metrics.lastChecked) {
      return this.metrics;
    }

    try {
      const { db } = mongoose.connection;

      if (!db) {
        return {
          status: 'error',
          message: 'Database not connected',
          timestamp: new Date().toISOString(),
        };
      }

      // Run all health checks in parallel
      const [
        connectionPool,
        indexStats,
        storageStats,
        serverStatus,
        replicaSetStatus,
      ] = await Promise.allSettled([
        this.getConnectionPoolStats(db),
        this.getIndexStats(db),
        this.getStorageStats(db),
        this.getServerStatus(db),
        this.getReplicaSetStatus(db),
      ]);

      // Compile results
      this.metrics = {
        status: this.determineOverallStatus(connectionPool, indexStats, storageStats),
        connectionPool: connectionPool.status === 'fulfilled' ? connectionPool.value : { error: connectionPool.reason?.message },
        indexStats: indexStats.status === 'fulfilled' ? indexStats.value : { error: indexStats.reason?.message },
        storageStats: storageStats.status === 'fulfilled' ? storageStats.value : { error: storageStats.reason?.message },
        serverStatus: serverStatus.status === 'fulfilled' ? serverStatus.value : { error: serverStatus.reason?.message },
        replicaSet: replicaSetStatus.status === 'fulfilled' ? replicaSetStatus.value : { error: replicaSetStatus.reason?.message },
        lastChecked: new Date().toISOString(),
        checkDuration: Date.now() - now,
      };

      this.lastCacheTime = now;
      return this.metrics;
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionPoolStats(db) {
    const admin = db.admin();

    try {
      // Get server status for connection pool info
      const status = await admin.serverStatus();

      return {
        current: status.connections?.current || 0,
        available: status.connections?.available || 0,
        totalCreated: status.connections?.totalCreated || 0,
        active: status.connections?.active || 0,
        threadCount: status.connections?.threadCount || 0,
        exhaustMax: status.connections?.exhaustMax || 0,

        // Connection pool health indicators
        utilizationPercent: status.connections?.available
          ? ((status.connections.current / status.connections.available) * 100).toFixed(2)
          : 0,

        // Recommendations
        warnings: this.getConnectionWarnings(status.connections),
      };
    } catch (error) {
      // Fallback to mongoose connection state
      return {
        readyState: mongoose.connection.readyState,
        readyStateText: this.getReadyStateText(mongoose.connection.readyState),
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        error: error.message,
      };
    }
  }

  /**
   * Get connection pool warnings
   */
  getConnectionWarnings(connections) {
    const warnings = [];

    if (!connections) return warnings;

    const utilization = connections.available
      ? (connections.current / connections.available) * 100
      : 0;

    if (utilization > 80) {
      warnings.push({
        level: 'critical',
        message: `Connection pool utilization is high: ${utilization.toFixed(1)}%`,
        recommendation: 'Consider increasing maxPoolSize or optimizing connection usage',
      });
    } else if (utilization > 60) {
      warnings.push({
        level: 'warning',
        message: `Connection pool utilization is moderate: ${utilization.toFixed(1)}%`,
        recommendation: 'Monitor closely and consider scaling if trend continues',
      });
    }

    if (connections.current > 100) {
      warnings.push({
        level: 'info',
        message: `High number of active connections: ${connections.current}`,
        recommendation: 'Review connection pooling configuration',
      });
    }

    return warnings;
  }

  /**
   * Get index statistics
   */
  async getIndexStats(db) {
    const collections = await db.listCollections().toArray();
    const indexStats = {};

    for (const collection of collections) {
      // Skip system collections
      if (collection.name.startsWith('system.') || collection.name.startsWith('admin')) {
        continue;
      }

      try {
        const coll = db.collection(collection.name);

        // Get indexes
        const indexes = await coll.indexes();

        // Get index statistics if available
        let indexAccessStats = [];
        try {
          indexAccessStats = await coll.aggregate([
            { $indexStats: {} },
          ]).toArray();
        } catch {
          // $indexStats may not be available in all environments
        }

        // Get collection stats
        const stats = await coll.stats();

        indexStats[collection.name] = {
          documentCount: stats.count || 0,
          storageSize: stats.storageSize || 0,
          indexCount: indexes.length,
          totalIndexSize: stats.totalIndexSize || 0,
          indexes: indexes.map((idx) => {
            const accessStat = indexAccessStats.find((s) => s.name === idx.name);
            return {
              name: idx.name,
              key: idx.key,
              unique: idx.unique || false,
              sparse: idx.sparse || false,
              size: idx.size || 0,
              operations: accessStat?.accesses?.ops || 0,
              lastUsed: accessStat?.accesses?.since || null,
            };
          }),

          // Index health indicators
          indexEfficiency: this.calculateIndexEfficiency(stats, indexAccessStats),
          unusedIndexes: this.findUnusedIndexes(indexAccessStats),
          warnings: this.getIndexWarnings(stats, indexes, indexAccessStats),
        };
      } catch (error) {
        indexStats[collection.name] = {
          error: error.message,
        };
      }
    }

    return {
      collections: indexStats,
      summary: this.summarizeIndexStats(indexStats),
    };
  }

  /**
   * Calculate index efficiency
   */
  calculateIndexEfficiency(stats, indexAccessStats) {
    if (!stats || !indexAccessStats) return { score: 'unknown' };

    const totalOps = indexAccessStats.reduce((sum, stat) => {
      return sum + (stat.accesses?.ops || 0);
    }, 0);

    const indexCount = stats.nindexes || 0;
    const avgOpsPerIndex = indexCount > 0 ? totalOps / indexCount : 0;

    return {
      totalOperations: totalOps,
      averageOpsPerIndex: avgOpsPerIndex.toFixed(2),
      indexCount,
      score: this.calculateEfficiencyScore(totalOps, indexCount),
    };
  }

  /**
   * Calculate efficiency score
   */
  calculateEfficiencyScore(totalOps, indexCount) {
    if (indexCount === 0) return 'poor';
    if (totalOps === 0) return 'unused';

    const opsPerIndex = totalOps / indexCount;

    if (opsPerIndex > 10000) return 'excellent';
    if (opsPerIndex > 1000) return 'good';
    if (opsPerIndex > 100) return 'fair';
    return 'poor';
  }

  /**
   * Find unused indexes
   */
  findUnusedIndexes(indexAccessStats) {
    return indexAccessStats
      .filter((stat) => stat.accesses?.ops === 0)
      .map((stat) => ({
        name: stat.name,
        key: stat.key,
        since: stat.accesses?.since,
      }));
  }

  /**
   * Get index warnings
   */
  getIndexWarnings(stats, indexes, indexAccessStats) {
    const warnings = [];

    // Check for too many indexes
    if (indexes.length > 10) {
      warnings.push({
        level: 'warning',
        message: `Collection has ${indexes.length} indexes (recommended max: 10)`,
        recommendation: 'Review and remove unused indexes',
      });
    }

    // Check for unused indexes
    const unused = indexAccessStats.filter((s) => s.accesses?.ops === 0);
    if (unused.length > 0) {
      warnings.push({
        level: 'warning',
        message: `${unused.length} unused index(es) detected`,
        recommendation: 'Consider removing unused indexes to improve write performance',
        indexes: unused.map((s) => s.name),
      });
    }

    // Check index size vs data size ratio
    if (stats.totalIndexSize && stats.size) {
      const ratio = stats.totalIndexSize / stats.size;
      if (ratio > 2) {
        warnings.push({
          level: 'info',
          message: `Index size is ${ratio.toFixed(1)}x larger than data size`,
          recommendation: 'Review index strategy',
        });
      }
    }

    // Check for duplicate indexes
    const keyPatterns = indexes.map((i) => JSON.stringify(i.key));
    const duplicates = keyPatterns.filter((item, index) => keyPatterns.indexOf(item) !== index);
    if (duplicates.length > 0) {
      warnings.push({
        level: 'warning',
        message: 'Potential duplicate indexes detected',
        recommendation: 'Review and remove duplicate indexes',
      });
    }

    return warnings;
  }

  /**
   * Summarize index statistics
   */
  summarizeIndexStats(indexStats) {
    let totalCollections = 0;
    let totalIndexes = 0;
    let totalIndexSize = 0;
    let totalDocuments = 0;
    let collectionsWithWarnings = 0;
    let totalUnusedIndexes = 0;

    for (const [_collName, stats] of Object.entries(indexStats)) {
      if (stats.error) continue;

      totalCollections++;
      totalIndexes += stats.indexCount || 0;
      totalIndexSize += stats.totalIndexSize || 0;
      totalDocuments += stats.documentCount || 0;
      totalUnusedIndexes += stats.unusedIndexes?.length || 0;

      if (stats.warnings?.length > 0) {
        collectionsWithWarnings++;
      }
    }

    return {
      totalCollections,
      totalIndexes,
      totalIndexSize,
      totalDocuments,
      collectionsWithWarnings,
      totalUnusedIndexes,
      averageIndexesPerCollection: totalCollections > 0
        ? (totalIndexes / totalCollections).toFixed(2)
        : 0,
    };
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(db) {
    const admin = db.admin();

    try {
      const status = await admin.serverStatus();

      return {
        dataSize: status.dataSize || 0,
        storageSize: status.storageSize || 0,
        indexSize: status.indexSize || 0,
        fileSize: status.fileSize || 0,

        // Formatted sizes
        dataSizeFormatted: this.formatBytes(status.dataSize || 0),
        storageSizeFormatted: this.formatBytes(status.storageSize || 0),
        indexSizeFormatted: this.formatBytes(status.indexSize || 0),
        fileSizeFormatted: this.formatBytes(status.fileSize || 0),

        // WiredTiger cache (if available)
        wiredTigerCache: status.wiredTiger?.cache || null,

        // Storage health indicators
        storageEfficiency: this.calculateStorageEfficiency(status),
        warnings: this.getStorageWarnings(status),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Calculate storage efficiency
   */
  calculateStorageEfficiency(status) {
    const dataSize = status.dataSize || 0;
    const storageSize = status.storageSize || 0;

    if (storageSize === 0) return { ratio: 0, score: 'unknown' };

    const ratio = dataSize / storageSize;

    return {
      ratio: ratio.toFixed(2),
      score: ratio > 0.8 ? 'excellent' : ratio > 0.5 ? 'good' : 'fair',
      fragmentation: ((1 - ratio) * 100).toFixed(2) + '%',
    };
  }

  /**
   * Get storage warnings
   */
  getStorageWarnings(status) {
    const warnings = [];

    // Check storage fragmentation
    const dataSize = status.dataSize || 0;
    const storageSize = status.storageSize || 0;

    if (storageSize > 0 && dataSize > 0) {
      const fragmentation = 1 - (dataSize / storageSize);
      if (fragmentation > 0.3) {
        warnings.push({
          level: 'warning',
          message: `High storage fragmentation: ${(fragmentation * 100).toFixed(1)}%`,
          recommendation: 'Consider running compact command',
        });
      }
    }

    // Check index size
    const indexSize = status.indexSize || 0;
    if (indexSize > dataSize * 2) {
      warnings.push({
        level: 'info',
        message: 'Index size is significantly larger than data size',
        recommendation: 'Review index strategy',
      });
    }

    return warnings;
  }

  /**
   * Get server status
   */
  async getServerStatus(db) {
    const admin = db.admin();

    try {
      const status = await admin.serverStatus();

      return {
        version: status.version,
        host: status.host,
        uptime: status.uptime,
        uptimeFormatted: this.formatUptime(status.uptime),

        // Memory
        memory: {
          resident: status.mem?.resident || 0,
          virtual: status.mem?.virtual || 0,
          mapped: status.mem?.mapped || 0,
        },

        // Operations
        operations: {
          inserts: status.opcounters?.insert || 0,
          queries: status.opcounters?.query || 0,
          updates: status.opcounters?.update || 0,
          deletes: status.opcounters?.delete || 0,
          getmores: status.opcounters?.getmore || 0,
          commands: status.opcounters?.command || 0,
        },

        // Network
        network: {
          bytesIn: status.network?.bytesIn || 0,
          bytesOut: status.network?.bytesOut || 0,
          numRequests: status.network?.numRequests || 0,
        },

        // Global lock
        globalLock: status.globalLock || null,

        // Extra info
        extraInfo: status.extraInfo || null,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get replica set status
   */
  async getReplicaSetStatus(db) {
    const admin = db.admin();

    try {
      const status = await admin.replicaSetStatus();

      if (!status || !status.set) {
        return { configured: false };
      }

      return {
        configured: true,
        setName: status.set,
        myState: status.myState,
        members: status.members?.map((m) => ({
          name: m.name,
          stateStr: m.stateStr,
          health: m.health,
          optimeDate: m.optimeDate,
          lag: m.lag || 0,
        })) || [],
      };
    } catch (error) {
      // Not a replica set or not authorized
      return { configured: false, message: 'Not a replica set or not authorized' };
    }
  }

  /**
   * Determine overall status
   */
  determineOverallStatus(connectionPool, indexStats, storageStats) {
    const issues = [];

    // Check connection pool
    if (connectionPool.status === 'rejected') {
      issues.push('connection_pool_error');
    } else if (connectionPool.value?.warnings?.some((w) => w.level === 'critical')) {
      issues.push('connection_pool_critical');
    }

    // Check index stats
    if (indexStats.status === 'rejected') {
      issues.push('index_stats_error');
    } else if (indexStats.value?.summary?.totalUnusedIndexes > 5) {
      issues.push('many_unused_indexes');
    }

    // Check storage
    if (storageStats.status === 'rejected') {
      issues.push('storage_stats_error');
    } else if (storageStats.value?.warnings?.some((w) => w.level === 'warning')) {
      issues.push('storage_warnings');
    }

    if (issues.length === 0) return 'healthy';
    if (issues.some((i) => i.includes('error'))) return 'degraded';
    return 'warning';
  }

  /**
   * Get ready state text
   */
  getReadyStateText(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[state] || 'unknown';
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format uptime to human readable
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
  }

  /**
   * Get slow queries (if available)
   */
  async getSlowQueries(db, limit = 10) {
    try {
      const profile = await db.command({ profile: -1 });

      if (profile.was === 0) {
        return { profiling: false, message: 'Profiling is disabled' };
      }

      const slowQueries = await db.collection('system.profile')
        .find({})
        .sort({ ts: -1 })
        .limit(limit)
        .toArray();

      return {
        profiling: true,
        level: profile.was,
        slowms: profile.slowms,
        queries: slowQueries.map((q) => ({
          operation: q.op,
          namespace: q.ns,
          duration: q.millis,
          timestamp: q.ts,
          command: q.command ? Object.keys(q.command)[0] : null,
          planSummary: q.planSummary,
        })),
      };
    } catch (error) {
      return { profiling: false, message: 'Unable to retrieve slow queries' };
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(db, collectionName) {
    try {
      const coll = db.collection(collectionName);
      const stats = await coll.stats();

      return {
        name: stats.ns,
        count: stats.count,
        size: stats.size,
        storageSize: stats.storageSize,
        totalIndexSize: stats.totalIndexSize,
        indexSizes: stats.indexSizes || {},
        avgObjSize: stats.avgObjSize,
        nindexes: stats.nindexes,
        wiredTiger: stats.wiredTiger || null,
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

// Singleton instance
const dbHealthMonitor = new DatabaseHealthMonitor();

module.exports = dbHealthMonitor;
