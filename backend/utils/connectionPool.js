/**
 * MongoDB Connection Pool Optimization Module
 *
 * Provides advanced connection pooling configuration and monitoring for
 * high-traffic scenarios. Includes:
 * - Optimized connection pool settings
 * - Connection pool monitoring and metrics
 * - Connection pool warm-up
 * - Health checks
 * - Performance recommendations
 */

const mongoose = require('mongoose');

class ConnectionPoolManager {
  constructor() {
    this.metrics = {
      connectionsCreated: 0,
      connectionsClosed: 0,
      connectionsActive: 0,
      connectionsIdle: 0,
      waitQueueSize: 0,
      totalWaitTime: 0,
      averageWaitTime: 0,
      peakConnections: 0,
      lastChecked: null,
    };

    this.startTime = Date.now();
    this.isWarmedUp = false;
  }

  /**
   * Get optimized connection pool configuration
   */
  static getOptimizedConfig(options = {}) {
    const {
      isProduction = process.env.NODE_ENV === 'production',
      expectedConnections: _expectedConnections = 100,
      maxPoolSize = isProduction ? 50 : 20,
      minPoolSize = isProduction ? 10 : 5,
      maxIdleTimeMS = 30000, // 30 seconds
      waitQueueTimeoutMS = 5000, // 5 seconds
      serverSelectionTimeoutMS = 5000, // 5 seconds
      heartbeatFrequencyMS = 10000, // 10 seconds
      retryWrites = true,
      retryReads = true,
      compressors = ['zlib'],
    } = options;

    return {
      // Pool size configuration
      maxPoolSize,
      minPoolSize,

      // Timeout configuration
      maxIdleTimeMS,
      waitQueueTimeoutMS,
      serverSelectionTimeoutMS,

      // Health check configuration
      heartbeatFrequencyMS,

      // Retry configuration
      retryWrites,
      retryReads,

      // Compression
      compressors,

      // Additional options for high-traffic scenarios
      ...(isProduction && {
        // Enable auto index in production (disable for better performance)
        autoIndex: false,

        // Connection timeout
        connectTimeoutMS: 10000,

        // Socket timeout
        socketTimeoutMS: 45000,

        // Family (IPv4 or IPv6)
        family: 4,
      }),
    };
  }

  /**
   * Get connection string with optimized parameters
   */
  static getOptimizedConnectionString(baseUri, options = {}) {
    const config = ConnectionPoolManager.getOptimizedConfig(options);

    // Parse base URI
    let uri = baseUri;

    // Add connection parameters if not already present
    const params = [];

    if (!uri.includes('maxPoolSize')) {
      params.push(`maxPoolSize=${config.maxPoolSize}`);
    }

    if (!uri.includes('minPoolSize')) {
      params.push(`minPoolSize=${config.minPoolSize}`);
    }

    if (!uri.includes('maxIdleTimeMS')) {
      params.push(`maxIdleTimeMS=${config.maxIdleTimeMS}`);
    }

    if (!uri.includes('waitQueueTimeoutMS')) {
      params.push(`waitQueueTimeoutMS=${config.waitQueueTimeoutMS}`);
    }

    if (!uri.includes('serverSelectionTimeoutMS')) {
      params.push(`serverSelectionTimeoutMS=${config.serverSelectionTimeoutMS}`);
    }

    if (!uri.includes('retryWrites')) {
      params.push(`retryWrites=${config.retryWrites}`);
    }

    if (!uri.includes('retryReads')) {
      params.push(`retryReads=${config.retryReads}`);
    }

    if (params.length > 0) {
      const separator = uri.includes('?') ? '&' : '?';
      uri += separator + params.join('&');
    }

    return uri;
  }

  /**
   * Connect with optimized settings
   */
  static async connect(options = {}) {
    const {
      mongoUri = process.env.MONGO_URI,
      isProduction = process.env.NODE_ENV === 'production',
    } = options;

    if (!mongoUri) {
      throw new Error('MONGO_URI is required');
    }

    const optimizedUri = ConnectionPoolManager.getOptimizedConnectionString(mongoUri, {
      isProduction,
    });

    console.log('🔌  Connecting to MongoDB with optimized pooling...');
    console.log(`   Max Pool Size: ${isProduction ? 50 : 20}`);
    console.log(`   Min Pool Size: ${isProduction ? 10 : 5}`);
    console.log('   Max Idle Time: 30s');
    console.log('   Wait Queue Timeout: 5s');
    console.log('');

    await mongoose.connect(optimizedUri, ConnectionPoolManager.getOptimizedConfig({ isProduction }));

    console.log('✅  Connected with optimized pooling\n');
  }

  /**
   * Warm up connection pool
   */
  static async warmUpPool() {
    console.log('🔥  Warming up connection pool...');

    const startTime = Date.now();
    const warmUpQueries = 20; // Number of queries to warm up

    try {
      // Execute multiple queries to warm up connections
      const promises = [];

      for (let i = 0; i < warmUpQueries; i++) {
        promises.push(
          mongoose.connection.db.admin().ping().catch(() => null),
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`✅  Pool warmed up with ${warmUpQueries} queries in ${duration}ms\n`);

      return {
        success: true,
        queriesExecuted: warmUpQueries,
        duration,
      };
    } catch (error) {
      console.error(`⚠️   Pool warm-up failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  static getPoolStats() {
    try {
      const { db: _db } = mongoose.connection;
      const state = mongoose.connection.readyState;

      // Get server status for connection info
      return {
        readyState: state,
        readyStateText: ConnectionPoolManager.getReadyStateText(state),
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,

        // Connection pool configuration
        config: {
          maxPoolSize: mongoose.connection.options?.maxPoolSize || 'default',
          minPoolSize: mongoose.connection.options?.minPoolSize || 'default',
          maxIdleTimeMS: mongoose.connection.options?.maxIdleTimeMS || 'default',
          waitQueueTimeoutMS: mongoose.connection.options?.waitQueueTimeoutMS || 'default',
        },

        // Runtime metrics (if available)
        runtime: {
          connectionsCreated: mongoose.connection.options?.poolSize || 0,
          // These would need to be tracked manually
        },
      };
    } catch (error) {
      return {
        error: error.message,
        readyState: mongoose.connection.readyState,
      };
    }
  }

  /**
   * Get ready state text
   */
  static getReadyStateText(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[state] || 'unknown';
  }

  /**
   * Monitor connection pool health
   */
  static async monitorHealth() {
    const startTime = Date.now();

    try {
      const { db } = mongoose.connection;

      // Test connection
      await db.admin().ping();

      const pingTime = Date.now() - startTime;

      // Get server status
      let serverStatus = null;
      try {
        serverStatus = await db.admin().serverStatus();
      } catch {
        // Server status might not be available
      }

      return {
        status: 'healthy',
        pingTime,
        readyState: mongoose.connection.readyState,
        connections: {
          current: serverStatus?.connections?.current || 0,
          available: serverStatus?.connections?.available || 0,
          totalCreated: serverStatus?.connections?.totalCreated || 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        readyState: mongoose.connection.readyState,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get performance recommendations
   */
  static getPerformanceRecommendations() {
    const recommendations = [];
    const config = mongoose.connection.options || {};

    // Check pool size
    if (!config.maxPoolSize || config.maxPoolSize < 20) {
      recommendations.push({
        type: 'warning',
        category: 'pool_size',
        message: 'Consider increasing maxPoolSize for high-traffic scenarios',
        current: config.maxPoolSize || 'default (100)',
        recommended: process.env.NODE_ENV === 'production' ? 50 : 20,
      });
    }

    // Check idle time
    if (!config.maxIdleTimeMS || config.maxIdleTimeMS > 60000) {
      recommendations.push({
        type: 'info',
        category: 'idle_time',
        message: 'Consider reducing maxIdleTimeMS to free up connections faster',
        current: config.maxIdleTimeMS || 'default (120000)',
        recommended: 30000,
      });
    }

    // Check wait queue timeout
    if (!config.waitQueueTimeoutMS || config.waitQueueTimeoutMS < 5000) {
      recommendations.push({
        type: 'warning',
        category: 'wait_timeout',
        message: 'Consider increasing waitQueueTimeoutMS to handle traffic spikes',
        current: config.waitQueueTimeoutMS || 'default (1000)',
        recommended: 5000,
      });
    }

    // Check retry writes
    if (config.retryWrites === false) {
      recommendations.push({
        type: 'warning',
        category: 'retry_writes',
        message: 'Enable retryWrites for better fault tolerance',
        current: config.retryWrites,
        recommended: true,
      });
    }

    // Check compression
    if (!config.compressors || config.compressors.length === 0) {
      recommendations.push({
        type: 'info',
        category: 'compression',
        message: 'Enable compression to reduce network overhead',
        current: config.compressors || 'none',
        recommended: ['snappy', 'zlib'],
      });
    }

    return {
      totalRecommendations: recommendations.length,
      recommendations,
      score: ConnectionPoolManager.calculateRecommendationScore(recommendations),
    };
  }

  /**
   * Calculate recommendation score
   */
  static calculateRecommendationScore(recommendations) {
    if (recommendations.length === 0) return 100;

    const warnings = recommendations.filter((r) => r.type === 'warning').length;
    const infos = recommendations.filter((r) => r.type === 'info').length;

    // Score: 100 - (warnings * 10) - (infos * 5)
    return Math.max(0, 100 - (warnings * 10) - (infos * 5));
  }

  /**
   * Get connection pool metrics for Prometheus
   */
  static getPrometheusMetrics() {
    const stats = ConnectionPoolManager.getPoolStats();
    const health = ConnectionPoolManager.monitorHealth();

    return `
# HELP mongodb_connection_pool_ready_state MongoDB connection ready state (0=disconnected, 1=connected, 2=connecting, 3=disconnecting)
# TYPE mongodb_connection_pool_ready_state gauge
mongodb_connection_pool_ready_state ${stats.readyState}

# HELP mongodb_connection_pool_ping_time_seconds MongoDB ping time in seconds
# TYPE mongodb_connection_pool_ping_time_seconds gauge
mongodb_connection_pool_ping_time_seconds ${(health.pingTime || 0) / 1000}

# HELP mongodb_connection_pool_max_size Maximum connection pool size
# TYPE mongodb_connection_pool_max_size gauge
mongodb_connection_pool_max_size ${stats.config?.maxPoolSize || 100}

# HELP mongodb_connection_pool_min_size Minimum connection pool size
# TYPE mongodb_connection_pool_min_size gauge
mongodb_connection_pool_min_size ${stats.config?.minPoolSize || 0}

# HELP mongodb_connections_current Current number of connections
# TYPE mongodb_connections_current gauge
mongodb_connections_current ${health.connections?.current || 0}

# HELP mongodb_connections_available Available connections
# TYPE mongodb_connections_available gauge
mongodb_connections_available ${health.connections?.available || 0}

# HELP mongodb_connections_total_created Total connections created
# TYPE mongodb_connections_total_created counter
mongodb_connections_total_created ${health.connections?.totalCreated || 0}
`;
  }
}

module.exports = ConnectionPoolManager;
